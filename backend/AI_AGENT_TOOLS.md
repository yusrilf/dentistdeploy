# AI Agent Tools & Routes Documentation

Dokumentasi lengkap untuk tools dan routes yang digunakan oleh AI Agent dalam sistem booking dentist.

## 📋 Daftar Tools AI Agent

### 1. **Doctor Management Tools**
- `filter_doctors_by_service` - Filter dokter berdasarkan layanan
- `confirm_doctor_choice` - Konfirmasi pilihan dokter
- `validate_slot` - Validasi ketersediaan slot waktu
- `check_doctor_day_availability` - Cek ketersediaan dokter dalam sehari

### 2. **Booking Management Tools**
- `create_booking` - Membuat booking baru
- `get_booking_status` - Cek status booking
- `update_booking` - Update booking yang ada

### 3. **Service Management Tools**
- `list_services` - Daftar layanan yang tersedia
- `get_service_details` - Detail layanan tertentu

---

## 🛠️ API Routes untuk AI Agent

### **Doctor Routes**

#### 1. Filter Doctors by Service
**Endpoint**: `POST /doctors/filter-by-service`

**Deskripsi**: Mencari dokter yang menyediakan layanan tertentu

**Request Body**:
```json
{
  "service": "Scaling"
}
```

**Success Response**:
```json
{
  "success": true,
  "message": "Found 2 doctor(s) providing Scaling service",
  "doctors": [
    {
      "id": 1,
      "name": "Drg. Andi",
      "specialization": "General Dentist",
      "services": ["Scaling", "Filling", "Consultation"]
    },
    {
      "id": 2,
      "name": "Drg Asep",
      "specialization": "General Dentist", 
      "services": ["Scaling", "Root Canal"]
    }
  ],
  "total": 2
}
```

**Error Response**:
```json
{
  "error": "validation_error",
  "message": "Service name is required and must be a non-empty string",
  "details": {
    "field": "service",
    "received": "",
    "expected": "non-empty string"
  }
}
```

---

#### 2. Confirm Doctor Choice
**Endpoint**: `POST /doctors/confirm-choice`

**Deskripsi**: Konfirmasi dan validasi pilihan dokter berdasarkan nama

**Request Body**:
```json
{
  "doctor_name": "Drg Asep"
}
```

**Success Response**:
```json
{
  "success": true,
  "message": "Doctor confirmed successfully",
  "doctor": {
    "id": 2,
    "name": "Drg Asep",
    "specialization": "General Dentist",
    "services": ["Scaling", "Root Canal"],
    "phone": "081234567890",
    "email": "asep@dentist.com"
  },
  "next_step": "proceed_to_booking"
}
```

**Error Response**:
```json
{
  "error": "doctor_not_found",
  "message": "Doctor 'Dr. Tidak Ada' not found. Please check the spelling or try a different name.",
  "suggestions": [
    "Check spelling",
    "Try using partial name",
    "Use different doctor name"
  ]
}
```

---

#### 3. Validate Slot
**Endpoint**: `POST /doctors/validate-slot`

**Deskripsi**: Validasi ketersediaan slot waktu tertentu untuk dokter

**Request Body**:
```json
{
  "doctor_id": 1,
  "date": "2025-01-20",
  "time": "09:00",
  "slotMinutes": 30,
  "capacity": 1
}
```

**Success Response (Available)**:
```json
{
  "success": true,
  "available": true,
  "message": "Slot is available for booking",
  "data": {
    "doctor_id": 1,
    "date": "2025-01-20",
    "time": "09:00",
    "slot_minutes": 30,
    "slot_label": "09:00-09:30",
    "capacity": 1,
    "next_step": "proceed_to_booking"
  }
}
```

**Success Response (Not Available)**:
```json
{
  "success": false,
  "available": false,
  "message": "Requested slot is outside doctor work hours",
  "data": {
    "doctor_id": 1,
    "date": "2025-01-20",
    "time": "18:00",
    "slot_minutes": 30,
    "reason": "outside_work_hours",
    "work_hours": {
      "start": "09:00",
      "end": "17:00"
    }
  }
}
```

**Error Response**:
```json
{
  "error": "validation_error",
  "message": "Invalid time format",
  "details": {
    "field": "time",
    "received": "25:00",
    "expected": "HH:mm (00:00-23:59)"
  }
}
```

---

#### 4. Check Doctor Day Availability
**Endpoint**: `POST /doctors/check-day-availability`

**Deskripsi**: Mendapatkan semua slot kosong dokter pada tanggal tertentu

**Request Body**:
```json
{
  "doctor_id": 1,
  "date": "2025-01-20",
  "slotMinutes": 30,
  "capacity": 1
}
```

**Success Response**:
```json
{
  "success": true,
  "message": "Found 16 available slot(s) for Drg. Andi on 2025-01-20",
  "data": {
    "doctor_id": 1,
    "doctor_name": "Drg. Andi",
    "date": "2025-01-20",
    "working": true,
    "work_hours": {
      "start": "09:00",
      "end": "17:00"
    },
    "slot_minutes": 30,
    "capacity": 1,
    "available_slots": [
      "09:00-09:30",
      "09:30-10:00",
      "10:00-10:30",
      "10:30-11:00",
      "11:00-11:30",
      "11:30-12:00",
      "12:00-12:30",
      "12:30-13:00",
      "13:00-13:30",
      "13:30-14:00",
      "14:00-14:30",
      "14:30-15:00",
      "15:00-15:30",
      "15:30-16:00",
      "16:00-16:30",
      "16:30-17:00"
    ],
    "total_slots": 16,
    "next_step": "choose_slot_and_book"
  }
}
```

