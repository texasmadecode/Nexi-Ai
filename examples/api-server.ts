// Nexi AI - Example HTTP API Server
// Run: npx tsx examples/api-server.ts

import http from 'http';
import { createNexi } from '../src/index.js';

const nexi = createNexi({ dataDir: './data' });

const PORT = process.env.PORT || 3000;

const parseBody = (req: http.IncomingMessage): Promise<any> => {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
};

const sendJson = (res: http.ServerResponse, data: any, status = 200) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    // Health check
    if (url.pathname === '/api/health' && req.method === 'GET') {
      const available = await nexi.isProviderAvailable();
      sendJson(res, { status: available ? 'ok' : 'degraded', provider: available });
      return;
    }

    // Get state
    if (url.pathname === '/api/state' && req.method === 'GET') {
      sendJson(res, nexi.getState());
      return;
    }

    // Get memory stats
    if (url.pathname === '/api/stats' && req.method === 'GET') {
      sendJson(res, nexi.getMemoryStats());
      return;
    }

    // Search memories
    if (url.pathname === '/api/memories' && req.method === 'GET') {
      const query = url.searchParams.get('q') || '';
      const memories = nexi.searchMemories(query);
      sendJson(res, { memories });
      return;
    }

    // Chat endpoint
    if (url.pathname === '/api/chat' && req.method === 'POST') {
      const body = await parseBody(req);
      const { message, stream } = body;

      if (!message) {
        sendJson(res, { error: 'message is required' }, 400);
        return;
      }

      if (stream) {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        });

        await nexi.chat(message, {
          stream: true,
          onToken: (token) => {
            res.write(`data: ${JSON.stringify({ token })}\n\n`);
          },
        });
        res.write('data: [DONE]\n\n');
        res.end();
      } else {
        const response = await nexi.chat(message);
        sendJson(res, { response });
      }
      return;
    }

    // Remember endpoint
    if (url.pathname === '/api/remember' && req.method === 'POST') {
      const body = await parseBody(req);
      const { content, type = 'request', importance = 7 } = body;

      if (!content) {
        sendJson(res, { error: 'content is required' }, 400);
        return;
      }

      const memory = nexi.remember(content, type, importance);
      sendJson(res, { memory });
      return;
    }

    // Set mode
    if (url.pathname === '/api/mode' && req.method === 'POST') {
      const body = await parseBody(req);
      const { mode } = body;

      if (!['react', 'chat', 'think'].includes(mode)) {
        sendJson(res, { error: 'Invalid mode. Use: react, chat, think' }, 400);
        return;
      }

      nexi.setMode(mode);
      sendJson(res, { mode: nexi.getState().mode });
      return;
    }

    // Process memories
    if (url.pathname === '/api/process-memories' && req.method === 'POST') {
      const memories = await nexi.processMemories();
      sendJson(res, { memories });
      return;
    }

    // Clear conversation
    if (url.pathname === '/api/clear' && req.method === 'POST') {
      nexi.clearConversation();
      sendJson(res, { success: true });
      return;
    }

    // Conversation history
    if (url.pathname === '/api/history' && req.method === 'GET') {
      sendJson(res, { messages: nexi.getConversationHistory() });
      return;
    }

    // 404
    sendJson(res, { error: 'Not found' }, 404);
  } catch (error) {
    console.error('Error:', error);
    sendJson(res, { error: 'Internal server error' }, 500);
  }
});

server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════╗
║          Nexi AI - HTTP API Server        ║
╠═══════════════════════════════════════════╣
║  Server running on http://localhost:${PORT}  ║
╠═══════════════════════════════════════════╣
║  Endpoints:                               ║
║    POST /api/chat      - Chat with Nexi   ║
║    POST /api/remember  - Store memory     ║
║    GET  /api/memories  - Search memories  ║
║    GET  /api/state     - Get state        ║
║    POST /api/mode      - Set mode         ║
║    GET  /api/stats     - Memory stats     ║
║    GET  /api/history   - Conversation     ║
║    POST /api/clear     - Clear history    ║
║    GET  /api/health    - Health check     ║
╚═══════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\nShutting down...');
  nexi.shutdown();
  server.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\nShutting down...');
  nexi.shutdown();
  server.close();
  process.exit(0);
});
