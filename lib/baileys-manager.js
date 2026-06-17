// Bypass Webpack bundling for server-side native modules
const baileys = eval('require')('@whiskeysockets/baileys');
const makeWASocket = baileys.default || baileys;
const DisconnectReason =
  baileys.DisconnectReason || (baileys.default && baileys.default.DisconnectReason);
const initAuthCreds = baileys.initAuthCreds || (baileys.default && baileys.default.initAuthCreds);
const BufferJSON = baileys.BufferJSON || (baileys.default && baileys.default.BufferJSON);

const pino = eval('require')('pino');
const { pool } = require('./db');
const logger = require('./logger');

// Global in-memory storage for active sockets and reconnect timers across hot-reloads
if (!global.activeSockets) {
  global.activeSockets = {};
}
const activeSockets = global.activeSockets;

if (!global.reconnectTimers) {
  global.reconnectTimers = {};
}
const reconnectTimers = global.reconnectTimers;

/**
 * Custom auth state that stores credentials in PostgreSQL instead of filesystem
 * to support scalable VPS / multi-tenant environment.
 */
async function getPostgresAuthState(waAccountId) {
  const readData = async (key) => {
    try {
      const res = await pool.query(
        'SELECT session_data FROM wa_sessions WHERE wa_account_id = $1 AND session_key = $2',
        [waAccountId, key]
      );
      if (res.rows.length > 0) {
        return JSON.parse(res.rows[0].session_data, BufferJSON.reviver);
      }
    } catch (err) {
      logger.error(`Error reading session state for key ${key}:`, err);
    }
    return null;
  };

  const writeData = async (key, value) => {
    try {
      const dataStr = JSON.stringify(value, BufferJSON.replacer);
      await pool.query(
        `INSERT INTO wa_sessions (wa_account_id, session_key, session_data) 
         VALUES ($1, $2, $3)
         ON CONFLICT (wa_account_id, session_key) 
         DO UPDATE SET session_data = EXCLUDED.session_data`,
        [waAccountId, key, dataStr]
      );
    } catch (err) {
      logger.error(`Error writing session state for key ${key}:`, err);
    }
  };

  const removeData = async (key) => {
    try {
      await pool.query('DELETE FROM wa_sessions WHERE wa_account_id = $1 AND session_key = $2', [
        waAccountId,
        key,
      ]);
    } catch (err) {
      logger.error(`Error removing session state for key ${key}:`, err);
    }
  };

  const creds = (await readData('creds')) || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {};
          for (const id of ids) {
            const val = await readData(`${type}-${id}`);
            if (val) data[id] = val;
          }
          return data;
        },
        set: async (data) => {
          for (const type in data) {
            for (const id in data[type]) {
              const val = data[type][id];
              const key = `${type}-${id}`;
              if (val) {
                await writeData(key, val);
              } else {
                await removeData(key);
              }
            }
          }
        },
      },
    },
    saveCreds: async () => {
      await writeData('creds', creds);
    },
  };
}

/**
 * Initialize / Connect to Baileys Whatsapp client instance
 */
