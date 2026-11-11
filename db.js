const { Pool } = require('pg');
const usingDatabaseUrl = Boolean(process.env.DATABASE_URL);

const pool = new Pool({
  ...(usingDatabaseUrl ? {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSL === 'false' ? false : { rejectUnauthorized: false },
  } : {
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT) || 5432,
    database: process.env.PGDATABASE || 'bookingsys',
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD,
  }),
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (error) => console.error('Unexpected PostgreSQL pool error:', error.message));
module.exports = pool;
