import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)));
const port = Number(process.env.PORT || 4173);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8'
};

createServer(async (request, response) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
  catch { response.writeHead(400).end('Bad request'); return; }
  const deploymentPath = pathname === '/connector-tracker' ? '/' : pathname.startsWith('/connector-tracker/') ? pathname.slice('/connector-tracker'.length) : pathname;
  const requested = resolve(root, `.${deploymentPath === '/' ? '/index.html' : deploymentPath}`);
  if (requested !== root && !requested.startsWith(`${root}${sep}`)) { response.writeHead(403).end('Forbidden'); return; }
  try {
    const body = await readFile(requested);
    response.writeHead(200, { 'content-type': types[extname(requested)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    response.end(body);
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`Connector Tracker available at http://localhost:${port}`));
