import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowDownRight, ArrowRight, Bell, CalendarDays, Check, ChevronDown,
  Clock3, Dumbbell, Flame, Home, Search, Sparkles, Trophy, UserRoundPlus,
  Users, X, Heart, UserRound,
} from 'lucide-react';
import './App.css';

const API = '/api';
const dateLabel = (value) => new Date(value).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
const timeToday = (hour, minute = 0) => {
  const value = new Date();
  value.setHours(hour, minute, 0, 0);
  return value.toISOString();
};
const seedSessions = [
  { id: 1, name: 'Силовая база', coach: 'Алина Садыкова', type: 'СИЛА', time: '09:30', date: dateLabel(timeToday(9, 30)), dateTime: timeToday(9, 30), duration: 50, capacity: 12, booked: 8, place: 'Зал № 2', color: 'lime', emoji: '🏋️' },
  { id: 2, name: 'Йога и баланс', coach: 'Мадина Омарова', type: 'ВОССТАНОВЛЕНИЕ', time: '11:00', date: dateLabel(timeToday(11)), dateTime: timeToday(11), duration: 60, capacity: 10, booked: 6, place: 'Студия A', color: 'lilac', emoji: '🧘' },
  { id: 3, name: 'HIIT: максимум', coach: 'Тимур Алиев', type: 'КАРДИО', time: '13:15', date: dateLabel(timeToday(13, 15)), dateTime: timeToday(13, 15), duration: 45, capacity: 14, booked: 13, place: 'Зал № 1', color: 'orange', emoji: '⚡' },
  { id: 4, name: 'Функциональный тренинг', coach: 'Данияр Ким', type: 'СИЛА', time: '18:00', date: dateLabel(timeToday(18)), dateTime: timeToday(18), duration: 55, capacity: 12, booked: 5, place: 'Зал № 2', color: 'blue', emoji: '💪' },
  { id: 5, name: 'Пилатес: core', coach: 'Алина Садыкова', type: 'ВОССТАНОВЛЕНИЕ', time: '19:30', date: dateLabel(timeToday(19, 30)), dateTime: timeToday(19, 30), duration: 50, capacity: 10, booked: 3, place: 'Студия A', color: 'pink', emoji: '🧘‍♀️' },
];
const nav = [
  ['Обзор', Home], ['Тренировки', Dumbbell], ['Сообщество', Users],
  ['Достижения', Trophy], ['Профиль', UserRoundPlus],
];
const savedMember = () => {
  try { return localStorage.getItem('gymquest.token') ? JSON.parse(localStorage.getItem('gymquest.member')) || null : null; }
  catch { return null; }
};

