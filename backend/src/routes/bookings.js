import express from 'express'
import { listBookings, getBooking, createBooking, updateBookingDb, deleteBookingDb } from '../services/bookingService.js'

const router = express.Router()

router.get('/', async (req, res) => {
  try {
    const rows = await listBookings()
    res.json(rows)
  } catch (e) {
    console.error('GET /bookings error', e)
    res.status(500).json({ error: 'Failed to list bookings' })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const row = await getBooking(req.params.id)
    if (!row) return res.status(404).json({ error: 'Not found' })
    res.json(row)
  } catch (e) {
    console.error('GET /bookings/:id error', e)
    res.status(500).json({ error: 'Failed to get booking' })
  }
})

router.post('/', async (req, res) => {
  try {
    const created = await createBooking(req.body)
    res.status(201).json(created)
  } catch (e) {
    console.error('POST /bookings error', e)
    res.status(500).json({ error: 'Failed to create booking' })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const updated = await updateBookingDb(req.params.id, req.body)
    res.json(updated)
  } catch (e) {
    console.error('PUT /bookings/:id error', e)
    res.status(500).json({ error: 'Failed to update booking' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    await deleteBookingDb(req.params.id)
    res.json({ ok: true })
  } catch (e) {
    console.error('DELETE /bookings/:id error', e)
    res.status(500).json({ error: 'Failed to delete booking' })
  }
})

export default router