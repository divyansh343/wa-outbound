const Queue = require('bull');
const Redis = require('ioredis');
const { pool } = require('./db');
const logger = require('./logger');
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const queueName = process.env.NODE_ENV === 'test' ? 'outreach-jobs-test' : 'outreach-jobs';
const outreachQueue = new Queue(queueName, {
  createClient: (type, redisOpts) => {
    switch (type) {
      case 'client':
        return new Redis(redisUrl, {
          ...redisOpts,
          maxRetriesPerRequest: 3,
        });
      case 'subscriber':
      case 'bclient':
        return new Redis(redisUrl, {
          ...redisOpts,
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
        });
      default:
        return new Redis(redisUrl, redisOpts);
    }
  },
});

// Simple message template replacement helper
function formatMessage(template, lead) {
  return template
    .replace(/{{name}}/gi, lead.name || '')
    .replace(/{{company}}/gi, lead.company || '')
    .replace(/{{product}}/gi, lead.product || '')
    .replace(/{{quantity}}/gi, lead.quantity || '')
    .replace(/{{strength}}/gi, lead.strength || '')
    .replace(/{{brand}}/gi, lead.brand || '');
}

if (process.env.NODE_ENV !== 'test' || global.REGISTER_QUEUE_WORKER) {
  // Job processor for sending outreach
  outreachQueue.process(async (job) => {
    const { leadId, campaignId, waAccountId, message, isFollowup, stepIndex } = job.data;
    logger.info(`Processing outreach job for lead ${leadId} using WA account ${waAccountId}`);

    // 1. Fetch WA account configuration & status
    const waAccountRes = await pool.query('SELECT * FROM wa_accounts WHERE id = $1', [waAccountId]);
    const waAccount = waAccountRes.rows[0];

    const maxAttempts = job.opts.attempts || 3;
    if (!waAccount || waAccount.status !== 'connected') {
      const errorMsg = `WhatsApp account ${waAccountId} is not connected or does not exist.`;
      logger.warn(errorMsg);
      if (job.attemptsMade >= maxAttempts - 1) {
        await pool.query(
          'UPDATE leads SET status = $1, last_error = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
          ['failed', errorMsg, leadId]
        );
      }
      throw new Error(errorMsg);
    }

    // 2. Fetch Lead
    const leadRes = await pool.query('SELECT * FROM leads WHERE id = $1', [leadId]);
    const lead = leadRes.rows[0];
    if (!lead) {
      throw new Error(`Lead ${leadId} not found`);
    }

    // Skip sending if the lead has already replied
    if (lead.status === 'replied') {
      logger.info(
        `Skipping outreach/followup for lead ${leadId} because they have already replied.`
      );
      return;
    }

    // Fetch campaign configuration
    const campaignRes = await pool.query('SELECT * FROM campaigns WHERE id = $1', [campaignId]);
    const campaign = campaignRes.rows[0];
    if (!campaign) {
      logger.warn(`Campaign ${campaignId} not found. Skipping.`);
      return;
    }

    // Skip sending if the campaign is paused
    if (campaign.status === 'paused') {
      logger.info(
        `Skipping outreach/followup for lead ${leadId} because campaign ${campaignId} is paused.`
      );
      return;
    }

    // 3. Process sending message using global baileys manager
    try {
      const baileysManager = require('./baileys-manager');
      const socket = await baileysManager.getOrInitSocket(waAccountId, global.io);
      if (!socket) {
        throw new Error(`Socket connection not initialized/active for WA account ${waAccountId}`);
      }

      // Format target phone number: ensure country code (default to India +91 if not specified)
      let phone = lead.mobile.replace(/\D/g, '');
      if (phone.length === 10) {
        phone = '91' + phone;
      }
      const targetJid = `${phone}@s.whatsapp.net`;

      // Implement random delay as defined by campaign config (falling back to account config)
      const delayMin =
        campaign.delay_min !== null && campaign.delay_min !== undefined
          ? campaign.delay_min
          : waAccount.delay_min;
      const delayMax =
        campaign.delay_max !== null && campaign.delay_max !== undefined
          ? campaign.delay_max
          : waAccount.delay_max;
      const delaySec = Math.floor(Math.random() * (delayMax - delayMin + 1)) + delayMin;

      logger.info(`Waiting for delay of ${delaySec} seconds before sending to ${phone}`);
      await new Promise((resolve) => setTimeout(resolve, delaySec * 1000));

      // Send the text message
      await socket.sendMessage(targetJid, { text: message });

      // 4. Log the message
      await pool.query(
        'INSERT INTO messages (lead_id, wa_account_id, content, direction, status) VALUES ($1, $2, $3, $4, $5)',
        [leadId, waAccountId, message, 'outbound', 'sent']
      );

      // 5. Update lead state
      const newStatus = isFollowup ? 'contacted' : 'contacted';
      await pool.query(
        `UPDATE leads 
         SET status = $1, 
             last_message_at = CURRENT_TIMESTAMP, 
             followup_count = followup_count + $2,
             assigned_wa_account_id = $3
         WHERE id = $4`,
        [newStatus, isFollowup ? 1 : 0, waAccountId, leadId]
      );

      logger.info(`Outreach successfully sent to ${phone} for lead ${leadId}`);

      // 6. Schedule next follow-up if applicable
      const followupTemplates = campaign.followup_templates || [];
      const nextStepIndex = isFollowup ? stepIndex + 1 : 0;

      if (nextStepIndex < followupTemplates.length) {
        const nextFollowup = followupTemplates[nextStepIndex];
        if (nextFollowup && nextFollowup.content) {
          // Prepare next follow-up message by formatting templates
          const nextMessage = formatMessage(nextFollowup.content, lead);
          const delayHours = parseFloat(nextFollowup.delayHours) || 0;
          const delayMs = Math.max(1000, delayHours * 3600 * 1000); // delay in milliseconds, min 1 second

          logger.info(
            `Scheduling follow-up step ${nextStepIndex + 1} for lead ${leadId} in ${delayHours} hours.`
          );

          await outreachQueue.add(
            {
              leadId,
              campaignId,
              waAccountId,
              message: nextMessage,
              isFollowup: true,
              stepIndex: nextStepIndex,
            },
            {
              delay: delayMs,
              attempts: 10,
              backoff: 30000,
            }
          );
        }
      }
    } catch (err) {
      logger.error(`Failed to send WA outreach for lead ${leadId}:`, err);
      await pool.query('UPDATE leads SET status = $1, last_error = $2 WHERE id = $3', [
        'failed',
        err.message || 'Unknown error',
        leadId,
      ]);
      throw err;
    }
  });
}

module.exports = {
  outreachQueue,
  formatMessage,
};
