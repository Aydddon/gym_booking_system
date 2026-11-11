require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const { isPositiveInteger, isValidPassword, signAuthToken, verifyAuthToken } = require('./lib/auth-utils');
const { rateLimit } = require('express-rate-limit');
const pool = require('./db');

const app = express();
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32) {
  console.error('Set JWT_SECRET to a random value of at least 32 characters in the project-root .env file (copy .env.example first).');
  process.exit(1);
}

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '32kb' }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Слишком много попыток. Подождите 15 минут и попробуйте снова.' },
});
const publicMemberFields = 'member_id, name, email, phone, membership_type, character_id, xp';
const issueToken = (member) => signAuthToken(member.member_id, jwtSecret);

function requireAuth(req, res, next) {
  const [scheme, token] = String(req.get('authorization') || '').split(' ');
  if (scheme !== 'Bearer' || !token) return res.status(401).json({ message: 'Войдите в аккаунт, чтобы продолжить' });
  try {
    req.memberId = verifyAuthToken(token, jwtSecret);
    return next();
  } catch {
    return res.status(401).json({ message: 'Сессия истекла. Войдите снова.' });
  }
}

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    return res.json({ status: 'ok' });
  } catch (error) {
    console.error('Health check failed:', error.message);
    return res.status(503).json({ message: 'База данных недоступна', status: 'database_unavailable' });
  }
});

app.post('/api/auth/register', authLimiter, async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';
  const membershipType = typeof req.body?.membership_type === 'string' ? req.body.membership_type.trim() : 'Standard';
  const password = req.body?.password;
  if (name.length < 2 || name.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 100 || phone.length < 5 || phone.length > 20) {
    return res.status(400).json({ message: 'Проверьте имя, email и телефон' });
  }
  if (!['Standard', 'Premium'].includes(membershipType)) return res.status(400).json({ message: 'Выберите доступный тип абонемента' });
  if (!isValidPassword(password)) return res.status(400).json({ message: 'Пароль должен содержать от 8 до 72 символов' });
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      `INSERT INTO members (name, email, phone, membership_type, password_hash)
       VALUES ($1, $2, $3, $4, $5) RETURNING ${publicMemberFields}`,
      [name, email, phone, membershipType, passwordHash]
    );
    return res.status(201).json({ message: 'Профиль создан', member: rows[0], token: issueToken(rows[0]) });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ message: 'Этот email уже зарегистрирован. Войдите в профиль или активируйте старый аккаунт.' });
    console.error('Registration failed:', error.message);
    return res.status(500).json({ message: 'Не удалось создать профиль' });
  }
});

app.post('/api/auth/activate', authLimiter, async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const phone = typeof req.body?.phone === 'string' ? req.body.phone.replace(/\D/g, '') : '';
  const password = req.body?.password;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 100 || phone.length < 5 || phone.length > 20 || !isValidPassword(password)) {
    return res.status(400).json({ message: 'Введите email, телефон и пароль не короче 8 символов' });
  }
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      `UPDATE members SET password_hash = $1
       WHERE LOWER(email) = $2 AND regexp_replace(phone, '[^0-9]', '', 'g') = $3
         AND password_hash IS NULL
       RETURNING ${publicMemberFields}`,
      [passwordHash, email, phone]
    );
    if (!rows.length) return res.status(409).json({ message: 'Аккаунт не найден или уже активирован. Попробуйте обычный вход.' });
    return res.json({ message: 'Старый профиль активирован', member: rows[0], token: issueToken(rows[0]) });
  } catch (error) {
    console.error('Account activation failed:', error.message);
    return res.status(500).json({ message: 'Не удалось активировать профиль' });
  }
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = req.body?.password;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 100 || typeof password !== 'string' || Buffer.byteLength(password, 'utf8') > 72) return res.status(400).json({ message: 'Введите email и пароль' });
  try {
    const { rows } = await pool.query(`SELECT ${publicMemberFields}, password_hash FROM members WHERE LOWER(email) = $1`, [email]);
    const member = rows[0];
    const matches = member?.password_hash ? await bcrypt.compare(password, member.password_hash) : false;
    if (!matches) return res.status(401).json({ message: 'Неверный email или пароль' });
    delete member.password_hash;
    return res.json({ message: 'Вход выполнен', member, token: issueToken(member) });
  } catch (error) {
    console.error('Login failed:', error.message);
    return res.status(500).json({ message: 'Не удалось выполнить вход' });
  }
});