**Error Response**:
```json
{
  "error": "doctor_not_found",
  "message": "Doctor with ID 999 not found",
  "data": {
    "doctor_id": 999
  }
}
```

---

## 🔧 n8n Integration Examples

### **HTTP Request Node Configuration**

#### 1. Filter Doctors by Service
```json
{
  "method": "POST",
  "url": "http://localhost:3001/doctors/filter-by-service",
  "headers": {
    "Content-Type": "application/json"
  },
  "body": {
    "service": "{{ $json.service_name }}"
  }
}
```

#### 2. Confirm Doctor Choice
```json
{
  "method": "POST", 
  "url": "http://localhost:3001/doctors/confirm-choice",
  "headers": {
    "Content-Type": "application/json"
  },
  "body": {
    "doctor_name": "{{ $json.doctor_name }}"
  }
}
```

#### 3. Validate Slot
```json
{
  "method": "POST",
  "url": "http://localhost:3001/doctors/validate-slot", 
  "headers": {
    "Content-Type": "application/json"
  },
  "body": {
    "doctor_id": "{{ $json.doctor_id }}",
    "date": "{{ $json.booking_date }}",
    "time": "{{ $json.booking_time }}",
    "slotMinutes": 30
  }
}
```

#### 4. Check Day Availability
```json
{
  "method": "POST",
  "url": "http://localhost:3001/doctors/check-day-availability",
  "headers": {
    "Content-Type": "application/json"
  },
  "body": {
    "doctor_id": "{{ $json.doctor_id }}",
    "date": "{{ $json.booking_date }}",
    "slotMinutes": 30
  }
}
```

---

### **n8n Workflow Examples**

#### 1. Doctor Selection Workflow
```
WhatsApp Trigger → 
Extract Service → 
Filter Doctors → 
IF (doctors found) → 
  Send Doctor List → 
  Wait for Selection → 
  Confirm Doctor Choice
ELSE → 
  Send "No doctors available"
```

#### 2. Slot Booking Workflow  
```
WhatsApp Trigger →
Get Doctor ID →
Check Day Availability →
IF (slots available) →
  Send Available Slots →
  Wait for Time Selection →
  Validate Slot →
  IF (slot valid) →
    Create Booking
  ELSE →
    Send "Slot not available"
ELSE →
  Send "No slots available"
```

---

### **n8n Expression Examples**

#### Extract Service from WhatsApp Message
```javascript
// Extract service name from message
const message = $json.body.toLowerCase();
let service = '';

if (message.includes('scaling') || message.includes('pembersihan')) {
  service = 'Scaling';
} else if (message.includes('tambal') || message.includes('filling')) {
  service = 'Filling';
} else if (message.includes('cabut') || message.includes('extraction')) {
  service = 'Tooth Extraction';
} else if (message.includes('konsultasi') || message.includes('consultation')) {
  service = 'Consultation';
}

return { service_name: service };
```

#### Format Available Slots for WhatsApp
```javascript
// Format available slots for WhatsApp message
const slots = $json.data.available_slots;
const doctorName = $json.data.doctor_name;
const date = $json.data.date;

let message = `Slot tersedia untuk ${doctorName} pada ${date}:\n\n`;

slots.forEach((slot, index) => {
  message += `${index + 1}. ${slot}\n`;
});

message += '\nSilakan pilih nomor slot yang diinginkan.';

return { whatsapp_message: message };
```

---

## 🚀 Testing dengan cURL

### Test Filter Doctors
```bash
curl -X POST http://localhost:3001/doctors/filter-by-service \
  -H "Content-Type: application/json" \
  -d '{"service": "Scaling"}'
```

### Test Confirm Doctor
```bash
curl -X POST http://localhost:3001/doctors/confirm-choice \
  -H "Content-Type: application/json" \
  -d '{"doctor_name": "Drg Asep"}'
```

### Test Validate Slot
```bash
curl -X POST http://localhost:3001/doctors/validate-slot \
  -H "Content-Type: application/json" \
  -d '{"doctor_id": 1, "date": "2025-01-20", "time": "09:00", "slotMinutes": 30}'
```

### Test Check Day Availability
```bash
curl -X POST http://localhost:3001/doctors/check-day-availability \
  -H "Content-Type: application/json" \
  -d '{"doctor_id": 1, "date": "2025-01-20", "slotMinutes": 30}'
```

---

## 📝 Error Handling

### Common Error Types
1. **validation_error** - Input tidak valid
2. **doctor_not_found** - Dokter tidak ditemukan  
3. **service_not_found** - Layanan tidak ditemukan
4. **slot_unavailable** - Slot tidak tersedia
5. **outside_work_hours** - Di luar jam kerja
6. **internal_server_error** - Error server

### Error Response Format
```json
{
  "error": "error_type",
  "message": "Human readable error message",
  "details": {
    "field": "field_name",
    "received": "received_value", 
    "expected": "expected_format"
  }
}
```

---

## 🔐 Security Notes

- Semua endpoint menggunakan validasi input yang ketat
- Error messages tidak mengekspos informasi sensitif
- Rate limiting diterapkan untuk mencegah abuse
- CORS dikonfigurasi untuk membatasi akses

---

## 📞 Support

Untuk pertanyaan atau masalah terkait AI Agent tools:
- Email: support@konsulta.com
- WhatsApp: +62-xxx-xxxx-xxxx
- Dokumentasi: [Link ke dokumentasi lengkap]