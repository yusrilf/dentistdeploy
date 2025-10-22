import { getPool } from '../lib/db.js'

export async function initServicesTable() {
  const pool = getPool()
  await pool.query(`
    CREATE TABLE IF NOT EXISTS services (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) UNIQUE NOT NULL,
      description TEXT NULL,
      durationMinutes INT NOT NULL DEFAULT 30,
      active TINYINT(1) NOT NULL DEFAULT 1,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `)
}

export async function seedServicesIfEmpty() {
  const pool = getPool()
  const [rows] = await pool.query('SELECT COUNT(*) AS cnt FROM services')
  const count = rows?.[0]?.cnt || 0
  if (count > 0) return

  const defaults = [
    { name: 'Scaling', description: 'Pembersihan plak/karang gigi', durationMinutes: 30, active: 1 },
    { name: 'Tambal Gigi', description: 'Perbaikan gigi berlubang', durationMinutes: 45, active: 1 },
    { name: 'Cabut Gigi', description: 'Ekstraksi gigi', durationMinutes: 60, active: 1 },
    { name: 'Pembersihan Karang', description: 'Detartrasi', durationMinutes: 30, active: 1 },
    { name: 'Konsultasi', description: 'Konsultasi umum', durationMinutes: 20, active: 1 },
  ]

  const sql = `INSERT INTO services (name, description, durationMinutes, active) VALUES (?, ?, ?, ?)`
  for (const s of defaults) {
    await pool.query(sql, [s.name, s.description, s.durationMinutes, s.active])
  }
  console.log(`Seed services berhasil: ${defaults.length} rows`)
}

export async function listServices() {
  const pool = getPool()
  const [rows] = await pool.query('SELECT * FROM services ORDER BY name ASC')
  return rows || []
}

export async function getService(id) {
  const pool = getPool()
  const [rows] = await pool.query('SELECT * FROM services WHERE id = ?', [id])
  return rows?.[0] || null
}

export async function createService(data) {
  const pool = getPool()
  const sql = `INSERT INTO services (name, description, durationMinutes, active) VALUES (?, ?, ?, ?)`
  const duration = Number(data.durationMinutes ?? 30)
  const active = data.active === undefined ? 1 : (data.active ? 1 : 0)
  const [res] = await pool.query(sql, [data.name, data.description ?? null, duration, active])
  return await getService(res.insertId)
}

export async function updateServiceDb(id, changes) {
  const pool = getPool()
  const allowed = ['name','description','durationMinutes','active']
  const keys = Object.keys(changes).filter(k => allowed.includes(k))
  if (keys.length === 0) return await getService(id)
  const sets = keys.map(k => `${k} = ?`).join(', ')
  const vals = keys.map(k => {
    const v = changes[k]
    if (k === 'durationMinutes') return Number(v)
    if (k === 'active') return v ? 1 : 0
    return v
  })
  await pool.query(`UPDATE services SET ${sets} WHERE id = ?`, [...vals, id])
  return await getService(id)
}

export async function deleteServiceDb(id) {
  const pool = getPool()
  await pool.query('DELETE FROM services WHERE id = ?', [id])
  return { ok: true }
}