function App() {
  const [tab, setTab] = useState('Обзор');
  const [member, setMember] = useState(savedMember);
  const [token, setToken] = useState(() => localStorage.getItem('gymquest.token'));
  const [bookingRecords, setBookingRecords] = useState([]);
  const [sessions, setSessions] = useState(seedSessions);
  const [booked, setBooked] = useState([]);
  const [members, setMembers] = useState([]);
  const [follows, setFollows] = useState([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('Все');
  const [day, setDay] = useState('Сегодня');
  const [toast, setToast] = useState('');
  const [modal, setModal] = useState(false);
  const [backendReady, setBackendReady] = useState(false);
  const [sessionsError, setSessionsError] = useState('');
  const [registering, setRegistering] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', membership_type: 'Standard', password: '' });
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [activationForm, setActivationForm] = useState({ email: '', phone: '', password: '' });
  const [authMode, setAuthMode] = useState('login');
  const todayLabel = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toLocaleUpperCase('ru-RU');
  const xp = Number(member?.xp || 0);

  const authFetch = useCallback((url, options = {}) => fetch(url, {
    ...options,
    headers: { ...(options.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  }), [token]);

  const notify = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 4000);
  };

  const fetchSessions = useCallback(async () => {
    const response = await fetch(`${API}/sessions`);
    if (!response.ok) throw new Error('Не удалось загрузить тренировки');
    const data = await response.json();
    setSessions(data.map((session) => ({
      ...session,
      id: session.session_id,
      name: session.session_name,
      time: new Date(session.date_time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
      date: dateLabel(session.date_time),
      dateTime: session.date_time,
      booked: session.capacity - session.remaining_places,
      place: session.place || 'Основной зал',
      type: session.category || 'ТРЕНИРОВКА',
      duration: session.duration || 50,
      color: session.color || 'lime',
      emoji: session.emoji || '🏋️',
    })));
  }, []);

  const fetchBookings = useCallback(async () => {
    if (!token) { setBooked([]); setBookingRecords([]); return; }
    try {
      const response = await authFetch(`${API}/me/bookings`);
      if (response.ok) {
        const data = await response.json();
        setBookingRecords(data);
        setBooked(data.map((booking) => booking.session_id));
      } else if (response.status === 401) {
        localStorage.removeItem('gymquest.token');
        localStorage.removeItem('gymquest.member');
        setToken(null);
        setMember(null);
        setAuthMode('login');
        notify('Сессия завершилась. Войдите снова.');
      }
    } catch { /* API availability is reported by the main health check. */ }
  }, [authFetch, token]);

  const fetchCommunity = useCallback(async () => {
    if (!token) return;
    try {
      const response = await authFetch(`${API}/members`);
      if (!response.ok) throw new Error('Не удалось загрузить сообщество');
      const data = await response.json();
      setMembers(data.members);
      setFollows(data.members.filter((person) => person.is_following).map((person) => person.member_id));
    } catch (error) { notify(error.message || 'Не удалось загрузить сообщество'); }
  }, [authFetch, token]);

  useEffect(() => {
    let active = true;
    async function checkApi() {
      try {
        const response = await fetch(`${API}/health`);
        if (!response.ok) throw new Error('API недоступен');
        if (active) setBackendReady(true);
        try {
          await fetchSessions();
          if (active) setSessionsError('');
        } catch {
          if (active) setSessionsError('API отвечает, но расписание не загрузилось. Проверьте, что применена database/schema.sql.');
        }
      } catch {
        if (active) setBackendReady(false);
      }
    }
    checkApi();
    return () => { active = false; };
  }, [fetchSessions]);

  useEffect(() => { fetchBookings(); }, [token, fetchBookings]);
  useEffect(() => {
    if (!token) return;
    authFetch(`${API}/me`).then(async (response) => {
      if (response.status === 401) {
        localStorage.removeItem('gymquest.token');
        localStorage.removeItem('gymquest.member');
        setToken(null);
        setMember(null);
        setAuthMode('login');
        return;
      }
      if (!response.ok) return;
      const data = await response.json();
      setMember(data.member);
      localStorage.setItem('gymquest.member', JSON.stringify(data.member));
    }).catch(() => {});
  }, [authFetch, token]);
  useEffect(() => { if (tab === 'Сообщество' && backendReady) fetchCommunity(); }, [tab, backendReady, fetchCommunity]);

  const filtered = useMemo(() => {
    const now = new Date();
    const target = new Date(now);
    if (day === 'Завтра') target.setDate(target.getDate() + 1);
    return sessions.filter((session) => {
      const date = new Date(session.dateTime);
      const inRange = day === 'Неделя'
        ? date >= now && date < new Date(now.getTime() + 7 * 86400000)
        : date.toDateString() === target.toDateString();
      return inRange && (filter === 'Все' || session.type === filter)
        && session.name.toLowerCase().includes(query.toLowerCase());
    });
  }, [sessions, filter, query, day]);

  async function book(session) {
    if (!member?.member_id) { setTab('Профиль'); notify('Войдите или создайте профиль'); return; }
    if (booked.includes(session.id)) { notify('Вы уже записаны на эту тренировку'); return; }
    if (session.booked >= session.capacity) { notify('Свободных мест больше нет'); return; }
    try {
      const response = await authFetch(`${API}/bookings`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: session.id }),
      });
      const result = await response.json();
      if (!response.ok) { notify(result.message || result.error || 'Не удалось записаться'); return; }
      setMember((current) => {
        const updated = { ...current, xp: result.member?.xp ?? current.xp };
        localStorage.setItem('gymquest.member', JSON.stringify(updated));
        return updated;
      });
      await Promise.all([fetchSessions(), fetchBookings()]);
      notify(`${result.message} · ${session.name}`);
    } catch { notify('Сервер недоступен. Запустите API на порту 5001.'); }
  }

  async function cancelBooking(booking) {
    try {
      const response = await authFetch(`${API}/bookings/${booking.booking_id}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Не удалось отменить бронь');
      setMember((current) => {
        const updated = { ...current, xp: result.xp };
        localStorage.setItem('gymquest.member', JSON.stringify(updated));
        return updated;
      });
      await Promise.all([fetchSessions(), fetchBookings()]);
      notify('Бронь отменена');
    } catch (error) { notify(error.message || 'Не удалось отменить бронь'); }
  }

  async function login(event) {
    event.preventDefault();
    setRegistering(true);
    try {
      const response = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(loginForm) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Не удалось выполнить вход');
      setToken(result.token);
      localStorage.setItem('gymquest.token', result.token);
      setMember(result.member);
      localStorage.setItem('gymquest.member', JSON.stringify(result.member));
      setLoginForm({ email: '', password: '' });
      setTab('Обзор');
      notify(`С возвращением, ${result.member.name}!`);
    } catch (error) { notify(error.message || 'Не удалось подключиться к API'); }
    finally { setRegistering(false); }
  }

  async function register(event) {
    event.preventDefault();
    setRegistering(true);
    try {
      const response = await fetch(`${API}/auth/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Не удалось создать профиль');
      setToken(result.token);
      localStorage.setItem('gymquest.token', result.token);
      setMember(result.member);
      localStorage.setItem('gymquest.member', JSON.stringify(result.member));
      setBooked([]);
      setBookingRecords([]);
      setForm({ name: '', email: '', phone: '', membership_type: 'Standard', password: '' });
      setTab('Обзор');
      notify(`Добро пожаловать, ${result.member.name}! Профиль создан.`);
    } catch (error) { notify(error.message || 'Не удалось подключиться к API'); }
    finally { setRegistering(false); }
  }

  async function activateLegacy(event) {
    event.preventDefault();
    setRegistering(true);
    try {
      const response = await fetch(`${API}/auth/activate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(activationForm) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Не удалось активировать профиль');
      setToken(result.token);
      localStorage.setItem('gymquest.token', result.token);
      setMember(result.member);
      localStorage.setItem('gymquest.member', JSON.stringify(result.member));
      setActivationForm({ email: '', phone: '', password: '' });
      setTab('Обзор');
      notify(`Добро пожаловать, ${result.member.name}!`);
    } catch (error) { notify(error.message || 'Не удалось активировать профиль'); }
    finally { setRegistering(false); }
  }

  async function toggleFollow(person) {
    if (!member?.member_id) { setTab('Профиль'); notify('Для подписки войдите в профиль'); return; }
    const isFollowing = follows.includes(person.member_id);
    try {
      const response = await authFetch(isFollowing
        ? `${API}/follows/${person.member_id}`
        : `${API}/follows`, {
        method: isFollowing ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        ...(isFollowing ? {} : { body: JSON.stringify({ following_id: person.member_id }) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Не удалось обновить подписку');
      setFollows((current) => isFollowing ? current.filter((id) => id !== person.member_id) : [...current, person.member_id]);
      notify(isFollowing ? `Вы больше не следите за ${person.name}` : `Вы подписались на ${person.name}`);
    } catch (error) { notify(error.message); }
  }

  const title = tab === 'Обзор' ? 'Твой фитнес-план' : tab;
  const welcome = <div className="welcome-row"><div><div className="eyebrow"><span className="live-dot"/> {todayLabel}</div><h1>Твоя следующая<br/><span>победа начинается здесь.</span></h1><p className="lead">Выбери тренировку. Забронируй место. Стань сильнее.</p></div><div className="hero-art"><div className="hero-orbit orbit-a"/><div className="hero-orbit orbit-b"/><div className="hero-person">🏋️‍♀️</div><div className="hero-spark">✳</div><div className="hero-note"><span>ТВОЯ ЦЕЛЬ</span><b>{Math.min(booked.length, 4)} <small>/ 4</small></b><i>тренировки на неделе</i><div className="progress"><span style={{ width: `${Math.min(booked.length / 4 * 100, 100)}%` }}/></div></div></div></div>;

  function renderSessions() {
    return <>
      <div className="section-head"><div><div className="eyebrow">НАЙДИ СВОЙ РИТМ</div><h2>Тренировки <span className="count">{filtered.length}</span></h2></div><button className="text-link" onClick={() => setModal(true)}>Моё расписание <CalendarDays size={16}/></button></div>
      <div className="filters"><div className="day-switch"><button className={day === 'Сегодня' ? 'selected' : ''} onClick={() => setDay('Сегодня')}>Сегодня</button><button className={day === 'Завтра' ? 'selected' : ''} onClick={() => setDay('Завтра')}>Завтра</button><button className={day === 'Неделя' ? 'selected' : ''} onClick={() => setDay('Неделя')}>Неделя</button></div><div className="filter-right"><div className="search"><Search size={15}/><input placeholder="Найти тренировку" value={query} onChange={(event) => setQuery(event.target.value)}/></div><select value={filter} onChange={(event) => setFilter(event.target.value)}><option>Все</option><option>СИЛА</option><option>КАРДИО</option><option>ВОССТАНОВЛЕНИЕ</option></select></div></div>
      <div className="session-list">{filtered.map((session) => {
        const full = session.booked >= session.capacity;
        const mine = booked.includes(session.id);
        return <article className="session" key={session.id}><div className={`session-art ${session.color}`}><span>{session.emoji}</span><i>{session.type}</i></div><div className="session-main"><div className="session-date"><CalendarDays size={13}/>{session.date}</div><h3>{session.name}</h3><div className="coach"><div className="coach-avatar">{session.coach.split(' ').map((part) => part[0]).slice(0, 2).join('')}</div>{session.coach}<span className="verified">✓</span></div><div className="session-meta"><span><Clock3 size={14}/>{session.time} · {session.duration} мин</span><span><Activity size={14}/>{session.place}</span></div></div><div className="session-capacity"><div className="capacity-label"><span>МЕСТА</span><b className={full ? 'red' : ''}>{session.capacity - session.booked}<small> / {session.capacity}</small></b></div><div className="capacity-bar"><i style={{ width: `${100 * session.booked / session.capacity}%` }}/></div><span className="capacity-hint">{full ? 'Мест нет' : session.capacity - session.booked <= 3 ? 'Почти заполнено' : 'Осталось мест'}</span></div><button disabled={full && !mine} className={`book-button ${mine ? 'booked' : ''}`} onClick={() => mine ? setModal(true) : book(session)}>{mine ? <><Check size={15}/> Записаны</> : full ? 'Нет мест' : <>Записаться <ArrowRight size={15}/></>}</button></article>;
      })}{!filtered.length && <div className="empty">На выбранную дату тренировок нет. Попробуйте другой день.</div>}</div>
    </>;
  }

  function renderProfile() {
    if (member) {
      return <section className="page-panel registration-panel">
        <div className="eyebrow">МОЙ АККАУНТ</div>
        <h1>Профиль</h1>
        <p className="lead">Информация вашего аккаунта GymQuest.</p>
        <div className="account-card">
          <div className="account-identity">
            <div className="avatar account-avatar">{member.name?.[0]?.toUpperCase() || 'У'}</div>
            <div><span>УЧАСТНИК GYMQUEST</span><strong>{member.name}</strong><small>Уровень {Math.floor(xp / 250) + 1} · {member.membership_type || 'Standard'}</small></div>
          </div>
          <div className="account-details"><div><span>EMAIL</span><strong>{member.email}</strong></div><div><span>ТЕЛЕФОН</span><strong>{member.phone}</strong></div><div><span>ОПЫТ</span><strong>{xp} XP</strong></div><div><span>ЗАПИСИ</span><strong>{booked.length}</strong></div></div>
          <button className="account-logout" onClick={() => { localStorage.removeItem('gymquest.member'); localStorage.removeItem('gymquest.token'); setToken(null); setMember(null); setBooked([]); setBookingRecords([]); setAuthMode('login'); notify('Вы вышли из профиля'); }}>Выйти или сменить аккаунт</button>
        </div>
      </section>;
    }

    return <section className="page-panel registration-panel">
      <div className="eyebrow">ПРОФИЛЬ УЧАСТНИКА</div>
      <h1>{authMode === 'login' ? 'Войти в аккаунт' : 'Создать профиль'}</h1>
      <p className="lead">{authMode === 'login' ? 'Введите email и пароль.' : authMode === 'activate' ? 'Для старого профиля подтвердите email и телефон, затем задайте пароль.' : 'Заполните данные, чтобы присоединиться к GymQuest.'}</p>
      <div className="auth-tabs"><button type="button" className={authMode === 'login' ? 'selected' : ''} onClick={() => setAuthMode('login')}>Вход</button><button type="button" className={authMode === 'register' ? 'selected' : ''} onClick={() => setAuthMode('register')}>Регистрация</button><button type="button" className={authMode === 'activate' ? 'selected' : ''} onClick={() => setAuthMode('activate')}>Старый аккаунт</button></div>
      {authMode === 'login' ? <form className="registration-form" onSubmit={login}>
        <label>Email<input required type="email" maxLength="100" autoComplete="email" placeholder="name@example.com" value={loginForm.email} onChange={(event) => setLoginForm({ ...loginForm, email: event.target.value })}/></label>
        <label>Пароль<input required type="password" minLength="8" maxLength="72" autoComplete="current-password" placeholder="Не менее 8 символов" value={loginForm.password} onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })}/></label>
        <button className="book-button submit-button" type="submit" disabled={registering}>{registering ? 'Проверяем…' : <>Войти в аккаунт <ArrowRight size={16}/></>}</button>
      </form> : authMode === 'register' ? <form className="registration-form" onSubmit={register}>
        <label>Имя и фамилия<input required minLength="2" maxLength="100" autoComplete="name" placeholder="Например, Айдана Ким" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })}/></label>
        <label>Email<input required type="email" maxLength="100" autoComplete="email" placeholder="name@example.com" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })}/></label>
        <label>Телефон<input required type="tel" maxLength="20" autoComplete="tel" placeholder="+7 700 123 45 67" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })}/></label>
        <label>Пароль<input required type="password" minLength="8" maxLength="72" autoComplete="new-password" placeholder="Не менее 8 символов" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })}/></label>
        <label>Абонемент<select value={form.membership_type} onChange={(event) => setForm({ ...form, membership_type: event.target.value })}><option value="Standard">Standard</option><option value="Premium">Premium</option></select></label>
        <button className="book-button submit-button" type="submit" disabled={registering}>{registering ? 'Создаём профиль…' : <>Зарегистрироваться <ArrowRight size={16}/></>}</button>
      </form> : <form className="registration-form" onSubmit={activateLegacy}>
        <p className="form-help">Для старых аккаунтов, созданных до паролей. Подтвердите email и телефон, затем задайте пароль.</p>
        <label>Email<input required type="email" maxLength="100" autoComplete="email" value={activationForm.email} onChange={(event) => setActivationForm({ ...activationForm, email: event.target.value })}/></label>
        <label>Телефон<input required type="tel" maxLength="20" autoComplete="tel" value={activationForm.phone} onChange={(event) => setActivationForm({ ...activationForm, phone: event.target.value })}/></label>
        <label>Новый пароль<input required type="password" minLength="8" maxLength="72" autoComplete="new-password" value={activationForm.password} onChange={(event) => setActivationForm({ ...activationForm, password: event.target.value })}/></label>
        <button className="book-button submit-button" type="submit" disabled={registering}>{registering ? 'Активируем…' : <>Активировать аккаунт <ArrowRight size={16}/></>}</button>
      </form>}
      {!backendReady && <div className="api-hint">API не подключён. Запустите сервер и PostgreSQL, чтобы войти или создать профиль.</div>}
    </section>;
  }

  function renderCommunity() {
    return <section className="page-panel"><div className="eyebrow">ТРЕНИРУЙСЯ ВМЕСТЕ</div><h1>Сообщество</h1><p className="lead">Найди участников клуба и следи за их тренировочным прогрессом.</p>{members.length ? <div className="people-grid">{members.map((person) => <article className="person-card" key={person.member_id}><div className="avatar person-avatar">{person.name?.[0]?.toUpperCase() || 'У'}</div><h3>{person.name}</h3><p>{person.character_id || 'Novice Hero'} · {person.xp || 0} XP</p><button className={`follow-button ${follows.includes(person.member_id) ? 'following' : ''}`} onClick={() => toggleFollow(person)}>{follows.includes(person.member_id) ? <><Check size={15}/> Вы подписаны</> : <><Heart size={15}/> Подписаться</>}</button></article>)}</div> : <div className="empty">{backendReady ? 'Пока здесь нет других участников. Загляните позже.' : 'Запустите API, чтобы загрузить участников сообщества.'}</div>}</section>;
  }

  function renderAchievements() {
    const goal = Math.min(booked.length, 4);
    const cards = [
      { icon: Dumbbell, title: 'Первый шаг', description: 'Запишись на первое занятие', done: booked.length > 0 },
      { icon: Flame, title: 'В ритме', description: 'Посети 4 тренировки', done: booked.length >= 4 },
      { icon: Users, title: 'Вместе сильнее', description: 'Подпишись на участника клуба', done: follows.length > 0 },
    ];
    return <section className="page-panel"><div className="eyebrow">ТВОЙ ПРОГРЕСС</div><h1>Достижения</h1><p className="lead">Каждая тренировка приближает тебя к следующему уровню.</p><div className="achievement-summary"><div className="stat-icon purple"><Trophy size={20}/></div><div><span>ТВОЙ ОПЫТ</span><strong>{xp} XP</strong></div><div className="achievement-level">Уровень {Math.floor(xp / 250) + 1}</div></div><div className="goal-card"><div><b>Цель недели</b><span>{goal} из 4 тренировок</span></div><div className="progress"><span style={{ width: `${goal * 25}%` }}/></div></div><div className="achievement-grid">{cards.map(({ icon: Icon, title: cardTitle, description, done }) => <article className={`achievement-card ${done ? 'complete' : ''}`} key={cardTitle}><div className="achievement-icon"><Icon size={21}/></div><h3>{cardTitle}</h3><p>{description}</p><span>{done ? <><Check size={14}/> Выполнено</> : 'В процессе'}</span></article>)}</div></section>;
  }

  function renderOverview() {
    return <>{welcome}<section className="stats"><div className="stat"><div className="stat-icon green"><Dumbbell size={18}/></div><div><span>ЗАПИСЕЙ</span><strong>{booked.length} <small>занятий</small></strong></div><ArrowDownRight className="stat-arrow" size={17}/></div><div className="stat"><div className="stat-icon orange"><Flame size={18}/></div><div><span>ТЕКУЩАЯ СЕРИЯ</span><strong>{booked.length} <small>занятий</small></strong></div><ArrowDownRight className="stat-arrow" size={17}/></div><div className="stat"><div className="stat-icon purple"><Trophy size={18}/></div><div><span>ОБЩИЙ ОПЫТ</span><strong>{xp} <small>XP</small></strong></div><ArrowDownRight className="stat-arrow" size={17}/></div><div className="stat"><div className="stat-icon blue"><Users size={18}/></div><div><span>В СООБЩЕСТВЕ</span><strong>{members.length} <small>участников</small></strong></div><button className="stat-link" onClick={() => setTab('Сообщество')}><ArrowRight size={17}/></button></div></section><div className="overview-actions"><button className="book-button" onClick={() => setTab('Тренировки')}>Найти тренировку <ArrowRight size={16}/></button><button className="text-link" onClick={() => setTab('Профиль')}><UserRound size={16}/> Мой профиль</button></div></>;
  }

  return <div className="app"><aside className="sidebar"><button className="brand brand-button" onClick={() => setTab('Обзор')}><span className="brand-mark"><Activity size={22}/></span><span>gym<span className="lime-text">quest</span></span></button><button className="club club-button" onClick={() => setTab('Обзор')}><span className="club-icon">G</span><span><small>МОЙ КЛУБ</small><strong>FORMA Fitness</strong></span><ChevronDown size={15}/></button><div className="nav-label">МЕНЮ</div><nav>{nav.map(([name, Icon]) => <button className={`nav-item ${tab === name ? 'active' : ''}`} onClick={() => setTab(name)} key={name}><Icon size={18}/>{name}{name === 'Сообщество' && members.length > 0 && <span className="nav-dot"/>}</button>)}</nav><div className="sidebar-bottom"><div className="streak-card"><div className="streak-top"><div className="streak-icon"><Flame size={17}/></div><span>ТВОЙ ПРОГРЕСС</span><strong>✨ {booked.length} занятия</strong></div><p>Продолжай тренироваться и открывай достижения.</p><div className="streak-dots">{['П','В','С','Ч','П','С','В'].map((letter, index) => <div key={index} className={index < Math.min(booked.length, 7) ? 'done' : ''}>{index < booked.length ? <Check size={11}/> : letter}</div>)}</div></div><button className="profile-mini profile-button" onClick={() => setTab('Профиль')}><span className="avatar">{member?.name?.[0]?.toUpperCase() || 'А'}</span><span><strong>{member?.name || 'Гость'}</strong><span>{member ? `Уровень ${Math.floor(xp / 250) + 1} · ${member.membership_type || 'Standard'}` : 'Создать профиль'}</span></span><ChevronDown size={16}/></button></div></aside>
    <main className="main"><header className="topbar"><div className="crumb">Мой клуб <span>/</span> {tab}</div><div className="top-actions"><button className="xp-pill" onClick={() => setTab('Достижения')}><Sparkles size={14}/> {xp} XP</button><button className="icon-button notif" aria-label="Уведомления" onClick={() => notify(backendReady ? 'Новых уведомлений пока нет' : 'Запустите API, чтобы включить уведомления')}><Bell size={18}/>{booked.length > 0 && <i/>}</button><button className="avatar small avatar-button" aria-label="Открыть профиль" onClick={() => setTab('Профиль')}>{member?.name?.[0]?.toUpperCase() || 'А'}</button></div></header><div className="content">{sessionsError && <div className="api-hint">{sessionsError}</div>}{tab === 'Обзор' && renderOverview()}{tab === 'Тренировки' && renderSessions()}{tab === 'Сообщество' && renderCommunity()}{tab === 'Достижения' && renderAchievements()}{tab === 'Профиль' && renderProfile()}<footer>ДВИГАЙСЯ В СВОЁМ ТЕМПЕ <span>·</span> GYMQUEST © {new Date().getFullYear()}</footer></div></main>
    {toast && <div className="toast"><div><Check size={16}/></div>{toast}<button onClick={() => setToast('')} aria-label="Закрыть"><X size={15}/></button></div>}{modal && <div className="overlay" onClick={() => setModal(false)}><div className="schedule-modal" onClick={(event) => event.stopPropagation()}><button className="close" onClick={() => setModal(false)} aria-label="Закрыть"><X/></button><div className="eyebrow">ТВОЙ ПЛАН</div><h2>Моё расписание</h2><p>Тренировки, на которые вы записались.</p>{bookingRecords.length ? bookingRecords.map((booking) => { const session = sessions.find((item) => item.id === booking.session_id); return <div className="modal-session" key={booking.booking_id}><b>{session?.time || new Date(session?.date_time || Date.now()).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</b><span>{session?.name || booking.session_name}<small>{session?.coach || 'Тренировка'}</small></span><button className="cancel-booking" onClick={() => cancelBooking(booking)}>Отменить</button></div>; }) : <div className="empty modal-empty">Пока нет записей. Выберите тренировку и забронируйте место.</div>}</div></div>}
  </div>;
}

export default App;
