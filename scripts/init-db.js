const { Pool } = require('pg');

const connectionString =
  'postgresql://neondb_owner:npg_egox6ICBUc1F@ep-calm-union-ao5z58ec-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const pool = new Pool({
  connectionString,
});

const schema = `
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Organizations
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  indiamart_api_key VARCHAR(255),
  google_sheet_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'user', -- owner, admin, user
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- WhatsApp Accounts
CREATE TABLE IF NOT EXISTS wa_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  phone_number VARCHAR(50),
  name VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'disconnected', -- disconnected, connecting, connected
  daily_limit INTEGER DEFAULT 100,
  delay_min INTEGER DEFAULT 15, -- in seconds
  delay_max INTEGER DEFAULT 45, -- in seconds
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Baileys WhatsApp Session Store (Multi-device auth)
CREATE TABLE IF NOT EXISTS wa_sessions (
  wa_account_id UUID REFERENCES wa_accounts(id) ON DELETE CASCADE,
  session_key VARCHAR(255) NOT NULL,
  session_data TEXT NOT NULL,
  PRIMARY KEY (wa_account_id, session_key)
);

-- Campaigns
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'paused', -- active, paused, completed
  schedule_time TIMESTAMP WITH TIME ZONE,
  message_template TEXT NOT NULL,
  followup_templates JSONB DEFAULT '[]'::jsonb, -- Array of {delayHours: X, content: Y}
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Campaign WhatsApp Account Mappings
CREATE TABLE IF NOT EXISTS campaign_wa_accounts (
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  wa_account_id UUID REFERENCES wa_accounts(id) ON DELETE CASCADE,
  PRIMARY KEY (campaign_id, wa_account_id)
);

-- Leads
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  company VARCHAR(255),
  mobile VARCHAR(50) NOT NULL,
  email VARCHAR(255),
  country VARCHAR(100),
  product VARCHAR(255),
  quantity VARCHAR(100),
  strength VARCHAR(100),
  brand VARCHAR(100),
  source VARCHAR(50) DEFAULT 'csv', -- csv, indiamart, google_sheet
  status VARCHAR(50) DEFAULT 'new', -- new, queued, processing, contacted, replied, failed
  assigned_wa_account_id UUID REFERENCES wa_accounts(id) ON DELETE SET NULL,
  last_message_at TIMESTAMP WITH TIME ZONE,
  replied_at TIMESTAMP WITH TIME ZONE,
  followup_count INTEGER DEFAULT 0,
  max_followups INTEGER DEFAULT 3,
  lead_tier VARCHAR(50) DEFAULT 'COLD',
  notes TEXT,
  tags TEXT,
  last_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Messages Log
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  wa_account_id UUID REFERENCES wa_accounts(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  direction VARCHAR(20) NOT NULL, -- inbound, outbound
  status VARCHAR(50) DEFAULT 'sent', -- sent, delivered, read, failed
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Activity Notifications
CREATE TABLE IF NOT EXISTS activity_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- reply, connection, error
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
`;

async function main() {
  console.log('Connecting to Neon DB...');
  const client = await pool.connect();
  try {
    console.log('Running schema setup...');
    await client.query(schema);
    console.log('Schema setup completed successfully!');
  } catch (error) {
    console.error('Error executing schema setup:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
