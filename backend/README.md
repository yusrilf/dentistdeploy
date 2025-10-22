# KonsultaDentist Server (Express + MySQL)

## Setup
1. Pastikan MySQL berjalan dan kredensial disiapkan.
2. Salin `.env.example` menjadi `.env` dan isi variabel sesuai lingkungan Anda.
3. Install dependencies:
   ```bash
   cd server
   npm install
   ```
4. Jalankan server:
   ```bash
   npm run dev
   ```

Saat start, server akan:
- Membuat database `konsulta_dentist` jika belum ada.
- Membuat tabel `users` jika belum ada.
- Seed user `admin` dengan password `admin` jika belum ada.
- Membuat tabel `bookings` dan seed data contoh jika kosong.

## Routes API
Base URL default: `http://localhost:3001`

### Health
- `GET /health`
  - Respon: `{ ok: true }`
  - Trigger: cek kesehatan aplikasi (tanpa akses DB).

### Auth
- `POST /auth/login`
  - Body: `{ "username": "admin", "password": "admin" }`
  - Respon sukses: `{ ok: true, user: { id, username, role } }`
  - Respon gagal: status `401` `{ error: 'Invalid credentials' }`
  - Trigger: `authenticate(username, password)` — verifikasi user pada tabel `users` (bcrypt hash).

### Bookings
- `GET /bookings`
  - Respon: daftar semua booking (terurut `createdAt DESC`).
  - Trigger: `listBookings()` — baca seluruh data dari tabel `bookings`.

- `GET /bookings/:id`
  - Respon: 1 booking berdasarkan `id` atau `404` jika tidak ditemukan.
  - Trigger: `getBooking(id)` — baca satu data dari `bookings`.

- `POST /bookings`
  - Body: objek booking, contoh minimal:
    ```json
    {
      "patient": "Nama Pasien",
      "gender": "Laki-laki|Perempuan",
      "service": "Scaling|Tambal Gigi|...",
      "bookingDateTime": "2025-10-15 09:00:00",
      "status": "pending|approved|rejected"
    }
    ```
  - Respon: data booking yang dibuat (`201 Created`).
  - Trigger: `createBooking(data)` — tulis data ke tabel `bookings`.

- `PUT /bookings/:id`
  - Body: perubahan field yang diizinkan (termasuk `status: 'pending'|'approved'|'rejected'`).
  - Respon: data booking yang telah diperbarui.
  - Trigger: `updateBookingDb(id, changes)` — update data di tabel `bookings`.

- `DELETE /bookings/:id`
  - Respon: `{ ok: true }` jika berhasil.
  - Trigger: `deleteBookingDb(id)` — hapus data dari `bookings`.

### Calendar (Free Slots)
- `GET /calendar/availability`
  - Tujuan: mengembalikan hanya slot waktu kosong 30 menit untuk hari ini hingga 7 hari ke depan, tanpa data pelanggan.
  - Query (opsional):
    - `days` (default `7`): jumlah hari ke depan yang dihitung (selalu termasuk hari ini).
    - `workStart` (default `09:00`): jam mulai operasional, format `HH:mm`.
    - `workEnd` (default `17:00`): jam selesai operasional, format `HH:mm`.
    - `slotMinutes` (default `30`): durasi slot dalam menit.
    - `includePending` (default `1`): `1` agar booking berstatus `pending` ikut memblokir slot; `0` hanya `approved`.
    - `capacity` (default `1`): kapasitas per slot.
  - Respon (array per tanggal):
    ```json
    [
      { "date": "YYYY-MM-DD", "free": ["09:00-09:30", "10:00-10:30", "16:30-17:00"] },
      { "date": "YYYY-MM-DD", "free": ["09:00-09:30"] }
    ]
    ```
  - Contoh:
    ```bash
    curl "http://localhost:3001/calendar/availability?days=7&workStart=09:00&workEnd=17:00&slotMinutes=30&includePending=1"
    ```
  - Trigger: `computeNextDaysAvailability({ daysAhead, workStart, workEnd, slotMinutes, includePending, capacity })`
    - Membaca booking dalam rentang (hari ini..+7) dari DB
    - Menghitung slot kosong 30 menit
    - Tidak menyertakan data pasien dalam output

