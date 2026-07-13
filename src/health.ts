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
        if (apiRes.data && apiRes.data.status === 'online') {
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
    } else if (req.url === '/terms' && req.method === 'GET') {
      try {
        const termsPath = path.join(process.cwd(), 'legal', 'terms.txt');
        const content = fs.readFileSync(termsPath, 'utf-8');
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(content);
      } catch (err: any) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Error loading Terms of Service.');
      }
    } else if (req.url === '/privacy' && req.method === 'GET') {
      try {
        const privacyPath = path.join(process.cwd(), 'legal', 'privacy.txt');
        const content = fs.readFileSync(privacyPath, 'utf-8');
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(content);
      } catch (err: any) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Error loading Privacy Policy.');
      }
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    }
  });

  server.listen(port, () => {
    const displayUrl = config.healthUrl || `http://localhost:${port}/health`;
    console.log(`📡 Bot Health Server is running on port ${port}  →  ${displayUrl}`);
  });
}
