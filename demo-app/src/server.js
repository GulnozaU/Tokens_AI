const http = require('http');
const { authMiddleware } = require('./middleware/auth');
const jwt = require('./utils/jwt');

const PORT = process.env.PORT || 3456;

function parseBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'POST' && req.url === '/login') {
    const body = await parseBody(req);
    const userId = body.username === 'demo' ? 1 : null;
    if (!userId) {
      res.writeHead(401);
      return res.end(JSON.stringify({ error: 'Invalid credentials' }));
    }
    const token = jwt.sign({ userId, username: body.username }, { expiresInSec: 3600 });
    res.writeHead(200);
    return res.end(JSON.stringify({ token }));
  }

  if (req.method === 'GET' && req.url === '/me') {
    return authMiddleware(req, res, () => {
      res.writeHead(200);
      res.end(JSON.stringify({ user: req.user }));
    });
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Demo auth server listening on http://localhost:${PORT}`);
  });
}

module.exports = { server };