async function connectWhatsApp(waAccountId, io = null) {
  console.log(`[connectWhatsApp] Initializing WhatsApp connection for account ${waAccountId}`);
  console.log(`[connectWhatsApp] IO socket server exists:`, !!io);

  // Clear any pending reconnect timer
  if (reconnectTimers[waAccountId]) {
    console.log(`[connectWhatsApp] Clearing pending reconnect timer for account ${waAccountId}`);
    clearTimeout(reconnectTimers[waAccountId]);
    delete reconnectTimers[waAccountId];
  }

  // Close existing socket if active to avoid stream conflicts
  if (activeSockets[waAccountId]) {
    console.log(
      `[connectWhatsApp] Active socket already exists for account ${waAccountId}. Cleaning up old socket first...`
    );
    try {
      const oldSock = activeSockets[waAccountId];
      oldSock.ev.removeAllListeners('connection.update');
      oldSock.ev.removeAllListeners('creds.update');
      oldSock.ev.removeAllListeners('messages.upsert');
      oldSock.end();
    } catch (err) {
      console.warn(`[connectWhatsApp] Error ending old socket:`, err);
    }
    delete activeSockets[waAccountId];
  }

  const { state, saveCreds } = await getPostgresAuthState(waAccountId);

  console.log(`[connectWhatsApp] Loaded auth state. Generating socket...`);
  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
  });

  activeSockets[waAccountId] = sock;

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    console.log(`[connectWhatsApp] connection.update event for account ${waAccountId}:`, {
      connection,
      qrExists: !!qr,
      lastDisconnect: lastDisconnect?.message || lastDisconnect?.error,
    });

    if (qr) {
      console.log(`[connectWhatsApp] Emitting QR code to client room ${waAccountId}`);
      try {
        await pool.query('UPDATE wa_accounts SET qr_code = $1 WHERE id = $2', [qr, waAccountId]);
        console.log(`[connectWhatsApp] Saved QR to database for: ${waAccountId}`);
      } catch (dbErr) {
        console.error(`[connectWhatsApp] Failed to save QR to DB:`, dbErr);
      }
      if (io) {
        io.to(waAccountId).emit('qr', { qr });
        console.log(`[connectWhatsApp] QR Emitted.`);
      } else {
        console.warn(`[connectWhatsApp] Cannot emit QR. IO instance is undefined.`);
      }
    }

    if (connection === 'close') {
      const statusCode =
        lastDisconnect?.error?.output?.statusCode ||
        lastDisconnect?.error?.statusCode ||
        (lastDisconnect?.error?.output && lastDisconnect.error.output.statusCode);

      const isLoggedOut = statusCode === 401 || statusCode === DisconnectReason.loggedOut;
      const isConflict = statusCode === 440 || statusCode === DisconnectReason.connectionReplaced;
      const shouldReconnect = !isLoggedOut && !isConflict;

      console.warn(
        `[connectWhatsApp] Connection closed for WA account ${waAccountId}. Reconnecting: ${shouldReconnect}, Code: ${statusCode}`
      );

      if (isLoggedOut) {
        console.log(
          `[connectWhatsApp] Purging credentials from database for WA account ${waAccountId} due to logout/unauthorized.`
        );
        await pool.query('DELETE FROM wa_sessions WHERE wa_account_id = $1', [waAccountId]);
      }

      await pool.query('UPDATE wa_accounts SET status = $1, qr_code = NULL WHERE id = $2', [
        'disconnected',
        waAccountId,
      ]);

      if (io) {
        io.to(waAccountId).emit('status', { status: 'disconnected' });
        if (isConflict) {
          io.to(waAccountId).emit('notification', {
            type: 'connection_error',
            message: `Connection conflict for WA account: Session replaced by another connection.`,
          });
        }
      }

      if (shouldReconnect) {
        // Clear any existing reconnect timer to avoid duplicates
        if (reconnectTimers[waAccountId]) {
          clearTimeout(reconnectTimers[waAccountId]);
        }
        reconnectTimers[waAccountId] = setTimeout(() => {
          delete reconnectTimers[waAccountId];
          connectWhatsApp(waAccountId, io);
        }, 5000);
      } else {
        delete activeSockets[waAccountId];
      }
    } else if (connection === 'open') {
      logger.info(`WhatsApp connection established successfully for account ${waAccountId}`);

      const phoneJid = sock.user.id;
      const cleanPhone = phoneJid.split(':')[0];

      await pool.query(
        'UPDATE wa_accounts SET status = $1, phone_number = $2, qr_code = NULL WHERE id = $3',
        ['connected', cleanPhone, waAccountId]
      );

      if (io) {
        io.to(waAccountId).emit('status', { status: 'connected', phone: cleanPhone });
        io.to(waAccountId).emit('notification', {
          type: 'connection',
          message: `WhatsApp account connected: ${cleanPhone}`,
        });
      }
    }
  });

  // Listen to incoming messages for replies
  sock.ev.on('messages.upsert', async (m) => {
    if (m.type !== 'notify') return;

    for (const msg of m.messages) {
      if (!msg.key.fromMe && msg.message) {
        const fromJid = msg.key.remoteJid;
        const phone = fromJid.split('@')[0];
        const content = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

        if (!content) continue;

        logger.info(`Received WhatsApp message from ${phone}: ${content}`);

        // Find if this lead exists for the account's organization
        const leadRes = await pool.query(
          `SELECT l.* FROM leads l
           JOIN wa_accounts wa ON wa.id = l.assigned_wa_account_id OR wa.org_id = l.org_id
           WHERE l.mobile LIKE $1 AND wa.id = $2
           LIMIT 1`,
          [`%${phone}`, waAccountId]
        );

        if (leadRes.rows.length > 0) {
          const lead = leadRes.rows[0];

          // 1. Insert into messages log
          await pool.query(
            'INSERT INTO messages (lead_id, wa_account_id, content, direction, status) VALUES ($1, $2, $3, $4, $5)',
            [lead.id, waAccountId, content, 'inbound', 'received']
          );

          // 2. Update lead status to replied
          await pool.query(
            'UPDATE leads SET status = $1, replied_at = CURRENT_TIMESTAMP WHERE id = $2',
            ['replied', lead.id]
          );

          // 3. Create activity notification
          const notifMsg = `Reply from ${lead.name} (${lead.company || 'No Company'}): "${content.substring(0, 60)}"`;
          await pool.query(
            'INSERT INTO activity_notifications (org_id, type, message, lead_id) VALUES ($1, $2, $3, $4)',
            [lead.org_id, 'reply', notifMsg, lead.id]
          );

          // 4. Trigger Socket.io real-time update
          if (io) {
            io.to(lead.org_id).emit('activity_notification', {
              type: 'reply',
              message: notifMsg,
              leadId: lead.id,
              content,
            });
            io.to(lead.org_id).emit('lead_update', { leadId: lead.id, status: 'replied' });
          }

          // 5. Automated Auto-Responses
          if (lead.campaign_id) {
            try {
              const campaignRes = await pool.query('SELECT * FROM campaigns WHERE id = $1', [
                lead.campaign_id,
              ]);
              if (campaignRes.rows.length > 0) {
                const campaign = campaignRes.rows[0];
                const autoResponses = campaign.auto_responses || [];
                if (Array.isArray(autoResponses) && autoResponses.length > 0) {
                  const lowerContent = content.toLowerCase().trim();
                  let matchedResponse = null;

                  // Find match in campaign auto responses
                  for (const r of autoResponses) {
                    const kw = (r.keyword || '').toLowerCase().trim();
                    if (!kw) continue;

                    if (r.matchType === 'exact' && lowerContent === kw) {
                      matchedResponse = r.replyText;
                      break;
                    } else if (r.matchType === 'contains' && lowerContent.includes(kw)) {
                      matchedResponse = r.replyText;
                      break;
                    }
                  }

                  // If no specific match, look for default wildcard auto-response
                  if (!matchedResponse) {
                    const defaultResp = autoResponses.find(
                      (r) => r.keyword === '*' || r.matchType === 'default'
                    );
                    if (defaultResp) {
                      matchedResponse = defaultResp.replyText;
                    }
                  }

                  if (matchedResponse) {
                    logger.info(
                      `Triggering auto-response for campaign ${campaign.id} to lead ${lead.id}`
                    );

                    // Helper to format placeholders
                    const formatMessage = (template, leadObj) => {
                      return template
                        .replace(/{{name}}/gi, leadObj.name || '')
                        .replace(/{{company}}/gi, leadObj.company || '')
                        .replace(/{{product}}/gi, leadObj.product || '')
                        .replace(/{{quantity}}/gi, leadObj.quantity || '')
                        .replace(/{{strength}}/gi, leadObj.strength || '')
                        .replace(/{{brand}}/gi, leadObj.brand || '');
                    };

                    const replyMessage = formatMessage(matchedResponse, lead);

                    // Implement Country code format check
                    let cleanMobile = lead.mobile.replace(/\D/g, '');
                    if (cleanMobile.length === 10) {
                      cleanMobile = '91' + cleanMobile;
                    }
                    const replyJid = `${cleanMobile}@s.whatsapp.net`;

                    // Send auto-reply
                    await sock.sendMessage(replyJid, { text: replyMessage });

                    // Log outbound auto-reply message
                    await pool.query(
                      'INSERT INTO messages (lead_id, wa_account_id, content, direction, status) VALUES ($1, $2, $3, $4, $5)',
                      [lead.id, waAccountId, replyMessage, 'outbound', 'sent']
                    );
                  }
                }
              }
            } catch (err) {
              logger.error(`Failed to handle auto-responses for lead ${lead.id}:`, err);
            }
          }
        }
      }
    }
  });

  return sock;
}

