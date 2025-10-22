import express from 'express';
const router = express.Router();

import {
  listDoctors,
  getDoctor,
  createDoctor,
  updateDoctorDb,
  deleteDoctorDb,
  listDoctorServices,
  setDoctorServices,
  listDoctorWorkHours,
  setDoctorWorkHours,
  getDoctorWorkHoursForDate,
  filterDoctorsByService,
  findDoctorByName,
  getDoctorsWithServices,
} from '../services/doctorService.js';
import { computeDayAvailability } from '../services/calendarService.js';

// CRUD Doctors
router.get('/', async (req, res) => {
  try {
    const rows = await listDoctors();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Aggregated availability: all doctors for the next N days (default 7 including today)
// GET /doctors/availability?days=7&slotMinutes=30&capacity=1&includePending=1
// Output: [
//   {
//     doctorId, doctorName, services: [serviceName...],
//     days: [{ date: 'YYYY-MM-DD', label: 'Senin, 18 Oktober', free: ['HH:mm-HH:mm', ...] }, ...]
//   }, ...
// ]
router.get(['/availability', '/all/availability'], async (req, res) => {
  try {
    const daysAhead = req.query.days !== undefined ? Number(req.query.days) : 7;
    const slotMinutes = req.query.slotMinutes !== undefined ? Number(req.query.slotMinutes) : 30;
    const capacity = req.query.capacity !== undefined ? Number(req.query.capacity) : 1;
    const includePending = String(req.query.includePending ?? '1') === '1';

    if (!Number.isFinite(daysAhead) || daysAhead < 0) {
      return res.status(400).json({ error: 'days harus angka >= 0' });
    }
    if (!Number.isFinite(slotMinutes) || slotMinutes <= 0) {
      return res.status(400).json({ error: 'slotMinutes harus angka positif' });
    }
    if (!Number.isFinite(capacity) || capacity <= 0) {
      return res.status(400).json({ error: 'capacity harus angka positif' });
    }

    const docs = await listDoctors();
    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

    function pad2(n) { return String(n).padStart(2, '0'); }
    function formatDate(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
    function labelForDate(d) {
      const dayLabel = dayNames[d.getDay()];
      const tanggal = d.getDate();
      const bulan = monthNames[d.getMonth()];
      return `${dayLabel}, ${tanggal} ${bulan}`;
    }

    const out = [];
    for (const doc of docs) {
      const services = await listDoctorServices(doc.id);
      const serviceNames = Array.isArray(services) ? services.map(s => s.name).filter(Boolean) : [];

      const days = [];
      const today = new Date(); today.setHours(0, 0, 0, 0);
      for (let i = 0; i <= daysAhead; i++) { // include today
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        const dateStr = formatDate(d);
        const avail = await computeDayAvailability({ date: dateStr, slotMinutes, capacity, includePending, doctorId: doc.id });
        days.push({ date: avail.date, label: labelForDate(d), free: avail.free });
      }

      out.push({ doctorId: doc.id, doctorName: doc.name, services: serviceNames, days });
    }

    return res.json(out);
  } catch (err) {
    res.status(500).json({ error: 'failed', detail: String(err?.message || err) });
  }
});

// Summary: doctors + services they handle + typical weekly work hours
// GET /doctors/summary?activeOnly=1
// Output: [
//   {
//     doctorId, doctorName, specialization, services: ['Scaling','Tambal Gigi',...],
//     workHours: [ { day: 'Senin', start: '09:00', end: '17:00', day_of_week: 1 }, ... ]
//   }, ...
// ]
router.get('/summary', async (req, res) => {
  try {
    const activeOnly = String(req.query.activeOnly ?? '1') === '1';
    const docs = await listDoctors();
    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

    const filtered = activeOnly
      ? docs.filter(d => (d && (d.active === 1 || d.active === true)))
      : docs;

    const out = [];
    for (const doc of filtered) {
      const services = await listDoctorServices(doc.id);
      const serviceNames = Array.isArray(services) ? services.map(s => s.name).filter(Boolean) : [];
      const whRows = await listDoctorWorkHours(doc.id);
      const weekly = Array.isArray(whRows)
        ? whRows.map(wh => ({
            day: dayNames[Number(wh.day_of_week) || 0],
            start: wh.start_time,
            end: wh.end_time,
            day_of_week: wh.day_of_week,
          }))
        : [];

      out.push({
        doctorId: doc.id,
        doctorName: doc.name,
        specialization: doc.specialization || null,
        services: serviceNames,
        workHours: weekly,
      });
    }

    return res.json(out);
  } catch (err) {
    res.status(500).json({ error: 'failed', detail: String(err?.message || err) });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const item = await getDoctor(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const created = await createDoctor(req.body || {});
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const updated = await updateDoctorDb(req.params.id, req.body || {});
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const out = await deleteDoctorDb(req.params.id);
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Services mapping
router.get('/:id/services', async (req, res) => {
  try {
    const rows = await listDoctorServices(req.params.id);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/services', async (req, res) => {
  try {
    const { serviceIds } = req.body || {};
    const rows = await setDoctorServices(req.params.id, Array.isArray(serviceIds) ? serviceIds : []);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Work hours (weekly schedule)
router.get('/:id/work-hours', async (req, res) => {
  try {
    const rows = await listDoctorWorkHours(req.params.id);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/work-hours', async (req, res) => {
  try {
    const { entries } = req.body || {};
    const rows = await setDoctorWorkHours(req.params.id, Array.isArray(entries) ? entries : []);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Availability: per day (list free slots for a doctor)
// GET /doctors/:id/availability/day?date=YYYY-MM-DD&slotMinutes=30&capacity=1
router.get('/:id/availability/day', async (req, res) => {
  try {
    const doctorId = Number(req.params.id);
    if (!Number.isFinite(doctorId) || doctorId <= 0) {
      return res.status(400).json({ error: 'doctorId tidak valid' });
    }

    const date = req.query.date ? String(req.query.date) : undefined;
    if (!date) return res.status(400).json({ error: 'parameter date wajib (YYYY-MM-DD)' });

    const slotMinutes = req.query.slotMinutes !== undefined ? Number(req.query.slotMinutes) : 30;
    const capacity = req.query.capacity !== undefined ? Number(req.query.capacity) : 1;
    if (!Number.isFinite(slotMinutes) || slotMinutes <= 0) {
      return res.status(400).json({ error: 'slotMinutes harus angka positif' });
    }
    if (!Number.isFinite(capacity) || capacity <= 0) {
      return res.status(400).json({ error: 'capacity harus angka positif' });
    }

    const result = await computeDayAvailability({ date, slotMinutes, capacity, doctorId });
    // Tambahkan konteks doctorId agar respons lebih informatif
    return res.json({ doctorId, ...result });
  } catch (err) {
    res.status(500).json({ error: 'failed', detail: String(err?.message || err) });
  }
});

// Availability: specific slot for a doctor (boolean check)
// GET /doctors/:id/availability/slot?date=YYYY-MM-DD&time=HH:mm&slotMinutes=30&capacity=1
router.get('/:id/availability/slot', async (req, res) => {
  try {
    const doctorId = Number(req.params.id);
    if (!Number.isFinite(doctorId) || doctorId <= 0) {
      return res.status(400).json({ error: 'doctorId tidak valid' });
    }
    const dateStr = req.query.date ? String(req.query.date) : undefined;
    const timeStr = req.query.time ? String(req.query.time) : undefined;
    if (!dateStr || !timeStr) {
      return res.status(400).json({ error: 'parameter date (YYYY-MM-DD) dan time (HH:mm) wajib' });
    }
    const slotMinutes = req.query.slotMinutes !== undefined ? Number(req.query.slotMinutes) : 30;
    const capacity = req.query.capacity !== undefined ? Number(req.query.capacity) : 1;
    if (!Number.isFinite(slotMinutes) || slotMinutes <= 0) {
      return res.status(400).json({ error: 'slotMinutes harus angka positif' });
    }
    if (!Number.isFinite(capacity) || capacity <= 0) {
      return res.status(400).json({ error: 'capacity harus angka positif' });
    }

    // Parse date & time
    const [hhStr, mmStr] = String(timeStr).split(':');
    const hh = Number(hhStr);
    const mm = Number(mmStr);
    if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
      return res.status(400).json({ error: 'format time tidak valid (HH:mm)' });
    }
    const dateObj = new Date(dateStr);
    if (isNaN(dateObj)) return res.status(400).json({ error: 'format date tidak valid (YYYY-MM-DD)' });
    dateObj.setHours(0, 0, 0, 0);

    // Cek jam kerja dokter untuk tanggal tsb
    const wh = await getDoctorWorkHoursForDate(doctorId, dateObj);
    if (!wh) {
      return res.json({ available: false, doctorId, date: dateStr, time: timeStr, slotMinutes, reason: 'not_working_today' });
    }
    const [wsh, wsm] = wh.start_time.split(':').map(v => Number(v));
    const [weh, wem] = wh.end_time.split(':').map(v => Number(v));
    const slotStart = new Date(dateObj);
    slotStart.setHours(hh, mm, 0, 0);
    const slotEnd = new Date(slotStart.getTime() + Number(slotMinutes) * 60000);
    const workStart = new Date(dateObj); workStart.setHours(wsh, wsm, 0, 0);
    const workEnd = new Date(dateObj); workEnd.setHours(weh, wem, 0, 0);

    // Validasi berada dalam jam kerja
    if (slotStart < workStart || slotEnd > workEnd) {
      return res.json({ available: false, doctorId, date: dateStr, time: timeStr, slotMinutes, reason: 'outside_work_hours', workHours: wh });
    }

    // Gunakan availability harian untuk memutuskan apakah slot ini kosong
    const dayAvail = await computeDayAvailability({ date: dateStr, slotMinutes, capacity, doctorId });
    const slotLabel = `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}-${String(slotEnd.getHours()).padStart(2,'0')}:${String(slotEnd.getMinutes()).padStart(2,'0')}`;
    const isFree = Array.isArray(dayAvail.free) && dayAvail.free.includes(slotLabel);
    if (isFree) {
      return res.json({ available: true, doctorId, date: dateStr, time: timeStr, slotMinutes, slot: slotLabel, message: 'slot_available' });
    }
    return res.json({ available: false, doctorId, date: dateStr, time: timeStr, slotMinutes, slot: slotLabel, reason: 'slot_unavailable' });
  } catch (err) {
    res.status(500).json({ error: 'failed', detail: String(err?.message || err) });
  }
});

// AI Agent Route: Filter doctors by service
router.post('/filter-by-service', async (req, res) => {
  try {
    const { service } = req.body;
    
    // Validasi input
    if (!service || typeof service !== 'string' || service.trim() === '') {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Service name is required and must be a non-empty string',
        details: {
          field: 'service',
          received: service,
          expected: 'non-empty string'
        }
      });
    }

    const serviceName = service.trim();
    
    // Filter dokter berdasarkan layanan
    const filteredDoctors = await filterDoctorsByService(serviceName);
    
    if (!filteredDoctors || filteredDoctors.length === 0) {
      return res.json({
        success: true,
        message: `No doctors found providing service: ${serviceName}`,
        data: {
          service: serviceName,
          doctors: [],
          count: 0
        }
      });
    }

    res.json({
      success: true,
      message: `Found ${filteredDoctors.length} doctor(s) providing service: ${serviceName}`,
      data: {
        service: serviceName,
        doctors: filteredDoctors,
        count: filteredDoctors.length
      }
    });

  } catch (err) {
    console.error('Error filtering doctors by service:', err);
    res.status(500).json({
      error: 'internal_server_error',
      message: 'Failed to filter doctors by service',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// AI Agent Route: Confirm doctor choice
router.post('/confirm-choice', async (req, res) => {
  try {
    const { doctorName } = req.body;
    
    // Validasi input
    if (!doctorName || typeof doctorName !== 'string' || doctorName.trim() === '') {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Doctor name is required and must be a non-empty string',
        details: {
          field: 'doctorName',
          received: doctorName,
          expected: 'non-empty string'
        }
      });
    }

    const name = doctorName.trim();
    
    // Cari dokter berdasarkan nama
    const doctor = await findDoctorByName(name);
    
    if (!doctor) {
      return res.status(404).json({
        error: 'doctor_not_found',
        message: `Doctor with name "${name}" not found`,
        data: {
          searchedName: name,
          suggestion: 'Please check the spelling or try a different name'
        }
      });
    }

    // Berhasil menemukan dokter
    res.json({
      success: true,
      message: `Doctor confirmed: ${doctor.name}`,
      data: {
        doctor_id: doctor.id,
        doctor_name: doctor.name,
        specialization: doctor.specialization,
        services: doctor.services || [],
        next_step: 'proceed_to_booking'
      }
    });

  } catch (err) {
    console.error('Error confirming doctor choice:', err);
    res.status(500).json({
      error: 'internal_server_error',
      message: 'Failed to confirm doctor choice',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// AI Agent Route: Validate specific slot
router.post('/validate-slot', async (req, res) => {
  try {
    const { doctor_id, date, time, slotMinutes = 30, capacity = 1 } = req.body;
    
    // Validasi input
    if (!doctor_id || !Number.isFinite(Number(doctor_id)) || Number(doctor_id) <= 0) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Doctor ID is required and must be a positive number',
        details: {
          field: 'doctor_id',
          received: doctor_id,
          expected: 'positive number'
        }
      });
    }

    if (!date || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Date is required and must be in YYYY-MM-DD format',
        details: {
          field: 'date',
          received: date,
          expected: 'YYYY-MM-DD format'
        }
      });
    }

    if (!time || typeof time !== 'string' || !/^\d{2}:\d{2}$/.test(time)) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Time is required and must be in HH:mm format',
        details: {
          field: 'time',
          received: time,
          expected: 'HH:mm format'
        }
      });
    }

    const doctorId = Number(doctor_id);
    const slotMin = Number(slotMinutes);
    const cap = Number(capacity);

    if (!Number.isFinite(slotMin) || slotMin <= 0) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Slot minutes must be a positive number',
        details: {
          field: 'slotMinutes',
          received: slotMinutes,
          expected: 'positive number'
        }
      });
    }

    if (!Number.isFinite(cap) || cap <= 0) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Capacity must be a positive number',
        details: {
          field: 'capacity',
          received: capacity,
          expected: 'positive number'
        }
      });
    }

    // Parse time
    const [hhStr, mmStr] = time.split(':');
    const hh = Number(hhStr);
    const mm = Number(mmStr);
    
    if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid time format',
        details: {
          field: 'time',
          received: time,
          expected: 'HH:mm (00:00-23:59)'
        }
      });
    }

    // Validate date
    const dateObj = new Date(date);
    if (isNaN(dateObj)) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid date format',
        details: {
          field: 'date',
          received: date,
          expected: 'valid YYYY-MM-DD date'
        }
      });
    }
    dateObj.setHours(0, 0, 0, 0);

    // Check doctor work hours
    const wh = await getDoctorWorkHoursForDate(doctorId, dateObj);
    if (!wh) {
      return res.json({
        success: false,
        available: false,
        message: 'Doctor is not working on this date',
        data: {
          doctor_id: doctorId,
          date: date,
          time: time,
          slot_minutes: slotMin,
          reason: 'not_working_today'
        }
      });
    }

    // Check if slot is within work hours
    const [wsh, wsm] = wh.start_time.split(':').map(v => Number(v));
    const [weh, wem] = wh.end_time.split(':').map(v => Number(v));
    const slotStart = new Date(dateObj);
    slotStart.setHours(hh, mm, 0, 0);
    const slotEnd = new Date(slotStart.getTime() + slotMin * 60000);
    const workStart = new Date(dateObj); workStart.setHours(wsh, wsm, 0, 0);
    const workEnd = new Date(dateObj); workEnd.setHours(weh, wem, 0, 0);

    if (slotStart < workStart || slotEnd > workEnd) {
      return res.json({
        success: false,
        available: false,
        message: 'Requested slot is outside doctor work hours',
        data: {
          doctor_id: doctorId,
          date: date,
          time: time,
          slot_minutes: slotMin,
          reason: 'outside_work_hours',
          work_hours: {
            start: wh.start_time,
            end: wh.end_time
          }
        }
      });
    }

    // Check slot availability
    const dayAvail = await computeDayAvailability({ date, slotMinutes: slotMin, capacity: cap, doctorId });
    const slotLabel = `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}-${String(slotEnd.getHours()).padStart(2,'0')}:${String(slotEnd.getMinutes()).padStart(2,'0')}`;
    const isFree = Array.isArray(dayAvail.free) && dayAvail.free.includes(slotLabel);

    if (isFree) {
      return res.json({
        success: true,
        available: true,
        message: 'Slot is available for booking',
        data: {
          doctor_id: doctorId,
          date: date,
          time: time,
          slot_minutes: slotMin,
          slot_label: slotLabel,
          capacity: cap,
          next_step: 'proceed_to_booking'
        }
      });
    } else {
      return res.json({
        success: false,
        available: false,
        message: 'Slot is not available (already booked or conflicted)',
        data: {
          doctor_id: doctorId,
          date: date,
          time: time,
          slot_minutes: slotMin,
          slot_label: slotLabel,
          reason: 'slot_unavailable'
        }
      });
    }

  } catch (err) {
    console.error('Error validating slot:', err);
    res.status(500).json({
      error: 'internal_server_error',
      message: 'Failed to validate slot availability',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// AI Agent Route: Check doctor day availability
router.post('/check-day-availability', async (req, res) => {
  try {
    const { doctor_id, date, slotMinutes = 30, capacity = 1 } = req.body;
    
    // Validasi input
    if (!doctor_id || !Number.isFinite(Number(doctor_id)) || Number(doctor_id) <= 0) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Doctor ID is required and must be a positive number',
        details: {
          field: 'doctor_id',
          received: doctor_id,
          expected: 'positive number'
        }
      });
    }

    if (!date || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Date is required and must be in YYYY-MM-DD format',
        details: {
          field: 'date',
          received: date,
          expected: 'YYYY-MM-DD format'
        }
      });
    }

    const doctorId = Number(doctor_id);
    const slotMin = Number(slotMinutes);
    const cap = Number(capacity);

    if (!Number.isFinite(slotMin) || slotMin <= 0) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Slot minutes must be a positive number',
        details: {
          field: 'slotMinutes',
          received: slotMinutes,
          expected: 'positive number'
        }
      });
    }

    if (!Number.isFinite(cap) || cap <= 0) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Capacity must be a positive number',
        details: {
          field: 'capacity',
          received: capacity,
          expected: 'positive number'
        }
      });
    }

    // Validate date
    const dateObj = new Date(date);
    if (isNaN(dateObj)) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid date format',
        details: {
          field: 'date',
          received: date,
          expected: 'valid YYYY-MM-DD date'
        }
      });
    }

    // Get doctor info
    const doctor = await getDoctor(doctorId);
    if (!doctor) {
      return res.status(404).json({
        error: 'doctor_not_found',
        message: `Doctor with ID ${doctorId} not found`,
        data: {
          doctor_id: doctorId
        }
      });
    }

    // Check availability
    const result = await computeDayAvailability({ date, slotMinutes: slotMin, capacity: cap, doctorId });
    
    // Check if doctor is working on this date
    dateObj.setHours(0, 0, 0, 0);
    const wh = await getDoctorWorkHoursForDate(doctorId, dateObj);
    
    if (!wh) {
      return res.json({
        success: true,
        message: 'Doctor is not working on this date',
        data: {
          doctor_id: doctorId,
          doctor_name: doctor.name,
          date: date,
          working: false,
          available_slots: [],
          total_slots: 0,
          reason: 'not_working_today'
        }
      });
    }

    const availableSlots = Array.isArray(result.free) ? result.free : [];
    const totalSlots = availableSlots.length;

    res.json({
      success: true,
      message: totalSlots > 0 
        ? `Found ${totalSlots} available slot(s) for ${doctor.name} on ${date}`
        : `No available slots for ${doctor.name} on ${date}`,
      data: {
        doctor_id: doctorId,
        doctor_name: doctor.name,
        date: date,
        working: true,
        work_hours: {
          start: wh.start_time,
          end: wh.end_time
        },
        slot_minutes: slotMin,
        capacity: cap,
        available_slots: availableSlots,
        total_slots: totalSlots,
        next_step: totalSlots > 0 ? 'choose_slot_and_book' : 'try_different_date'
      }
    });

  } catch (err) {
    console.error('Error checking day availability:', err);
    res.status(500).json({
      error: 'internal_server_error',
      message: 'Failed to check day availability',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

export default router;