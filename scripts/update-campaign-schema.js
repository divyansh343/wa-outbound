const { Pool } = require('pg');

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_egox6ICBUc1F@ep-calm-union-ao5z58ec-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const pool = new Pool({
  connectionString,
});

async function main() {
  console.log('Connecting to Neon DB...');
  const client = await pool.connect();
  try {
    console.log('Altering campaigns table...');

    // Add delay_min column
    await client.query(`
      ALTER TABLE campaigns 
      ADD COLUMN IF NOT EXISTS delay_min INTEGER DEFAULT 15
    `);
    console.log('Added delay_min column.');

    // Add delay_max column
    await client.query(`
      ALTER TABLE campaigns 
      ADD COLUMN IF NOT EXISTS delay_max INTEGER DEFAULT 45
    `);
    console.log('Added delay_max column.');

    // Add auto_responses column
    await client.query(`
      ALTER TABLE campaigns 
      ADD COLUMN IF NOT EXISTS auto_responses JSONB DEFAULT '[]'::jsonb
    `);
    console.log('Added auto_responses column.');

    console.log('Database campaigns schema updated successfully!');
  } catch (error) {
    console.error('Error executing database updates:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