app.get('/api/me', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT ${publicMemberFields} FROM members WHERE member_id = $1`, [req.memberId]);
    if (!rows.length) return res.status(404).json({ message: 'Профиль не найден' });
    return res.json({ member: rows[0] });
  } catch (error) {
    console.error('Profile load failed:', error.message);
    return res.status(500).json({ message: 'Не удалось загрузить профиль' });
  }
});

app.get('/api/sessions', async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT ts.session_id, ts.session_name, ts.coach, ts.date_time,
             ts.capacity, ts.duration, ts.category, ts.place,
             GREATEST(ts.capacity - COUNT(b.booking_id), 0)::int AS remaining_places
      FROM training_sessions ts
      LEFT JOIN bookings b ON b.session_id = ts.session_id AND b.status = 'Confirmed'
      GROUP BY ts.session_id ORDER BY ts.date_time ASC
    `);
    return res.json(rows);
  } catch (error) {
    console.error('Failed to load sessions:', error.message);
    return res.status(500).json({ message: 'Не удалось загрузить тренировки' });
  }
});

app.get('/api/members', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT m.member_id, m.name, m.character_id, m.xp,
             EXISTS (SELECT 1 FROM member_follows f WHERE f.follower_id = $1 AND f.following_id = m.member_id) AS is_following
      FROM members m WHERE m.member_id <> $1 ORDER BY m.xp DESC, m.name ASC
    `, [req.memberId]);
    return res.json({ members: rows });
  } catch (error) {
    console.error('Community load failed:', error.message);
    return res.status(500).json({ message: 'Не удалось загрузить участников' });
  }
});

app.get('/api/me/bookings', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT b.booking_id, b.session_id, b.booking_date, b.status, b.xp_awarded,
             ts.session_name, ts.date_time
      FROM bookings b JOIN training_sessions ts USING (session_id)
      WHERE b.member_id = $1 AND b.status = 'Confirmed' ORDER BY ts.date_time ASC
    `, [req.memberId]);
    return res.json(rows);
  } catch (error) {
    console.error('Member bookings load failed:', error.message);
    return res.status(500).json({ message: 'Не удалось загрузить расписание участника' });
  }
});

