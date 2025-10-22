import { Router } from 'express';
import { authenticate } from '../services/userService.js';

const router = Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }
  try {
    const user = await authenticate(username, password);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    return res.json({ ok: true, user });
  } catch (e) {
    console.error('Login error', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;