- `GET /calendar/availability/day`
  - Tujuan: cek slot waktu kosong pada tanggal tertentu (strict per tanggal), tanpa data pelanggan.
  - Query:
    - `date=YYYY-MM-DD` ATAU `year`, `month`, `day`
    - `workStart` (default `09:00`), `workEnd` (default `17:00`), `slotMinutes` (default `30`), `includePending` (default `1`), `capacity` (default `1`).
    - `doctorId` (opsional): filter slot kosong berdasarkan dokter tertentu dan jam kerja dokter tsb.
  - Respon:
    ```json
    { "date": "YYYY-MM-DD", "free": ["09:00-09:30", "10:00-10:30"] }
    ```
  - Contoh:
    ```bash
    # Pakai satu parameter tanggal
    curl "http://localhost:3001/calendar/availability/day?date=2025-10-18&workStart=09:00&workEnd=17:00&slotMinutes=30&includePending=1"
    # Pakai parameter terpisah (year, month, day)
    curl "http://localhost:3001/calendar/availability/day?year=2025&month=10&day=18&workStart=09:00&workEnd=17:00"
    # Filter berdasarkan dokter tertentu (misal id=1)
    curl "http://localhost:3001/calendar/availability/day?date=2025-10-18&doctorId=1&slotMinutes=30&capacity=1"
    ```
  - Trigger: `computeDayAvailability({ date|year,month,day, workStart, workEnd, slotMinutes, includePending, capacity })`
    - Membaca booking pada hari tersebut dari DB
    - Menghitung slot kosong 30 menit
    - Tidak menyertakan data pasien dalam output

### Doctors
- `GET /doctors`
  - Respon: daftar semua dokter.
  - Contoh:
    ```bash
    curl http://localhost:3001/doctors
    ```

- `GET /doctors/:id`
  - Respon: detail dokter berdasarkan `id` atau `404` jika tidak ditemukan.

- `POST /doctors`
  - Body (contoh):
    ```json
    {
      "name": "Drg. Andi",
      "specialization": "Konservasi Gigi",
      "description": "Dokter gigi umum",
      "active": true
    }
    ```
  - Respon: data dokter yang dibuat (`201 Created`).

- `PUT /doctors/:id`
  - Body: perubahan field yang diizinkan (`name`, `specialization`, `description`, `active`).
  - Respon: data dokter yang telah diperbarui.

- `DELETE /doctors/:id`
  - Respon: `{ success: true|false }`.
  - Catatan: relasi layanan (`doctor_services`) dan jam kerja (`doctor_work_hours`) pada dokter tersebut akan dibersihkan.

- `GET /doctors/:id/services`
  - Respon: daftar layanan (`services`) yang terhubung ke dokter.

- `PUT /doctors/:id/services`
  - Body: `{ "serviceIds": [1,2,3] }` — set daftar layanan untuk dokter.
  - Respon: daftar layanan setelah diset.

- `GET /doctors/:id/work-hours`
  - Respon: jadwal mingguan dokter (array berisi `day_of_week`, `start_time`, `end_time`).
  - Konvensi `day_of_week`: `0=Ahad`..`6=Sabtu` (JS `Date.getDay()`).

- `PUT /doctors/:id/work-hours`
  - Body (contoh):
    ```json
    {
      "entries": [
        { "day_of_week": 1, "start_time": "09:00", "end_time": "17:00" },
        { "day_of_week": 2, "start_time": "09:00", "end_time": "17:00" }
      ]
    }
    ```
  - Respon: jadwal setelah diset.

- `GET /doctors/:id/availability/day?date=YYYY-MM-DD&slotMinutes=30&capacity=1`
  - Tujuan: daftar slot kosong untuk dokter tertentu pada tanggal `date`.
  - Respon contoh:
    ```json
    { "doctorId": 1, "date": "2025-10-18", "free": ["09:00-09:30", "10:00-10:30"] }
    ```
  - Contoh:
    ```bash
    curl "http://localhost:3001/doctors/1/availability/day?date=2025-10-18&slotMinutes=30&capacity=1"
    ```

