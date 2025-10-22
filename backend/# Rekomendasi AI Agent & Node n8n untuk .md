# Rekomendasi AI Agent & Node n8n untuk KonsultaDentist API

Base API: `http://localhost:3001`

## Ringkasan Endpoint (Relevan untuk n8n)
- Auth
  - `POST /auth/login`
- Bookings
  - `GET /bookings`, `GET /bookings/:id`
  - `POST /bookings`, `PUT /bookings/:id`, `DELETE /bookings/:id`
- Calendar (Availability)
  - `GET /calendar/availability` (multi-day, slot-only)
  - `GET /calendar/availability/day?date=YYYY-MM-DD&doctorId?`
- Doctors
  - CRUD: `GET /doctors`, `GET /doctors/:id`, `POST /doctors`, `PUT /doctors/:id`, `DELETE /doctors/:id`
  - Services mapping: `GET /doctors/:id/services`, `PUT /doctors/:id/services`
  - Work hours: `GET /doctors/:id/work-hours`, `PUT /doctors/:id/work-hours`
  - Availability per dokter:
    - `GET /doctors/:id/availability/day?date=YYYY-MM-DD&slotMinutes&capacity`
    - `GET /doctors/:id/availability/slot?date=YYYY-MM-DD&time=HH:mm&slotMinutes&capacity`
- Services
  - CRUD: `GET /services`, `GET /services/:id`, `POST /services`, `PUT /services/:id`, `DELETE /services/:id`

---

## AI Agents yang Direkomendasikan

- Agent Cek Availability (2 jalur)
  - Tujuan: memberikan daftar slot kosong berdasarkan tanggal — global, atau spesifik dokter.
  - Endpoint:
    - Global: `GET /calendar/availability/day?date=...&doctorId?`
    - Spesifik dokter: `GET /doctors/:id/availability/day` dan `GET /doctors/:id/availability/slot`
  - Node n8n:
    - Trigger: `Webhook` (atau `Chat/WhatsApp` → kirim ke webhook)
    - Logic: `Set` (params), `HTTP Request`, `If` (cek hasil), `Respond to Webhook`
    - Opsional: `Slack/Telegram/Email` untuk notifikasi pasien/admin

- Agent Booking dengan Validasi Slot (Guarded Booking)
  - Tujuan: membuat booking baru hanya jika slot tersedia (hindari double-booking).
  - Endpoint:
    - Validasi: `GET /doctors/:id/availability/slot`
    - Buat booking: `POST /bookings`
    - Notifikasi: kirim ringkasan ke kanal internal
  - Node n8n:
    - `Webhook` → `Set` (date, time, doctorId, service, patient)
    - `HTTP Request` (cek slot) → `If (available?)`
      - `true` → `HTTP Request (POST /bookings)` → `Slack/Telegram/Email`
      - `false` → `HTTP Request (GET /doctors/:id/availability/day)` → `Respond to Webhook` (saran alternatif)

- Agent Pemilihan Dokter (Doctor Selector)
  - Tujuan: membantu pasien memilih dokter berdasarkan spesialisasi/layanan yang diinginkan.
  - Endpoint:
    - `GET /doctors` (ambil semua), `GET /doctors/:id/services`
  - Node n8n:
    - `Webhook` → `HTTP Request (/doctors)` → `Function` (filter by specialization/name)
    - `HTTP Request (/doctors/:id/services)` untuk melengkapi detail → `Respond to Webhook`

- Agent Pengelolaan Jam Kerja Dokter (Work Hours Manager)
  - Tujuan: baca/ubah jam kerja mingguan dokter.
  - Endpoint:
    - `GET /doctors/:id/work-hours`, `PUT /doctors/:id/work-hours`
  - Node n8n:
    - `Webhook` → `HTTP Request (GET work-hours)` → `Function` (merge perubahan)
    - `HTTP Request (PUT work-hours)` → `Respond to Webhook` + notifikasi

- Agent Katalog Layanan (Service Catalog)
  - Tujuan: tampilkan daftar layanan dan durasi.
  - Endpoint:
    - `GET /services`
  - Node n8n:
    - `Webhook` → `HTTP Request` → `Respond to Webhook`