app.post('/api/follows', requireAuth, async (req, res) => {
  const followingId = req.body?.following_id;
  if (!isPositiveInteger(followingId) || followingId === req.memberId) return res.status(400).json({ message: 'Некорректный участник для подписки' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO member_follows (follower_id, following_id) VALUES ($1, $2)
       ON CONFLICT (follower_id, following_id) DO NOTHING RETURNING follow_id`,
      [req.memberId, followingId]
    );
    if (!rows.length) return res.status(200).json({ message: 'Вы уже подписаны на этого участника', followed: true });
    return res.status(201).json({ message: 'Подписка оформлена', followed: true, follow_id: rows[0].follow_id });
  } catch (error) {
    if (error.code === '23503') return res.status(404).json({ message: 'Участник не найден' });
    console.error('Follow failed:', error.message);
    return res.status(500).json({ message: 'Не удалось подписаться на участника' });
  }
});

app.delete('/api/follows/:followingId', requireAuth, async (req, res) => {
  const followingId = Number(req.params.followingId);
  if (!isPositiveInteger(followingId) || followingId === req.memberId) return res.status(400).json({ message: 'Некорректный участник' });
  try {
    const result = await pool.query('DELETE FROM member_follows WHERE follower_id = $1 AND following_id = $2', [req.memberId, followingId]);
    if (!result.rowCount) return res.status(404).json({ message: 'Подписка не найдена' });
    return res.json({ message: 'Подписка отменена', followed: false });
  } catch (error) {
    console.error('Unfollow failed:', error.message);
    return res.status(500).json({ message: 'Не удалось отменить подписку' });
  }
});

app.post('/api/bookings', requireAuth, async (req, res) => {
  const sessionId = req.body?.session_id;
  if (!isPositiveInteger(sessionId)) return res.status(400).json({ message: 'Укажите корректный session_id' });
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const { rows: sessionRows } = await client.query(
      'SELECT capacity, date_time FROM training_sessions WHERE session_id = $1 FOR UPDATE', [sessionId]
    );
    if (!sessionRows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Тренировка не найдена' });
    }
    if (new Date(sessionRows[0].date_time).getTime() <= Date.now()) {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: 'Нельзя записаться на уже прошедшую тренировку' });
    }
    const { rows: activeRows } = await client.query(
      "SELECT 1 FROM bookings WHERE member_id = $1 AND session_id = $2 AND status = 'Confirmed'",
      [req.memberId, sessionId]
    );
    if (activeRows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: 'Вы уже записаны на эту тренировку' });
    }
    const { rows: countRows } = await client.query(
      "SELECT COUNT(*)::int AS count FROM bookings WHERE session_id = $1 AND status = 'Confirmed'", [sessionId]
    );
    if (countRows[0].count >= sessionRows[0].capacity) {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: 'Свободных мест больше нет' });
    }
    const { rows: historyRows } = await client.query(
      'SELECT 1 FROM bookings WHERE member_id = $1 AND session_id = $2 LIMIT 1', [req.memberId, sessionId]
    );
    const xpAwarded = historyRows.length === 0;
    const { rows: bookingRows } = await client.query(
      `INSERT INTO bookings (member_id, session_id, status, xp_awarded)
       VALUES ($1, $2, 'Confirmed', $3)
       RETURNING booking_id, session_id, booking_date, status, xp_awarded`,
      [req.memberId, sessionId, xpAwarded]
    );
    const { rows: memberRows } = xpAwarded
      ? await client.query('UPDATE members SET xp = xp + 50 WHERE member_id = $1 RETURNING xp', [req.memberId])
      : await client.query('SELECT xp FROM members WHERE member_id = $1', [req.memberId]);
    await client.query('COMMIT');
    return res.status(201).json({
      message: xpAwarded ? 'Бронирование подтверждено! +50 XP' : 'Бронирование подтверждено',
      booking: bookingRows[0], member: { member_id: req.memberId, xp: memberRows[0].xp },
    });
  } catch (error) {
    if (client) { try { await client.query('ROLLBACK'); } catch (_) { /* already closed */ } }
    if (error.code === '23503') return res.status(404).json({ message: 'Тренировка не найдена' });
    if (error.code === '23505') return res.status(409).json({ message: 'Вы уже записаны на эту тренировку' });
    console.error('Booking failed:', error.message);
    return res.status(500).json({ message: 'Не удалось завершить бронирование' });
  } finally { client?.release(); }
});

app.delete('/api/bookings/:bookingId', requireAuth, async (req, res) => {
  const bookingId = Number(req.params.bookingId);
  if (!Number.isSafeInteger(bookingId) || bookingId < 1) return res.status(400).json({ message: 'Некорректный booking_id' });
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const { rows } = await client.query(
      "SELECT booking_id, xp_awarded FROM bookings WHERE booking_id = $1 AND member_id = $2 AND status = 'Confirmed' FOR UPDATE",
      [bookingId, req.memberId]
    );
    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Активная бронь не найдена' });
    }
    await client.query("UPDATE bookings SET status = 'Cancelled' WHERE booking_id = $1", [bookingId]);
    const { rows: memberRows } = rows[0].xp_awarded
      ? await client.query('UPDATE members SET xp = GREATEST(xp - 50, 0) WHERE member_id = $1 RETURNING xp', [req.memberId])
      : await client.query('SELECT xp FROM members WHERE member_id = $1', [req.memberId]);
    await client.query('COMMIT');
    return res.json({ message: 'Бронь отменена', xp: memberRows[0].xp });
  } catch (error) {
    if (client) { try { await client.query('ROLLBACK'); } catch (_) { /* already closed */ } }
    console.error('Cancellation failed:', error.message);
    return res.status(500).json({ message: 'Не удалось отменить бронь' });
  } finally { client?.release(); }
});

app.get('/api/analytics/fill-rate', async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT ts.session_id, ts.session_name, ts.capacity,
             COUNT(b.booking_id)::int AS booked_count,
             ROUND(COUNT(b.booking_id)::numeric * 100 / NULLIF(ts.capacity, 0), 2) AS fill_rate
      FROM training_sessions ts
      LEFT JOIN bookings b ON b.session_id = ts.session_id AND b.status = 'Confirmed'
      GROUP BY ts.session_id ORDER BY ts.date_time ASC
    `);
    return res.json(rows);
  } catch (error) {
    console.error('Failed to load analytics:', error.message);
    return res.status(500).json({ message: 'Не удалось загрузить аналитику' });
  }
});

app.use((_req, res) => res.status(404).json({ message: 'Маршрут не найден' }));
app.use((error, _req, res, _next) => {
  if (error.type === 'entity.parse.failed') return res.status(400).json({ message: 'Некорректный JSON' });
  if (error.type === 'entity.too.large') return res.status(413).json({ message: 'Слишком большой запрос' });
  console.error('Unhandled request error:', error);
  return res.status(500).json({ message: 'Внутренняя ошибка сервера' });
});

const port = Number(process.env.PORT) || 5001;
const server = app.listen(port, () => console.log(`Gym Booking API слушает порт ${port}`));
let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal}: завершение API...`);
  server.close(async (error) => {
    if (error) console.error('HTTP shutdown failed:', error.message);
    try { await pool.end(); } catch (dbError) { console.error('PostgreSQL shutdown failed:', dbError.message); }
    process.exit(error ? 1 : 0);
  });
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
