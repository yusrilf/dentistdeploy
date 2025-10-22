import { getPool } from '../lib/db.js';
import { getDoctorWorkHoursForDate } from './doctorService.js';

function pad2(n) { return String(n).padStart(2, '0'); }
function formatDate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function parseTime(str) {
  const [h, m] = String(str).split(':').map(v => parseInt(v, 10));
  return { h: isNaN(h) ? 0 : h, m: isNaN(m) ? 0 : m };
}
function setTime(date, h, m) {
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
}
function addMinutes(date, mins) {
  return new Date(date.getTime() + mins * 60000);
}

function formatDateTime(d) {
  const y = d.getFullYear(); const m = pad2(d.getMonth() + 1); const day = pad2(d.getDate());
  const hh = pad2(d.getHours()); const mm = pad2(d.getMinutes()); const ss = pad2(d.getSeconds());
  return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
}

export async function listBookingsInRange(start, end, statuses, doctorId = null) {
  const pool = getPool();
  const st = Array.isArray(statuses) && statuses.length > 0 ? statuses : ['approved', 'pending'];
  const placeholders = st.map(() => '?').join(',');
  let sql = `SELECT id, bookingDateTime, status, doctor_id
             FROM bookings
             WHERE bookingDateTime >= ? AND bookingDateTime < ?
               AND status IN (${placeholders})`;
  const params = [formatDateTime(start), formatDateTime(end), ...st];
  if (doctorId !== null && doctorId !== undefined) {
    sql += ' AND doctor_id = ?';
    params.push(doctorId);
  }
  const [rows] = await pool.query(sql, params);
  return rows || [];
}

export async function computeNextDaysAvailability({
  daysAhead = 7,
  workStart = '09:00',
  workEnd = '17:00',
  slotMinutes = 30,
  includePending = true,
  capacity = 1,
}) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const rangeStart = new Date(now);
  const rangeEnd = new Date(now);
  rangeEnd.setDate(rangeEnd.getDate() + daysAhead + 1); // exclusive end

  const statuses = ['approved'];
  if (includePending) statuses.push('pending');
  const bookings = await listBookingsInRange(rangeStart, rangeEnd, statuses);

  // index bookings by date string
  const byDay = {};
  for (const b of bookings) {
    const dt = new Date(b.bookingDateTime);
    const key = formatDate(dt);
    if (!byDay[key]) byDay[key] = [];
    byDay[key].push({ _dt: dt, status: b.status });
}
  const { h: sh, m: sm } = parseTime(workStart);
  const { h: eh, m: em } = parseTime(workEnd);

  const days = [];
  for (let i = 0; i <= daysAhead; i++) { // include today + N days ahead
    const dateObj = new Date(rangeStart);
    dateObj.setDate(rangeStart.getDate() + i);
    const dateStr = formatDate(dateObj);
    const dayStart = setTime(dateObj, sh, sm);
    const dayEnd = setTime(dateObj, eh, em);

    const bookedToday = (byDay[dateStr] || []).filter(b => (b._dt >= dayStart && b._dt < dayEnd));

    const free = [];
    for (let t = new Date(dayStart); addMinutes(t, slotMinutes) <= dayEnd; t = addMinutes(t, slotMinutes)) {
      const slotStart = new Date(t);
      const slotEnd = addMinutes(slotStart, slotMinutes);
      const countInSlot = bookedToday.filter(b => (b._dt >= slotStart && b._dt < slotEnd)).length;
      if (countInSlot < Number(capacity || 1)) {
        free.push(`${pad2(slotStart.getHours())}:${pad2(slotStart.getMinutes())}-${pad2(slotEnd.getHours())}:${pad2(slotEnd.getMinutes())}`);
      }
    }

    days.push({ date: dateStr, free });
  }

  return { days };
}

export async function computeDayAvailability({
  date, // 'YYYY-MM-DD' optional
  year, month, day, // alternative components
  workStart = '09:00',
  workEnd = '17:00',
  slotMinutes = 30,
  includePending = true,
  capacity = 1,
  doctorId = null,
}) {
  let dateObj;
  if (date) {
    dateObj = new Date(date);
  } else if (year && month && day) {
    dateObj = new Date(Number(year), Number(month) - 1, Number(day));
  } else {
    throw new Error('date atau year+month+day wajib');
  }
  if (isNaN(dateObj)) throw new Error('Tanggal tidak valid');
  dateObj.setHours(0, 0, 0, 0);
  let wStart = workStart;
  let wEnd = workEnd;
  if (doctorId !== null && doctorId !== undefined) {
    const wh = await getDoctorWorkHoursForDate(Number(doctorId), dateObj);
    if (!wh) {
      // Dokter tidak masuk di hari ini
      return { date: formatDate(dateObj), free: [] };
    }
    wStart = wh.start_time;
    wEnd = wh.end_time;
  }

  const { h: sh, m: sm } = parseTime(wStart);
  const { h: eh, m: em } = parseTime(wEnd);
  const dayStart = setTime(dateObj, sh, sm);
  const dayEnd = setTime(dateObj, eh, em);

  const statuses = ['approved'];
  if (includePending) statuses.push('pending');
  const bookings = await listBookingsInRange(dayStart, dayEnd, statuses, doctorId);

  const free = [];
  for (let t = new Date(dayStart); addMinutes(t, slotMinutes) <= dayEnd; t = addMinutes(t, slotMinutes)) {
    const slotStart = new Date(t);
    const slotEnd = addMinutes(slotStart, slotMinutes);
    const countInSlot = bookings.filter(b => {
      const bd = new Date(b.bookingDateTime);
      return bd >= slotStart && bd < slotEnd;
    }).length;
    if (countInSlot < Number(capacity || 1)) {
      free.push(`${pad2(slotStart.getHours())}:${pad2(slotStart.getMinutes())}-${pad2(slotEnd.getHours())}:${pad2(slotEnd.getMinutes())}`);
    }
  }

  return { date: formatDate(dateObj), free };
}