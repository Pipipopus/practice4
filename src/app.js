'use strict';

const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createTicketStore } = require('./store');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const PUBLIC_FILES = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/app.js': ['app.js', 'application/javascript; charset=utf-8'],
  '/styles.css': ['styles.css', 'text/css; charset=utf-8']
};

function sendJson(res, status, data) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(data));
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 100_000) {
      const error = new Error('Тело запроса слишком большое');
      error.httpStatus = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  try { return JSON.parse(text); }
  catch (_) {
    const error = new Error('Ожидается корректный JSON');
    error.httpStatus = 400;
    throw error;
  }
}

function createApp({ seed, testMode = false } = {}) {
  const store = createTicketStore(seed);
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const pathname = url.pathname;

      if (testMode && req.method === 'POST' && pathname === '/api/__reset') {
        store.reset();
        return sendJson(res, 200, { reset: true });
      }
      if (req.method === 'GET' && pathname === '/api/health') {
        return sendJson(res, 200, { status: 'ok' });
      }
      if (req.method === 'GET' && pathname === '/api/tickets') {
        const items = store.list({
          search: url.searchParams.get('search'),
          status: url.searchParams.get('status'),
          category: url.searchParams.get('category'),
          priority: url.searchParams.get('priority')
        });
        return sendJson(res, 200, { items, total: items.length });
      }
      if (req.method === 'POST' && pathname === '/api/tickets') {
        const input = await readJson(req);
        const result = store.create(input);
        if (result.errors) return sendJson(res, 400, { errors: result.errors });
        return sendJson(res, 201, result);
      }
      const match = /^\/api\/tickets\/(\d+)\/status$/.exec(pathname);
      if (req.method === 'PATCH' && match) {
        const body = await readJson(req);
        if (!body || typeof body !== 'object' || !['new','in_progress','resolved'].includes(body.status)) {
          return sendJson(res, 400, { error: 'Недопустимый статус' });
        }
        const result = store.changeStatus(Number(match[1]), body.status);
        if (result.notFound) return sendJson(res, 404, { error: 'Заявка не найдена' });
        if (result.conflict) return sendJson(res, 409, { error: 'Недопустимый переход' });
        return sendJson(res, 200, result);
      }
      if (req.method === 'GET' && PUBLIC_FILES[pathname]) {
        const [file, contentType] = PUBLIC_FILES[pathname];
        const bytes = await fs.readFile(path.join(PUBLIC_DIR, file));
        res.writeHead(200, { 'content-type': contentType, 'cache-control': 'no-store' });
        return res.end(bytes);
      }
      return sendJson(res, 404, { error: 'Ресурс не найден' });
    } catch (err) {
      return sendJson(res, err.httpStatus || 500, { error: err.httpStatus ? err.message : 'Ошибка сервера' });
    }
  });
  return server;
}

module.exports = { createApp };