function getSocket(waAccountId) {
  return activeSockets[waAccountId];
}

async function getOrInitSocket(waAccountId, io = null) {
  let socket = activeSockets[waAccountId];
  if (!socket) {
    logger.info(
      `Socket not active in memory for WA account ${waAccountId}. Checking database status...`
    );
    const res = await pool.query('SELECT status FROM wa_accounts WHERE id = $1', [waAccountId]);
    if (res.rows.length > 0 && res.rows[0].status === 'connected') {
      logger.info(`WA account ${waAccountId} is marked connected in DB. Auto-connecting...`);
      await connectWhatsApp(waAccountId, io || global.io);

      // Wait for it to connect (up to 15 seconds)
      for (let i = 0; i < 15; i++) {
        const check = await pool.query('SELECT status FROM wa_accounts WHERE id = $1', [
          waAccountId,
        ]);
        if (check.rows[0]?.status === 'connected') {
          const freshSock = activeSockets[waAccountId];
          if (freshSock) {
            socket = freshSock;
            break;
          }
        }
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }
  return socket;
}

async function disconnectWhatsApp(waAccountId) {
  const socket = activeSockets[waAccountId];
  if (socket) {
    logger.info(`Disconnecting and logging out WA account socket for ${waAccountId}`);
    try {
      await socket.logout();
    } catch (err) {
      logger.warn(`Error during socket logout for ${waAccountId}:`, err);
      try {
        socket.end();
      } catch (e) {
        // ignore
      }
    }
    delete activeSockets[waAccountId];
  }
}

module.exports = {
  connectWhatsApp,
  getSocket,
  getOrInitSocket,
  disconnectWhatsApp,
};
