const { execSync, spawn } = require('child_process');
const net = require('net');

function isPortOpen(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(true); // Port is occupied (Redis is probably running)
      } else {
        resolve(false);
      }
    });
    server.once('listening', () => {
      server.close();
      resolve(false); // Port is free
    });
    server.listen(port);
  });
}

async function main() {
  console.log('\n🚀 Starting all services for wa-outbound...\n');

  // 1. Check if Redis is running on port 6379
  const redisRunning = await isPortOpen(6379);
  if (!redisRunning) {
    console.log('📡 Redis is not running on port 6379. Attempting to start it via Docker...');
    try {
      // Try to start a stopped container named wa-redis
      execSync('docker start wa-redis', { stdio: 'ignore' });
      console.log('✅ Started existing docker container: wa-redis\n');
    } catch {
      try {
        // If it does not exist, run a new container
        execSync('docker run -d --name wa-redis -p 6379:6379 redis:alpine', { stdio: 'inherit' });
        console.log('✅ Started new docker container: wa-redis\n');
      } catch (err) {
        console.warn(
          '⚠️ Could not start Redis via Docker automatically. Please ensure Redis is running on port 6379.\n'
        );
      }
    }
  } else {
    console.log('✅ Redis is already running on port 6379.\n');
  }

  // 2. Initialize/migrate Neon DB schema
  console.log('🗄️  Running database schema setup...');
  try {
    execSync('node scripts/init-db.js', { stdio: 'inherit' });
    console.log('✅ Database schema setup completed.\n');
  } catch (err) {
    console.error('❌ Failed to run database setup. Proceeding to start server anyway...\n');
  }

  // 3. Start development server
  console.log('🌐 Starting Next.js development server...\n');
  const devServer = spawn('node', ['server.js'], { stdio: 'inherit', shell: true });

  devServer.on('close', (code) => {
    process.exit(code);
  });
}

main();
