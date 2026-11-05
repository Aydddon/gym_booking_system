const { Pool } = require('pg');


const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'bookingsys',
  password: '0115',
  port: 5432,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

module.exports = pool;