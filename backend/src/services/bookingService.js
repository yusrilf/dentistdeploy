import { getPool } from '../lib/db.js'

export async function initBookingsTable() {
  const pool = getPool()
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bookings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      patient VARCHAR(100) NOT NULL,
      gender VARCHAR(20) NOT NULL,
      nik VARCHAR(20),
      relation VARCHAR(50),
      familyHead VARCHAR(100),
      address TEXT,
      birthPlace VARCHAR(100),
      dob DATE NULL,
      maritalStatus VARCHAR(50),
      job VARCHAR(100),
      education VARCHAR(20),
      phone VARCHAR(20),
      service VARCHAR(50),
      doctor_id INT NULL,
      bookingDateTime DATETIME NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      status ENUM('pending','approved','rejected') DEFAULT 'pending'
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `)
  // Ensure column doctor_id exists for previously created tables (compat with older MySQL)
  const [cols] = await pool.query('SHOW COLUMNS FROM bookings LIKE "doctor_id"')
  if (!Array.isArray(cols) || cols.length === 0) {
    await pool.query('ALTER TABLE bookings ADD COLUMN doctor_id INT NULL')
  }
}

const DUMMY_NAMES = [
  'Asep','Saiful','Ujang','Budi','Siti','Aisyah','Dewi','Dian','Rizal','Ahmad','Rudi','Rina',
  'Yusuf','Hendra','Nina','Tono','Tini','Wawan','Gita','Riska'
]
const BIRTH_PLACES = ['Gresik','Surabaya','Lamongan','Sidoarjo','Bojonegoro']
const JOBS = ['Karyawan','Wiraswasta','Pelajar','Ibu Rumah Tangga','PNS']
const EDUCATIONS = ['SD','SMP','SMA','D3','S1']
const SERVICES = ['Scaling','Tambal Gigi','Cabut Gigi','Pembersihan Karang','Konsultasi']

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomDigits(len) {
  let s = ''
  for (let i = 0; i < len; i++) s += String(randomInt(0, 9))
  return s
}

export async function seedBookingsIfEmpty() {
  const pool = getPool()
  const [rows] = await pool.query('SELECT COUNT(*) AS cnt FROM bookings')
  const count = rows?.[0]?.cnt || 0
  if (count > 0) return

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const items = []
  for (let day = 1; day <= daysInMonth; day++) {
    const perDay = randomInt(0, 3)
    for (let j = 0; j < perDay; j++) {
      const bookingDateTime = new Date(year, month, day, 9 + j)
      const createdAt = new Date(bookingDateTime.getTime() - randomInt(1, 48) * 60 * 60 * 1000)
      const ageYears = randomInt(6, 65)
      const ageMonths = randomInt(0, 11)
      const ageDays = randomInt(0, 30)
      const dob = new Date(now)
      dob.setFullYear(dob.getFullYear() - ageYears)
      dob.setMonth(dob.getMonth() - ageMonths)
      dob.setDate(dob.getDate() - ageDays)
      const gender = Math.random() < 0.5 ? 'Laki-laki' : 'Perempuan'
      const service = SERVICES[randomInt(0, SERVICES.length - 1)]
      const name = DUMMY_NAMES[randomInt(0, DUMMY_NAMES.length - 1)]
      const nik = '3515' + randomDigits(12)
      const relationChoices = ['Suami','Istri','Anak-ke 1','Anak-ke 2','Anak-ke 3']
      const relation = relationChoices[randomInt(0, relationChoices.length - 1)]
      const familyHead = DUMMY_NAMES[randomInt(0, DUMMY_NAMES.length - 1)]
      const address = `Jl. ${DUMMY_NAMES[randomInt(0, DUMMY_NAMES.length - 1)]} No. ${randomInt(1, 200)}, Gresik, Jawa Timur`
      const birthPlace = BIRTH_PLACES[randomInt(0, BIRTH_PLACES.length - 1)]
      const maritalStatus = ageYears < 18 ? 'Belum Menikah' : (Math.random() < 0.6 ? 'Menikah' : 'Belum Menikah')
      const job = JOBS[randomInt(0, JOBS.length - 1)]
      const education = EDUCATIONS[randomInt(0, EDUCATIONS.length - 1)]
      const phone = '08' + randomDigits(10)
      const status = Math.random() < 0.6 ? 'pending' : 'approved'
      items.push({ patient: name, gender, nik, relation, familyHead, address, birthPlace, dob, maritalStatus, job, education, phone, service, bookingDateTime, createdAt, status })
    }
  }

  const sql = `INSERT INTO bookings (patient, gender, nik, relation, familyHead, address, birthPlace, dob, maritalStatus, job, education, phone, service, bookingDateTime, createdAt, status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  for (const it of items) {
    await pool.query(sql, [
      it.patient, it.gender, it.nik, it.relation, it.familyHead, it.address, it.birthPlace,
      it.dob.toISOString().slice(0, 10), it.maritalStatus, it.job, it.education, it.phone, it.service,
      formatDateTime(it.bookingDateTime), formatDateTime(it.createdAt), it.status
    ])
  }
  console.log(`Seed bookings berhasil: ${items.length} rows`)
}

function pad2(n) { return String(n).padStart(2, '0') }
function formatDateTime(d) {
  const y = d.getFullYear(); const m = pad2(d.getMonth() + 1); const day = pad2(d.getDate())
  const hh = pad2(d.getHours()); const mm = pad2(d.getMinutes()); const ss = pad2(d.getSeconds())
  return `${y}-${m}-${day} ${hh}:${mm}:${ss}`
}

export async function listBookings() {
  const pool = getPool()
  const [rows] = await pool.query(`
    SELECT 
      b.*,
      d.name as doctor_name,
      d.specialization as doctor_specialization
    FROM bookings b
    LEFT JOIN doctors d ON b.doctor_id = d.id
    ORDER BY b.createdAt DESC
  `)
  
  // Debug logging
  console.log('listBookings query result sample:', rows?.[0])
  
  return rows
}

export async function getBooking(id) {
  const pool = getPool()
  const [rows] = await pool.query(`
    SELECT 
      b.*,
      d.name as doctor_name,
      d.specialization as doctor_specialization
    FROM bookings b
    LEFT JOIN doctors d ON b.doctor_id = d.id
    WHERE b.id = ?
  `, [id])
  
  // Debug logging
  console.log('getBooking query result:', rows?.[0])
  
  return rows?.[0] || null
}

export async function createBooking(data) {
  const pool = getPool()
  
  // Validasi field wajib
  if (!data.patient) {
    throw new Error('Field patient wajib diisi')
  }
  if (!data.phone) {
    throw new Error('Field phone wajib diisi')
  }
  if (!data.service) {
    throw new Error('Field service wajib diisi')
  }
  if (!data.bookingDateTime) {
    throw new Error('Field bookingDateTime wajib diisi')
  }

  const sql = `INSERT INTO bookings (patient, gender, nik, relation, familyHead, address, birthPlace, dob, maritalStatus, job, education, phone, service, doctor_id, bookingDateTime, createdAt, status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  
  const createdAt = data.createdAt ? new Date(data.createdAt) : new Date()
  const bookingDateTime = data.bookingDateTime ? new Date(data.bookingDateTime) : new Date()
  const dob = data.dob ? new Date(data.dob) : null
  
  const params = [
    data.patient,
    data.gender || 'Laki-laki', // Default gender
    data.nik || null,
    data.relation || null,
    data.familyHead || null,
    data.address || null,
    data.birthPlace || null,
    dob ? dob.toISOString().slice(0, 10) : null,
    data.maritalStatus || 'Belum Menikah', // Default marital status
    data.job || null,
    data.education || null,
    data.phone,
    data.service,
    data.doctor_id || null,
    formatDateTime(bookingDateTime),
    formatDateTime(createdAt),
    data.status || 'pending'
  ]
  
  try {
    const [res] = await pool.query(sql, params)
    return await getBooking(res.insertId)
  } catch (error) {
    console.error('Error creating booking:', error)
    throw new Error('Gagal membuat booking: ' + error.message)
  }
}

export async function updateBookingDb(id, changes) {
  const pool = getPool()
  const allowed = ['patient','gender','nik','relation','familyHead','address','birthPlace','dob','maritalStatus','job','education','phone','service','doctor_id','bookingDateTime','createdAt','status']
  const keys = Object.keys(changes).filter(k => allowed.includes(k))
  if (keys.length === 0) return await getBooking(id)
  const sets = keys.map(k => `${k} = ?`).join(', ')
  const vals = keys.map(k => {
    const v = changes[k]
    if (k === 'dob' && v) return new Date(v).toISOString().slice(0,10)
    if ((k === 'bookingDateTime' || k === 'createdAt') && v) return formatDateTime(new Date(v))
    return v
  })
  await pool.query(`UPDATE bookings SET ${sets} WHERE id = ?`, [...vals, id])
  return await getBooking(id)
}

export async function deleteBookingDb(id) {
  const pool = getPool()
  await pool.query('DELETE FROM bookings WHERE id = ?', [id])
  return { ok: true }
}