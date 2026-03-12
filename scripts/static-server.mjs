import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const rootArg = process.argv[2] ?? 'dist-single';
const port = Number.parseInt(process.argv[3] ?? '4174', 10);
const host = process.argv[4] ?? '127.0.0.1';
const rootDir = resolve(process.cwd(), rootArg);

const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.svg', 'image/svg+xml'],
  ['.ico', 'image/x-icon'],
]);

function getMimeType(pathname) {
  return mimeTypes.get(extname(pathname).toLowerCase()) ?? 'application/octet-stream';
}

function resolveRequestPath(urlPathname) {
  const normalizedPath = normalize(decodeURIComponent(urlPathname)).replace(/^(\.\.[/\\])+/, '');
  const relativePath = normalizedPath === '/' ? 'index.html' : normalizedPath.replace(/^[/\\]+/, '');
  return join(rootDir, relativePath);
}

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? `${host}:${port}`}`);
    const filePath = resolveRequestPath(requestUrl.pathname);
    const file = await readFile(filePath);
    response.writeHead(200, {
      'Content-Type': getMimeType(filePath),
      'Cache-Control': 'no-store',
    });
    response.end(file);
  } catch {
    response.writeHead(404, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    response.end('Not found');
  }
});

server.listen(port, host, () => {
  console.log(`Serving ${rootDir}`);
  console.log(`Local:   http://${host}:${port}`);
});
