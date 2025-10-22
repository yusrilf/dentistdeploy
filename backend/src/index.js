import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDatabase } from './lib/db.js';
import { initUserTable } from './services/userService.js';
import { initBookingsTable, seedBookingsIfEmpty } from './services/bookingService.js';
import { initServicesTable, seedServicesIfEmpty } from './services/serviceService.js';
import { initDoctorsTable, initDoctorServicesTable, initDoctorWorkHoursTable, seedDoctorsIfEmpty } from './services/doctorService.js';
import bookingsRouter from './routes/bookings.js';
import authRouter from './routes/auth.js';
import calendarRouter from './routes/calendar.js';
import servicesRouter from './routes/services.js';
import doctorsRouter from './routes/doctors.js';

dotenv.config();

async function start() {
  try {
    await initDatabase();
    await initUserTable();
    await initBookingsTable();
    await seedBookingsIfEmpty();
    await initServicesTable();
    await seedServicesIfEmpty();
    await initDoctorsTable();
    await initDoctorServicesTable();
    await initDoctorWorkHoursTable();
    await seedDoctorsIfEmpty();

    const app = express();

    const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:5174,http://localhost:5175').split(',')
    app.use(cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true)
        if (allowedOrigins.includes(origin)) return callback(null, true)
        return callback(null, false)
      },
      credentials: true,
    }));
    app.use(express.json());

    app.get('/health', (req, res) => res.json({ ok: true }));

    // Mount all routes under /api prefix only
    app.use('/api/auth', authRouter);
    app.use('/api/bookings', bookingsRouter);
    app.use('/api/calendar', calendarRouter);
    app.use('/api/services', servicesRouter);
    app.use('/api/doctors', doctorsRouter);

    const port = process.env.PORT || 3001;
    app.listen(port, () => {
      console.log(`Server running on http://localhost:${port}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();