# Gym Booking & Social Fitness App

В приложении есть React-интерфейс (`front/`), Express API и PostgreSQL. API работает на порту `5001`, сайт Vite — на `5173`; Vite проксирует `/api` к API.

## Настройка базы и секретов

Создайте базу `bookingsys`, если её ещё нет, затем примените схему:

```sh
createdb -U postgres bookingsys
psql -U postgres -d bookingsys -f database/schema.sql
```

Если база уже существовала, повторный запуск `psql` добавит недостающие поля и частичный индекс активных броней. Миграция не удаляет бронирования. Старые профили без пароля можно активировать в приложении через вкладку **«Старый аккаунт»**.

Создайте локальный файл настроек и задайте параметры PostgreSQL и новый JWT-секрет:

```sh
cp .env.example .env
openssl rand -hex 32
```

Вставьте результат `openssl` в `JWT_SECRET` в `.env`, задайте правильный `PGPASSWORD` и остальные параметры подключения. Не публикуйте `.env` и не коммитьте его. Для `DATABASE_URL` SSL включён по умолчанию; для локальной БД с URL можно явно задать `PGSSL=false`.

## Запуск

В одном окне терминала из корня проекта:

```sh
npm install
npm start
```

Для разработки с автоматическим перезапуском: `npm run dev`.

В другом окне:

```sh
cd front
npm install
npm run dev
```

Откройте `http://localhost:5173`. API health check: `http://localhost:5001/api/health`.

## Маршруты API

- `POST /api/auth/register` — регистрация с паролем.
- `POST /api/auth/login` — вход по email и паролю.
- `POST /api/auth/activate` — одноразовая активация старого профиля по email и телефону с созданием пароля.
- `GET /api/me` и `GET /api/me/bookings` — профиль и активные брони текущего JWT-пользователя.
- `GET /api/sessions` — открытый список тренировок.
- `POST /api/bookings` с `session_id`; `DELETE /api/bookings/:bookingId` — запись и отмена собственной брони.
- `GET /api/members`, `POST /api/follows` с `following_id`, `DELETE /api/follows/:followingId` — сообщество и подписки текущего пользователя.
- `GET /api/analytics/fill-rate` — аналитика заполненности.

Пароли хранятся как bcrypt-хэши через `bcryptjs`, вход ограничен по частоте и выдаёт JWT на 7 дней. ID владельца брони и подписки API получает из токена. XP начисляется только за первую бронь конкретной тренировки и снимается при её отмене; повторная запись после отмены XP не начисляет повторно.

Синтаксическая проверка некорректного JSON и остальные ошибки API возвращаются в JSON с полем `message`. `npm test` запускает встроенный Node.js test runner.