- `GET /doctors/:id/availability/slot?date=YYYY-MM-DD&time=HH:mm&slotMinutes=30&capacity=1`
  - Tujuan: cek ketersediaan satu slot spesifik untuk dokter tertentu.
  - Respon contoh (tersedia):
    ```json
    { "available": true, "doctorId": 1, "date": "2025-10-18", "time": "10:00", "slotMinutes": 30, "slot": "10:00-10:30", "message": "slot_available" }
    ```
  - Respon contoh (tidak tersedia atau di luar jam kerja):
    ```json
    { "available": false, "doctorId": 1, "date": "2025-10-18", "time": "08:00", "slotMinutes": 30, "reason": "outside_work_hours", "workHours": { "start_time": "09:00", "end_time": "17:00" } }
    ```
  - Contoh:
    ```bash
    curl "http://localhost:3001/doctors/1/availability/slot?date=2025-10-18&time=10:00&slotMinutes=30&capacity=1"
    ```

#### AI Agent Routes (untuk n8n Tools)

- `POST /doctors/filter-by-service`
  - Tujuan: filter dokter berdasarkan layanan/spesialisasi untuk AI Agent.
  - Body:
    ```json
    { "service": "Scaling" }
    ```
  - Respon sukses:
    ```json
    {
      "success": true,
      "message": "Found 2 doctor(s) providing service: Scaling",
      "data": {
        "service": "Scaling",
        "doctors": [
          {
            "id": 1,
            "name": "Dr. Ahmad",
            "specialization": "Konservasi Gigi",
            "services": ["Scaling", "Filling"]
          }
        ],
        "count": 1
      }
    }
    ```
  - Respon tidak ditemukan:
    ```json
    {
      "success": true,
      "message": "No doctors found providing service: Orthodontics",
      "data": { "service": "Orthodontics", "doctors": [], "count": 0 }
    }
    ```
  - Error validasi:
    ```json
    {
      "error": "validation_error",
      "message": "Service name is required and must be a non-empty string",
      "details": { "field": "service", "received": "", "expected": "non-empty string" }
    }
    ```

- `POST /doctors/confirm-choice`
  - Tujuan: validasi dan konfirmasi pilihan dokter berdasarkan nama untuk AI Agent.
  - Body:
    ```json
    { "doctorName": "Dr. Ahmad" }
    ```
  - Respon sukses:
    ```json
    {
      "success": true,
      "message": "Doctor confirmed: Dr. Ahmad",
      "data": {
        "doctor_id": 1,
        "doctor_name": "Dr. Ahmad",
        "specialization": "Konservasi Gigi",
        "services": ["Scaling", "Filling"],
        "next_step": "proceed_to_booking"
      }
    }
    ```
  - Respon tidak ditemukan:
    ```json
    {
      "error": "doctor_not_found",
      "message": "Doctor with name \"Dr. Budi\" not found",
      "data": {
        "searchedName": "Dr. Budi",
        "suggestion": "Please check the spelling or try a different name"
      }
    }
    ```
  - Error validasi:
    ```json
    {
      "error": "validation_error",
      "message": "Doctor name is required and must be a non-empty string",
      "details": { "field": "doctorName", "received": null, "expected": "non-empty string" }
    }
    ```

- `POST /doctors/validate-slot`
  - Tujuan: validasi ketersediaan slot waktu spesifik untuk dokter tertentu untuk AI Agent.
  - Body:
    ```json
    { "doctor_id": 1, "date": "2025-01-20", "time": "09:00", "slotMinutes": 30, "capacity": 1 }
    ```
  - Respon sukses (tersedia):
    ```json
    {
      "success": true,
      "available": true,
      "message": "Slot is available for booking",
      "data": {
        "doctor_id": 1,
        "date": "2025-01-20",
        "time": "09:00",
        "slot": "09:00-09:30",
        "slotMinutes": 30
      }
    }
    ```
  - Respon sukses (tidak tersedia):
    ```json
    {
      "success": false,
      "available": false,
      "message": "Slot is not available",
      "data": {
        "doctor_id": 1,
        "date": "2025-01-20",
        "time": "09:00",
        "reason": "slot_booked"
      }
    }
    ```
  - Error validasi:
    ```json
    {
      "error": "validation_error",
      "message": "Required fields: doctor_id, date, time",
      "details": { "missing_fields": ["doctor_id"] }
    }
    ```

