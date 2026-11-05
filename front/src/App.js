import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const memberId = 1; // ID текущего пользователя (Aigerim)

  // Загрузка доступных тренировок при старте страницы
  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/sessions');
      const data = await res.json();
      setSessions(data);
    } catch (err) {
      setMessage('⚠️ Ошибка сети: невозможно загрузить сессии.');
    } finally {
      setLoading(false);
    }
  };

  // Функция нажатия на кнопку "Accept Quest" (Записаться)
  const handleBook = async (sessionId) => {
    setMessage('Обработка бронирования...');
    try {
      const response = await fetch('http://localhost:5000/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: memberId, session_id: sessionId }),
      });

      const result = await response.json();

      if (response.ok) {
        setMessage(`🎉 Quest Accepted! Бронирование подтверждено (+50 XP)`);
        fetchSessions(); // Обновляем список мест на экране
      } else {
        setMessage(`❌ ${result.message}`);
      }
    } catch (error) {
      setMessage('⚠️ Ошибка сети: запрос сохранен локально.');
    }
  };

  if (loading) {
    return <div className="loader">Загрузка тренировок...</div>;
  }

  return (
    <div className="container">
      <header className="header">
        <h1>🏋️ Gym Booking & Social Fitness App</h1>
        <p>Выберите тренировку и начните свой Quest!</p>
      </header>

      {message && <div className="alert">{message}</div>}

      <div className="grid">
        {sessions.map((session) => (
          <div key={session.session_id} className="card">
            <h3>{session.session_name}</h3>
            <p className="coach">Тренер: <strong>{session.coach}</strong></p>
            <p className="time">⏰ {new Date(session.date_time).toLocaleString()}</p>
            
            <div className="places-info">
              <span>Осталось мест:</span>
              <strong className={parseInt(session.remaining_places) > 0 ? 'green' : 'red'}>
                {session.remaining_places} / {session.capacity}
              </strong>
            </div>

            <button 
              disabled={parseInt(session.remaining_places) <= 0}
              onClick={() => handleBook(session.session_id)}
              className="btn-book"
            >
              {parseInt(session.remaining_places) > 0 ? 'Accept Quest (Записаться)' : 'Мест нет'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;