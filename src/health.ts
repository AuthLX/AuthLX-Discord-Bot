import http from 'http';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { Client } from 'discord.js';
import { config } from './config';

export function startHealthServer(client: Client) {
  const port = process.env.BOT_HEALTH_PORT ? parseInt(process.env.BOT_HEALTH_PORT, 10) : 3002;

  const server = http.createServer(async (req, res) => {
    if (req.url === '/health' && req.method === 'GET') {
      const checks: Record<string, any> = {
        discord: {
          status: 'offline',
          latency: -1
        },
        backend_api: {
          status: 'offline',
          latency: -1
        },
        storage: {
          status: 'unknown'
        }
      };

      let overallHealthy = true;

      // 1. Discord Gateway Check
      if (client.isReady()) {
        checks.discord.status = 'online';
        checks.discord.latency = client.ws.ping;
      } else {
        overallHealthy = false;
      }

      // 2. Backend API Check
      const apiStart = performance.now();
      try {
        const apiRes = await axios.get(`${config.apiUrl}/health`, { timeout: 5000 });
        checks.backend_api.latency = Math.round(performance.now() - apiStart);
        if (apiRes.data && apiRes.data.status === 'success') {
          checks.backend_api.status = 'online';
        } else {
          checks.backend_api.status = 'degraded';
          overallHealthy = false;
        }
      } catch (err: any) {
        checks.backend_api.status = 'offline';
        checks.backend_api.error = err.message;
        overallHealthy = false;
      }

      // 3. Storage check
      try {
        const testFile = path.join(process.cwd(), 'data', 'health_test.tmp');
        // Ensure data dir exists
        const dataDir = path.dirname(testFile);
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }
        fs.writeFileSync(testFile, 'OK', 'utf-8');
        fs.unlinkSync(testFile);
        checks.storage.status = 'writable';
      } catch (err: any) {
        checks.storage.status = 'readonly';
        checks.storage.error = err.message;
        overallHealthy = false;
      }

      res.writeHead(overallHealthy ? 200 : 503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: overallHealthy ? 'online' : 'error',
        timestamp: new Date().toISOString(),
        checks
      }, null, 2));
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    }
  });

  server.listen(port, () => {
    console.log(`📡 Bot Health Server is running on port ${port}  →  GET /health`);
  });
}
