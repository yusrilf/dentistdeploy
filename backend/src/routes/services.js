import express from 'express'
import { listServices, getService, createService, updateServiceDb, deleteServiceDb } from '../services/serviceService.js'

const router = express.Router()

// GET /services
router.get('/', async (req, res) => {
  try {
    const rows = await listServices()
    res.json(rows)
  } catch (e) {
    console.error('GET /services error', e)
    res.status(500).json({ error: 'Failed to list services' })
  }
})

// GET /services/:id
router.get('/:id', async (req, res) => {
  try {
    const row = await getService(req.params.id)
    if (!row) return res.status(404).json({ error: 'Not found' })
    res.json(row)
  } catch (e) {
    console.error('GET /services/:id error', e)
    res.status(500).json({ error: 'Failed to get service' })
  }
})

// POST /services
router.post('/', async (req, res) => {
  try {
    const created = await createService(req.body)
    res.status(201).json(created)
  } catch (e) {
    console.error('POST /services error', e)
    res.status(500).json({ error: 'Failed to create service' })
  }
})

// PUT /services/:id
router.put('/:id', async (req, res) => {
  try {
    const updated = await updateServiceDb(req.params.id, req.body)
    res.json(updated)
  } catch (e) {
    console.error('PUT /services/:id error', e)
    res.status(500).json({ error: 'Failed to update service' })
  }
})

// DELETE /services/:id
router.delete('/:id', async (req, res) => {
  try {
    await deleteServiceDb(req.params.id)
    res.json({ ok: true })
  } catch (e) {
    console.error('DELETE /services/:id error', e)
    res.status(500).json({ error: 'Failed to delete service' })
  }
})

export default router