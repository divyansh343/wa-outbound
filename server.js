const http = require('http');
const { Server } = require('socket.io');
const { parse } = require('url');
const next = require('next');
const logger = require('./lib/logger');
const { connectWhatsApp } = require('./lib/baileys-manager');
const { pool } = require('./lib/db');
require('./lib/queue');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const port = process.env.PORT || 3000;

app.prepare().then(async () => {
  const server = http.createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  // Socket.io initialization
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  // Attach socket io globally to connect WhatsApp clients
  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id}`);

    // Join room for organization or whatsapp account specifically
    socket.on('join_org', (orgId) => {
      socket.join(orgId);
      logger.info(`Socket ${socket.id} joined org room: ${orgId}`);
    });

    socket.on('join_wa', (waAccountId) => {
      socket.join(waAccountId);
      logger.info(`Socket ${socket.id} joined WA room: ${waAccountId}`);
    });

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`);
    });
  });

  // Export io server instance globally so it can be called from API routes
  global.io = io;

  // Initialize and reconnect all connected WA accounts from Postgres on Startup
  try {
    const res = await pool.query("SELECT id FROM wa_accounts WHERE status = 'connected'");
    for (const row of res.rows) {
      await connectWhatsApp(row.id, io);
    }
  } catch (err) {
    logger.error('Error auto-connecting WhatsApp accounts on server start:', err);
  }

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      logger.error(
        `Port ${port} is already in use. Please free the port or set the PORT environment variable to use a different port.`
      );
    } else {
      logger.error('Server error occurred:', err);
    }
    process.exit(1);
  });

  server.listen(port, () => {
    logger.info(`> Server ready on http://localhost:${port}`);
  });
});