- `POST /doctors/check-day-availability`
  - Tujuan: mendapatkan semua slot waktu kosong untuk dokter pada tanggal tertentu untuk AI Agent.
  - Body:
    ```json
    { "doctor_id": 1, "date": "2025-01-20", "slotMinutes": 30, "capacity": 1 }
    ```
  - Respon sukses:
    ```json
    {
      "success": true,
      "message": "Found 8 available slots for doctor on 2025-01-20",
      "data": {
        "doctor_id": 1,
        "date": "2025-01-20",
        "available_slots": ["09:00-09:30", "09:30-10:00", "10:00-10:30"],
        "total_slots": 3,
        "slotMinutes": 30
      }
    }
    ```
  - Respon tidak ada slot:
    ```json
    {
      "success": true,
      "message": "No available slots for doctor on 2025-01-20",
      "data": {
        "doctor_id": 1,
        "date": "2025-01-20",
        "available_slots": [],
        "total_slots": 0
      }
    }
    ```
  - Error validasi:
    ```json
    {
      "error": "validation_error",
      "message": "Required fields: doctor_id, date",
      "details": { "missing_fields": ["date"] }
    }
    ```

  - Contoh penggunaan:
    ```bash
    # Filter dokter berdasarkan layanan
    curl -X POST http://localhost:3001/doctors/filter-by-service \
      -H "Content-Type: application/json" \
      -d '{"service": "Scaling"}'
    
    # Konfirmasi pilihan dokter
    curl -X POST http://localhost:3001/doctors/confirm-choice \
      -H "Content-Type: application/json" \
      -d '{"doctorName": "Dr. Ahmad"}'
    
    # Validasi slot waktu spesifik
    curl -X POST http://localhost:3001/doctors/validate-slot \
      -H "Content-Type: application/json" \
      -d '{"doctor_id": 1, "date": "2025-01-20", "time": "09:00", "slotMinutes": 30}'
    
    # Cek ketersediaan hari
    curl -X POST http://localhost:3001/doctors/check-day-availability \
      -H "Content-Type: application/json" \
      -d '{"doctor_id": 1, "date": "2025-01-20", "slotMinutes": 30}'
    ```

### Services
- `GET /services`
  - Respon: daftar semua layanan.

- `GET /services/:id`
  - Respon: 1 layanan berdasarkan `id` atau `404` jika tidak ditemukan.

- `POST /services`
  - Body (contoh):
    ```json
    {
      "name": "Scaling",
      "description": "Pembersihan plak/karang gigi",
      "durationMinutes": 30,
      "active": true
    }
    ```
  - Respon: data layanan yang dibuat (`201 Created`).

- `PUT /services/:id`
  - Body: perubahan field yang diizinkan (`name`, `description`, `durationMinutes`, `active`).
  - Respon: data layanan yang telah diperbarui.

- `DELETE /services/:id`
  - Respon: `{ ok: true }` jika berhasil.

## Konfigurasi
- `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`
- `CORS_ORIGIN` (default `http://localhost:5173,http://localhost:5174,http://localhost:5175`)
- `PORT` (default `3001`)

## Catatan
- Password disimpan sebagai hash (bcryptjs).
- Migrasi ke pengelolaan token/session dapat ditambahkan kemudian (JWT/express-session).
 - Endpoint kalender hanya menampilkan slot waktu kosong, tanpa informasi pelanggan.
 - Cek ketersediaan bisa dilakukan dua cara:
   - Berdasarkan hari (global): `GET /calendar/availability/day?...` (opsional `doctorId` untuk filter dokter tertentu).
   - Berdasarkan dokter spesifik: `GET /doctors/:id/availability/day` atau `GET /doctors/:id/availability/slot`.