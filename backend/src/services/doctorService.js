import { getPool } from '../lib/db.js';

export async function initDoctorsTable() {
  const pool = await getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS doctors (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      specialization VARCHAR(255) NULL,
      description TEXT NULL,
      active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
  `);
}

export async function initDoctorServicesTable() {
  const pool = await getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS doctor_services (
      id INT AUTO_INCREMENT PRIMARY KEY,
      doctor_id INT NOT NULL,
      service_id INT NOT NULL,
      UNIQUE KEY uniq_doctor_service (doctor_id, service_id)
    ) ENGINE=InnoDB;
  `);
}

export async function initDoctorWorkHoursTable() {
  const pool = await getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS doctor_work_hours (
      id INT AUTO_INCREMENT PRIMARY KEY,
      doctor_id INT NOT NULL,
      day_of_week TINYINT NOT NULL,
      start_time VARCHAR(5) NOT NULL,
      end_time VARCHAR(5) NOT NULL,
      UNIQUE KEY uniq_doctor_day (doctor_id, day_of_week)
    ) ENGINE=InnoDB;
  `);
}

export async function seedDoctorsIfEmpty() {
  const pool = await getPool();
  const [rows] = await pool.query('SELECT COUNT(*) AS cnt FROM doctors');
  if (rows[0].cnt === 0) {
    await pool.query(
      'INSERT INTO doctors (name, specialization, description, active) VALUES (?, ?, ?, ?), (?, ?, ?, ?)',
      [
        'Drg. Andi', 'Konservasi Gigi', 'Dokter gigi umum fokus tambal gigi dan pembersihan karang.', 1,
        'Drg. Bunga', 'Bedah Mulut', 'Spesialis cabut gigi sulit dan tindakan pembedahan minor.', 1,
      ]
    );
  }

  // Seed basic work hours: Mon-Fri 09:00-17:00 for each doctor if empty
  const [docs] = await pool.query('SELECT id FROM doctors');
  for (const doc of docs) {
    const [wh] = await pool.query('SELECT COUNT(*) AS cnt FROM doctor_work_hours WHERE doctor_id = ?', [doc.id]);
    if (wh[0].cnt === 0) {
      const entries = [1, 2, 3, 4, 5].map(dow => [doc.id, dow, '09:00', '17:00']);
      await pool.query(
        'INSERT INTO doctor_work_hours (doctor_id, day_of_week, start_time, end_time) VALUES ' +
          entries.map(() => '(?, ?, ?, ?)').join(', '),
        entries.flat()
      );
    }
  }
}

export async function listDoctors() {
  const pool = await getPool();
  const [rows] = await pool.query('SELECT * FROM doctors ORDER BY id DESC');
  return rows;
}

export async function getDoctor(id) {
  const pool = await getPool();
  const [rows] = await pool.query('SELECT * FROM doctors WHERE id = ?', [id]);
  return rows[0] || null;
}

export async function createDoctor(data) {
  const pool = await getPool();
  const { name, specialization = null, description = null, active = 1 } = data;
  const [res] = await pool.query(
    'INSERT INTO doctors (name, specialization, description, active) VALUES (?, ?, ?, ?)',
    [name, specialization, description, active ? 1 : 0]
  );
  return getDoctor(res.insertId);
}

export async function updateDoctorDb(id, data) {
  const pool = await getPool();
  const fields = [];
  const values = [];
  const allowed = ['name', 'specialization', 'description', 'active'];
  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields.push(`${key} = ?`);
      if (key === 'active') values.push(data[key] ? 1 : 0); else values.push(data[key]);
    }
  }
  if (fields.length === 0) return getDoctor(id);
  await pool.query(`UPDATE doctors SET ${fields.join(', ')} WHERE id = ?`, [...values, id]);
  return getDoctor(id);
}

export async function deleteDoctorDb(id) {
  const pool = await getPool();
  await pool.query('DELETE FROM doctor_services WHERE doctor_id = ?', [id]);
  await pool.query('DELETE FROM doctor_work_hours WHERE doctor_id = ?', [id]);
  const [res] = await pool.query('DELETE FROM doctors WHERE id = ?', [id]);
  return { success: res.affectedRows > 0 };
}

export async function listDoctorServices(doctorId) {
  const pool = await getPool();
  const [rows] = await pool.query(
    'SELECT s.* FROM doctor_services ds JOIN services s ON s.id = ds.service_id WHERE ds.doctor_id = ? ORDER BY s.name ASC',
    [doctorId]
  );
  return rows;
}

export async function setDoctorServices(doctorId, serviceIds = []) {
  const pool = await getPool();
  await pool.query('DELETE FROM doctor_services WHERE doctor_id = ?', [doctorId]);
  if (Array.isArray(serviceIds) && serviceIds.length > 0) {
    const values = serviceIds.map(sid => [doctorId, sid]);
    await pool.query(
      'INSERT INTO doctor_services (doctor_id, service_id) VALUES ' + values.map(() => '(?, ?)').join(', '),
      values.flat()
    );
  }
  return listDoctorServices(doctorId);
}

export async function listDoctorWorkHours(doctorId) {
  const pool = await getPool();
  const [rows] = await pool.query(
    'SELECT day_of_week, start_time, end_time FROM doctor_work_hours WHERE doctor_id = ? ORDER BY day_of_week ASC',
    [doctorId]
  );
  return rows;
}

export async function setDoctorWorkHours(doctorId, entries = []) {
  const pool = await getPool();
  await pool.query('DELETE FROM doctor_work_hours WHERE doctor_id = ?', [doctorId]);
  const valid = entries.filter(e => e && typeof e.day_of_week === 'number' && e.start_time && e.end_time);
  if (valid.length > 0) {
    const values = valid.map(e => [doctorId, e.day_of_week, e.start_time, e.end_time]);
    await pool.query(
      'INSERT INTO doctor_work_hours (doctor_id, day_of_week, start_time, end_time) VALUES ' + values.map(() => '(?, ?, ?, ?)').join(', '),
      values.flat()
    );
  }
  return listDoctorWorkHours(doctorId);
}

export async function getDoctorWorkHoursForDate(doctorId, dateObj) {
  const pool = await getPool();
  const dow = dateObj.getDay(); // 0-6 (Sun-Sat)
  const [rows] = await pool.query(
    'SELECT start_time, end_time FROM doctor_work_hours WHERE doctor_id = ? AND day_of_week = ?',
    [doctorId, dow]
  );
  if (!rows[0]) return null;
  return { start_time: rows[0].start_time, end_time: rows[0].end_time };
}

// ESM named exports are defined above

/**
 * Filter doctors by service name or specialization
 * @param {string} serviceName - Name of the service to filter by
 * @returns {Array} Array of doctors that provide the specified service
 */
export async function filterDoctorsByService(serviceName) {
  try {
    const pool = await getPool();
    
    // Query to get doctors that provide a specific service
    const [rows] = await pool.query(`
      SELECT DISTINCT d.id, d.name, d.specialization, d.description, d.active
      FROM doctors d
      LEFT JOIN doctor_services ds ON d.id = ds.doctor_id
      LEFT JOIN services s ON ds.service_id = s.id
      WHERE d.active = 1 
        AND (
          LOWER(s.name) LIKE LOWER(?) 
          OR LOWER(d.specialization) LIKE LOWER(?)
          OR LOWER(s.description) LIKE LOWER(?)
        )
      ORDER BY d.name ASC
    `, [`%${serviceName}%`, `%${serviceName}%`, `%${serviceName}%`]);
    
    // Get services for each doctor
    const doctorsWithServices = await Promise.all(
      rows.map(async (doctor) => {
        const services = await listDoctorServices(doctor.id);
        return {
          ...doctor,
          services: services.map(s => ({ id: s.id, name: s.name, description: s.description }))
        };
      })
    );
    
    return doctorsWithServices;
  } catch (error) {
    console.error('Error filtering doctors by service:', error);
    throw new Error('Gagal memfilter dokter berdasarkan layanan');
  }
}

/**
 * Find doctor by name (exact or partial match)
 * @param {string} doctorName - Name of the doctor to search for
 * @returns {Object|null} Doctor object if found, null otherwise
 */
export async function findDoctorByName(doctorName) {
  try {
    const pool = await getPool();
    
    // First try exact match
    let [rows] = await pool.query(
      'SELECT * FROM doctors WHERE LOWER(name) = LOWER(?) AND active = 1',
      [doctorName.trim()]
    );
    
    // If no exact match, try partial match
    if (rows.length === 0) {
      [rows] = await pool.query(
        'SELECT * FROM doctors WHERE LOWER(name) LIKE LOWER(?) AND active = 1 ORDER BY name ASC',
        [`%${doctorName.trim()}%`]
      );
    }
    
    if (rows.length === 0) {
      return null;
    }
    
    // If multiple matches, return the first one with services
    const doctor = rows[0];
    const services = await listDoctorServices(doctor.id);
    
    return {
      ...doctor,
      services: services.map(s => ({ id: s.id, name: s.name, description: s.description }))
    };
  } catch (error) {
    console.error('Error finding doctor by name:', error);
    throw new Error('Gagal mencari dokter berdasarkan nama');
  }
}

/**
 * Get all doctors with their services (for AI Agent tools)
 * @param {boolean} activeOnly - Whether to return only active doctors
 * @returns {Array} Array of doctors with their services
 */
export async function getDoctorsWithServices(activeOnly = true) {
  try {
    const pool = await getPool();
    
    const whereClause = activeOnly ? 'WHERE d.active = 1' : '';
    const [rows] = await pool.query(`
      SELECT d.id, d.name, d.specialization, d.description, d.active
      FROM doctors d
      ${whereClause}
      ORDER BY d.name ASC
    `);
    
    // Get services for each doctor
    const doctorsWithServices = await Promise.all(
      rows.map(async (doctor) => {
        const services = await listDoctorServices(doctor.id);
        return {
          ...doctor,
          services: services.map(s => ({ id: s.id, name: s.name, description: s.description }))
        };
      })
    );
    
    return doctorsWithServices;
  } catch (error) {
    console.error('Error getting doctors with services:', error);
    throw new Error('Gagal mengambil data dokter dengan layanan');
  }
}