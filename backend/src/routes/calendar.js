import express from 'express';
import { computeNextDaysAvailability, computeDayAvailability } from '../services/calendarService.js';

const router = express.Router();

// GET /calendar/availability
// Output: [{ date: 'YYYY-MM-DD', free: ['HH:mm-HH:mm', ...] }]
router.get('/availability', async (req, res) => {
  try {
    const daysAhead = Number(req.query.days ?? 7);
    const workStart = String(req.query.workStart ?? '09:00');
    const workEnd = String(req.query.workEnd ?? '17:00');
    const slotMinutes = Number(req.query.slotMinutes ?? 30);
    const includePending = String(req.query.includePending ?? '1') === '1';
    const capacity = Number(req.query.capacity ?? 1);

    const result = await computeNextDaysAvailability({
      daysAhead, workStart, workEnd, slotMinutes, includePending, capacity
    });

    // Format sesuai permintaan: Tanggal + daftar jam kosong saja, tanpa data pasien
    res.json(result.days);
  } catch (err) {
    res.status(500).json({ error: 'failed', detail: String(err && err.message || err) });
  }
});

export default router;

// GET /calendar/availability/day
// Query: date=YYYY-MM-DD atau year, month, day
// Output: { date: 'YYYY-MM-DD', free: ['HH:mm-HH:mm', ...] }
router.get('/availability/day', async (req, res) => {
  try {
    const date = req.query.date ? String(req.query.date) : undefined;
    const year = req.query.year ? Number(req.query.year) : undefined;
    const month = req.query.month ? Number(req.query.month) : undefined;
    const day = req.query.day ? Number(req.query.day) : undefined;

    if (!date && !(year && month && day)) {
      return res.status(400).json({ error: 'date atau year+month+day wajib' });
    }

    const workStart = String(req.query.workStart ?? '09:00');
    const workEnd = String(req.query.workEnd ?? '17:00');
    const slotMinutes = Number(req.query.slotMinutes ?? 30);
    const includePending = String(req.query.includePending ?? '1') === '1';
    const capacity = Number(req.query.capacity ?? 1);
    const doctorId = req.query.doctorId !== undefined ? Number(req.query.doctorId) : undefined;

    const result = await computeDayAvailability({
      date, year, month, day, workStart, workEnd, slotMinutes, includePending, capacity, doctorId
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'failed', detail: String(err && err.message || err) });
  }
});