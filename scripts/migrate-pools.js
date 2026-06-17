const { Pool } = require('pg');

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_egox6ICBUc1F@ep-calm-union-ao5z58ec-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=verify-full&channel_binding=require';

const pool = new Pool({
  connectionString,
});

async function migrate() {
  console.log('Connecting to database...');
  const client = await pool.connect();
  try {
    console.log('Running migration...');

    // 1. Create lead_pools table
    await client.query(`
      CREATE TABLE IF NOT EXISTS lead_pools (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        google_sheet_url TEXT,
        last_synced_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Created lead_pools table');

    // 2. Add pool_id column to leads table
    await client.query(`
      ALTER TABLE leads 
      ADD COLUMN IF NOT EXISTS pool_id UUID REFERENCES lead_pools(id) ON DELETE SET NULL
    `);
    console.log('Added pool_id to leads table');

    console.log('Migration successfully completed!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
