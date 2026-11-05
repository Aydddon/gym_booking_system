const express = require('express');
const cors = require('cors');
const pool = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

// 1. Получить список доступных тренировок с остатком мест
app.get('/api/sessions', async (req, res) => {
  try {
    const query = `
      SELECT ts.*, 
             (ts.Capacity - COUNT(b.Booking_ID)) AS remaining_places
      FROM Training_Sessions ts
      LEFT JOIN Bookings b ON ts.Session_ID = b.Session_ID
      GROUP BY ts.Session_ID
      ORDER BY ts.Date_Time ASC;
    `;
    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error loading sessions' });
  }
});

// 2. Создание бронирования (Атомарная транзакция)
app.post('/api/bookings', async (req, res) => {
  const { member_id, session_id } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN'); // Начало транзакции

    // Проверка емкости зала
    const sessionCheck = await client.query(
      `SELECT Capacity, 
              (SELECT COUNT(*) FROM Bookings WHERE Session_ID = $1) AS booked_count 
       FROM Training_Sessions WHERE Session_ID = $1 FOR UPDATE`,
      [session_id]
    );

    if (sessionCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Session not found' });
    }

    const { capacity, booked_count } = sessionCheck.rows[0];

    if (parseInt(booked_count) >= parseInt(capacity)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'No available places left in this session' });
    }

    // Сохранение бронирования
    const newBooking = await client.query(
      `INSERT INTO Bookings (Member_ID, Session_ID, Status) 
       VALUES ($1, $2, 'Confirmed') RETURNING *`,
      [member_id, session_id]
    );

    await client.query('COMMIT'); // Подтверждение транзакции
    res.status(201).json({ 
      message: 'Quest Accepted! Booking confirmed.', 
      booking: newBooking.rows[0] 
    });

  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') { // Код ошибки уникальности PostgreSQL
      return res.status(400).json({ message: 'You have already booked this session!' });
    }
    console.error(err);
    res.status(500).json({ error: 'Transaction failed, rolled back.' });
  } finally {
    client.release();
  }
});

// 3. Дашборд Business Intelligence (Заполненость слотов)
app.get('/api/analytics/fill-rate', async (req, res) => {
  try {
    const query = `
      SELECT ts.Session_ID, ts.Session_Name, ts.Capacity,
             COUNT(b.Booking_ID) AS Booked_Count,
             ROUND((COUNT(b.Booking_ID)::NUMERIC / ts.Capacity) * 100, 2) AS fill_rate
      FROM Training_Sessions ts
      LEFT JOIN Bookings b ON ts.Session_ID = b.Session_ID
      GROUP BY ts.Session_ID;
    `;
    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Gym Booking API running on port ${PORT}`));