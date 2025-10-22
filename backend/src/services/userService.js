import bcrypt from 'bcryptjs';
import { getPool } from '../lib/db.js';

export async function initUserTable() {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'admin',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  const [rows] = await pool.query('SELECT COUNT(*) AS count FROM users WHERE username = ?', ['admin']);
  const count = rows[0]?.count || 0;
  if (count === 0) {
    const hash = await bcrypt.hash('admin', 10);
    await pool.query('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)', ['admin', hash, 'admin']);
    console.log('Seed user admin/admin berhasil dibuat');
  }
}

export async function authenticate(username, password) {
  const pool = getPool();
  const [rows] = await pool.query('SELECT id, username, password_hash, role FROM users WHERE username = ?', [username]);
  if (!rows || rows.length === 0) return null;
  const user = rows[0];
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return null;
  return { id: user.id, username: user.username, role: user.role };
}