- Agent Notifikasi Status Booking
  - Tujuan: kirim notifikasi saat booking dibuat/diubah/dihapus.
  - Endpoint:
    - `GET/POST/PUT/DELETE /bookings`
  - Node n8n:
    - `Webhook`/`Cron` → `HTTP Request` → `Slack/Telegram/Email` (format ringkas)

- Agent Reschedule/Cancel
  - Tujuan: ubah jadwal atau batalkan booking.
  - Endpoint:
    - `PUT /bookings/:id` (ubah `bookingDateTime` atau `status`)
  - Node n8n:
    - `Webhook` → `HTTP Request (update)` → `Respond to Webhook` + notifikasi

- Agent Auth (opsional, internal)
  - Tujuan: verifikasi admin via `POST /auth/login` sebelum menjalankan tindakan sensitif.
  - Catatan: API belum pakai token; gunakan network allowlist/Basic Auth di reverse proxy untuk produksi.

- Agent FAQ/Chat (Opsional, AI LLM)
  - Tujuan: jawab pertanyaan umum berdasarkan `dataset/faq_konsulta_dentist_gresik.csv`.
  - Node n8n:
    - `Webhook` → `Function` (parse/lookup CSV) → `OpenAI` (Chat) → `Respond to Webhook`
  - Catatan: siapkan kredensial OpenAI (`OPENAI_API_KEY`) di n8n.

---

## Contoh Workflow n8n

### 1) Booking dengan Validasi Slot (Doctor ID)
- Node:
  - `Webhook` (POST `/book`) — body: `{ patient, service, doctorId, date, time, slotMinutes?, capacity? }`
  - `Set` — isi default `slotMinutes=30`, `capacity=1`
  - `HTTP Request` — cek slot
    - `GET http://localhost:3001/doctors/{{$json.doctorId}}/availability/slot`
    - Query: `date={{$json.date}}`, `time={{$json.time}}`, `slotMinutes={{$json.slotMinutes}}`, `capacity={{$json.capacity}}`
  - `If` — `{{$json.available}} === true`
    - `true`:
      - `HTTP Request` — `POST /bookings`
        - Body JSON: `{ patient, service, doctor_id: {{$json.doctorId}}, bookingDateTime: "YYYY-MM-DD HH:mm:ss", status: "pending" }`
      - `Slack/Telegram/Email` — kirim ringkasan booking
      - `Respond to Webhook` — sukses
    - `false`:
      - `HTTP Request` — `GET /doctors/{{$json.doctorId}}/availability/day?date={{$json.date}}&slotMinutes={{$json.slotMinutes}}&capacity={{$json.capacity}}`
      - `Respond to Webhook` — berikan `reason` dan `free` sebagai usulan alternatif

### 2) Cek Availability Hari (Global atau Dokter Tertentu)
- Node:
  - `Webhook` (GET `/availability`)
  - `HTTP Request` — `GET /calendar/availability/day?date={{$json.date}}&doctorId={{$json.doctorId}}`
  - `Respond to Webhook` — kembalikan `{ date, free }`

### 3) Update Jam Kerja Dokter
- Node:
  - `Webhook` (PUT `/work-hours`)
  - `HTTP Request` — `GET /doctors/{{$json.doctorId}}/work-hours`
  - `Function` — merge perubahan (validasi `day_of_week`, format `HH:mm`)
  - `HTTP Request` — `PUT /doctors/{{$json.doctorId}}/work-hours`
    - Body: `{ entries: [{ day_of_week, start_time, end_time }, ...] }`
  - `Respond to Webhook` — kembalikan jadwal terbaru

---

## Template Konfigurasi Node “HTTP Request” (n8n)
- Method: `GET` atau `POST` sesuai endpoint
- URL:
  - Availability Slot Dokter: `http://localhost:3001/doctors/{{$json.doctorId}}/availability/slot`
- Query Parameters:
  - `date={{$json.date}}`, `time={{$json.time}}`, `slotMinutes={{$json.slotMinutes || 30}}`, `capacity={{$json.capacity || 1}}`
- Body (JSON, untuk `POST /bookings`):
  ```json
  {
    "patient": "Nama Pasien",
    "service": "Scaling",
    "doctor_id": 1,
    "bookingDateTime": "2025-10-18 10:00:00",
    "status": "pending"
  }