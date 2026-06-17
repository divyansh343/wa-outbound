const { Pool } = require('pg');
const Queue = require('bull');
const crypto = require('crypto');

// Mock baileys-manager so we don't try to connect to a real WhatsApp session
const mockSendMessage = jest.fn().mockResolvedValue({ key: { id: 'mock-msg-123' } });
jest.mock('../lib/baileys-manager', () => {
  return {
    getOrInitSocket: jest.fn().mockImplementation(async (waAccountId) => {
      return {
        sendMessage: mockSendMessage,
      };
    }),
  };
});

// Set flag to register queue worker specifically for E2E tests
global.REGISTER_QUEUE_WORKER = true;

// Import queue (this registers the processor)
const { outreachQueue, formatMessage } = require('../lib/queue');
const { pool } = require('../lib/db');

describe('Campaign E2E Integration Test', () => {
  let testOrgId;
  let testWaAccountId;
  let testCampaignId;
  let testLeadId;

  beforeAll(async () => {
    // Generate UUIDs
    testOrgId = crypto.randomUUID();
    testWaAccountId = crypto.randomUUID();
    testCampaignId = crypto.randomUUID();
    testLeadId = crypto.randomUUID();

    // Clean up any stray test data first
    await pool.query('DELETE FROM messages WHERE lead_id = $1', [testLeadId]);
    await pool.query('DELETE FROM leads WHERE id = $1 OR org_id = $2', [testLeadId, testOrgId]);
    await pool.query('DELETE FROM campaign_wa_accounts WHERE campaign_id = $1', [testCampaignId]);
    await pool.query('DELETE FROM campaigns WHERE id = $1 OR org_id = $2', [
      testCampaignId,
      testOrgId,
    ]);
    await pool.query('DELETE FROM wa_accounts WHERE id = $1 OR org_id = $2', [
      testWaAccountId,
      testOrgId,
    ]);
    await pool.query('DELETE FROM organizations WHERE id = $1', [testOrgId]);

    // Insert test organization
    await pool.query(`INSERT INTO organizations (id, name) VALUES ($1, 'E2E Test Org')`, [
      testOrgId,
    ]);

    // Insert test WhatsApp Account (status must be 'connected')
    await pool.query(
      `INSERT INTO wa_accounts (id, org_id, name, status, phone_number, delay_min, delay_max) 
       VALUES ($1, $2, 'E2E Test WA', 'connected', '1234567890', 0, 1)`,
      [testWaAccountId, testOrgId]
    );

    // Insert test Campaign with low delay
    await pool.query(
      `INSERT INTO campaigns (id, org_id, name, status, message_template, followup_templates, delay_min, delay_max) 
       VALUES ($1, $2, 'E2E Test Campaign', 'active', 'Hello {{name}} from {{company}}!', $3, 0, 1)`,
      [testCampaignId, testOrgId, JSON.stringify([])]
    );

    // Insert campaign WA account mapping
    await pool.query(
      'INSERT INTO campaign_wa_accounts (campaign_id, wa_account_id) VALUES ($1, $2)',
      [testCampaignId, testWaAccountId]
    );

    // Insert test Lead (status must be 'new' initially)
    await pool.query(
      `INSERT INTO leads (id, org_id, campaign_id, name, company, mobile, status) 
       VALUES ($1, $2, $3, 'Test Lead Name', 'Test Company Name', '919999999999', 'new')`,
      [testLeadId, testOrgId, testCampaignId]
    );

    // Clear any existing queue jobs
    await outreachQueue.empty();
  });

  afterAll(async () => {
    // Clean up test data
    await pool.query('DELETE FROM messages WHERE lead_id = $1', [testLeadId]);
    await pool.query('DELETE FROM leads WHERE id = $1 OR org_id = $2', [testLeadId, testOrgId]);
    await pool.query('DELETE FROM campaign_wa_accounts WHERE campaign_id = $1', [testCampaignId]);
    await pool.query('DELETE FROM campaigns WHERE id = $1 OR org_id = $2', [
      testCampaignId,
      testOrgId,
    ]);
    await pool.query('DELETE FROM wa_accounts WHERE id = $1 OR org_id = $2', [
      testWaAccountId,
      testOrgId,
    ]);
    await pool.query('DELETE FROM organizations WHERE id = $1', [testOrgId]);

    // Close db pool connection to prevent Jest from hanging
    await pool.end();
    // Close queue connections
    await outreachQueue.close();
  });

  test('should process outreach and log messages in database', async () => {
    // Update lead status to queued
    await pool.query('UPDATE leads SET status = $1, assigned_wa_account_id = $2 WHERE id = $3', [
      'queued',
      testWaAccountId,
      testLeadId,
    ]);

    const message = 'Hello Test Lead Name from Test Company Name!';

    // Add job to Bull queue
    await outreachQueue.add({
      leadId: testLeadId,
      campaignId: testCampaignId,
      waAccountId: testWaAccountId,
      message,
      isFollowup: false,
    });

    // Wait for the job to be processed (poll DB or check lead status)
    let processed = false;
    for (let i = 0; i < 20; i++) {
      const checkLead = await pool.query('SELECT status FROM leads WHERE id = $1', [testLeadId]);
      if (checkLead.rows[0].status === 'contacted') {
        processed = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    expect(processed).toBe(true);

    // Verify message is logged in messages table
    const msgRes = await pool.query('SELECT * FROM messages WHERE lead_id = $1', [testLeadId]);
    expect(msgRes.rows.length).toBeGreaterThan(0);
    expect(msgRes.rows[0].content).toBe(message);
    expect(msgRes.rows[0].direction).toBe('outbound');
    expect(msgRes.rows[0].status).toBe('sent');

    // Verify WhatsApp socket sendMessage was called with correct parameters
    expect(mockSendMessage).toHaveBeenCalledWith('919999999999@s.whatsapp.net', { text: message });
  }, 15000);
});
