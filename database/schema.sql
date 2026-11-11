CREATE TABLE IF NOT EXISTS members (
  member_id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  phone VARCHAR(20) NOT NULL,
  membership_type VARCHAR(50) NOT NULL DEFAULT 'Standard',
  character_id VARCHAR(50) NOT NULL DEFAULT 'Novice Hero',
  xp INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
  password_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE members ADD COLUMN IF NOT EXISTS membership_type VARCHAR(50) NOT NULL DEFAULT 'Standard';
ALTER TABLE members ADD COLUMN IF NOT EXISTS character_id VARCHAR(50) NOT NULL DEFAULT 'Novice Hero';
ALTER TABLE members ADD COLUMN IF NOT EXISTS xp INTEGER NOT NULL DEFAULT 0;
ALTER TABLE members ADD COLUMN IF NOT EXISTS password_hash TEXT;

CREATE TABLE IF NOT EXISTS training_sessions (
  session_id SERIAL PRIMARY KEY,
  session_name VARCHAR(100) NOT NULL,
  coach VARCHAR(100) NOT NULL,
  date_time TIMESTAMPTZ NOT NULL,
  duration INTEGER NOT NULL DEFAULT 50 CHECK (duration > 0),
  category VARCHAR(40) NOT NULL DEFAULT 'ТРЕНИРОВКА',
  place VARCHAR(100) NOT NULL DEFAULT 'Основной зал',
  capacity INTEGER NOT NULL CHECK (capacity > 0)
);

ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS duration INTEGER NOT NULL DEFAULT 50;
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS category VARCHAR(40) NOT NULL DEFAULT 'ТРЕНИРОВКА';
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS place VARCHAR(100) NOT NULL DEFAULT 'Основной зал';

CREATE TABLE IF NOT EXISTS bookings (
  booking_id SERIAL PRIMARY KEY,
  member_id INTEGER NOT NULL REFERENCES members(member_id) ON DELETE CASCADE,
  session_id INTEGER NOT NULL REFERENCES training_sessions(session_id) ON DELETE CASCADE,
  booking_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(20) NOT NULL DEFAULT 'Confirmed'
    CHECK (status IN ('Confirmed', 'Cancelled')),
  xp_awarded BOOLEAN NOT NULL DEFAULT FALSE
);

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS xp_awarded BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS unique_member_session;
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_member_id_session_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_confirmed_member_session
  ON bookings(member_id, session_id) WHERE status = 'Confirmed';

CREATE TABLE IF NOT EXISTS member_follows (
  follow_id SERIAL PRIMARY KEY,
  follower_id INTEGER NOT NULL REFERENCES members(member_id) ON DELETE CASCADE,
  following_id INTEGER NOT NULL REFERENCES members(member_id) ON DELETE CASCADE,
  CONSTRAINT chk_not_self_follow CHECK (follower_id <> following_id)
);

ALTER TABLE member_follows DROP CONSTRAINT IF EXISTS unique_follow;
CREATE UNIQUE INDEX IF NOT EXISTS idx_member_follows_pair ON member_follows(follower_id, following_id);

CREATE INDEX IF NOT EXISTS idx_bookings_member ON bookings(member_id);
CREATE INDEX IF NOT EXISTS idx_bookings_session_status ON bookings(session_id, status);
CREATE INDEX IF NOT EXISTS idx_sessions_datetime ON training_sessions(date_time);

INSERT INTO members (name, email, phone)
VALUES ('Aigerim', 'aigerim@example.com', '+77000000000')
ON CONFLICT (email) DO NOTHING;

WITH seed(session_name, coach, date_time, duration, category, place, capacity) AS (
  VALUES
    ('Силовая база', 'Алина Садыкова', date_trunc('day', now()) + interval '9 hours 30 minutes', 50, 'СИЛА', 'Зал № 2', 12),
    ('Йога и баланс', 'Мадина Омарова', date_trunc('day', now()) + interval '11 hours', 60, 'ВОССТАНОВЛЕНИЕ', 'Студия A', 10),
    ('HIIT: максимум', 'Тимур Алиев', date_trunc('day', now()) + interval '13 hours 15 minutes', 45, 'КАРДИО', 'Зал № 1', 14),
    ('Функциональный тренинг', 'Данияр Ким', date_trunc('day', now()) + interval '18 hours', 55, 'СИЛА', 'Зал № 2', 12),
    ('Пилатес: core', 'Алина Садыкова', date_trunc('day', now()) + interval '19 hours 30 minutes', 50, 'ВОССТАНОВЛЕНИЕ', 'Студия A', 10)
)
INSERT INTO training_sessions (session_name, coach, date_time, duration, category, place, capacity)
SELECT seed.* FROM seed
WHERE NOT EXISTS (
  SELECT 1 FROM training_sessions current_session
  WHERE current_session.session_name = seed.session_name
    AND current_session.date_time = seed.date_time
);
