const { Pool } = require('pg');

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgresql://neondb_owner:npg_egox6ICBUc1F@ep-calm-union-ao5z58ec-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=verify-full&channel_binding=require',
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
