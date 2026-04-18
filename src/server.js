import { createReadStream } from 'node:fs';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import { LibraryStore } from './lib/storage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const PORT = Number(process.env.PORT || 5173);
const HOST = process.env.HOST || '127.0.0.1';
const MAX_BODY_BYTES = 60 * 1024 * 1024;
const INBOX_SCAN_INTERVAL_MS = 5000;

const store = new LibraryStore(ROOT_DIR);
const activeInboxScans = new Set();
const execFileAsync = promisify(execFile);

const MIME_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.epub', 'application/epub+zip']
]);

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  response.end(JSON.stringify(payload));
}

function sendError(response, error) {
  const statusCode = error.statusCode || 500;
  sendJson(response, statusCode, {
    error: error.message || 'Error inesperado.'
  });
}

async function readBody(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw Object.assign(new Error('La peticion es demasiado grande.'), { statusCode: 413 });
    }
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function routeParts(url) {
  return url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
}

async function chooseFolder() {
  try {
    const { stdout } = await execFileAsync(
      'osascript',
      ['-e', 'POSIX path of (choose folder with prompt "Selecciona la carpeta de entrada de BookSaver")'],
      { maxBuffer: 1024 * 1024 }
    );
    return stdout.trim().replace(/\/$/, '');
  } catch {
    throw Object.assign(new Error('Seleccion de carpeta cancelada o no disponible.'), {
      statusCode: 400
    });
  }
}

async function handleApi(request, response, url) {
  const parts = routeParts(url);

  if (request.method === 'GET' && parts.join('/') === 'api/projects') {
    sendJson(response, 200, { projects: await store.listProjects() });
    return;
  }

  if (request.method === 'POST' && parts.join('/') === 'api/folder-picker') {
    sendJson(response, 200, { path: await chooseFolder() });
    return;
  }

  if (request.method === 'POST' && parts.join('/') === 'api/projects') {
    const body = await readBody(request);
    sendJson(response, 201, { project: await store.createProject(body) });
    return;
  }

  if (parts[0] !== 'api' || parts[1] !== 'projects' || !parts[2]) {
    throw Object.assign(new Error('Ruta API no encontrada.'), { statusCode: 404 });
  }

  const projectId = parts[2];

  if (request.method === 'GET' && parts.length === 3) {
    sendJson(response, 200, { project: await store.getProject(projectId) });
    return;
  }

  if (request.method === 'PATCH' && parts.length === 3) {
    const body = await readBody(request);
    sendJson(response, 200, { project: await store.updateProject(projectId, body) });
    return;
  }

  if (request.method === 'PATCH' && parts.length === 4 && parts[3] === 'inbox') {
    const body = await readBody(request);
    sendJson(response, 200, { project: await store.updateInbox(projectId, body) });
    return;
  }

  if (request.method === 'PATCH' && parts.length === 4 && parts[3] === 'cover') {
    const body = await readBody(request);
    sendJson(response, 200, { project: await store.updateProjectCover(projectId, body) });
    return;
  }

  if (request.method === 'POST' && parts.length === 4 && parts[3] === 'cover') {
    const body = await readBody(request);
    sendJson(response, 200, { project: await store.uploadProjectCover(projectId, body.imageData) });
    return;
  }

  if (request.method === 'GET' && parts.length === 5 && parts[3] === 'cover' && parts[4] === 'image') {
    const image = await store.projectCoverImage(projectId);
    response.writeHead(200, {
      'Content-Type': image.mime,
      'Cache-Control': 'no-store'
    });
    createReadStream(image.filePath).pipe(response);
    return;
  }

  if (request.method === 'POST' && parts.length === 5 && parts[3] === 'inbox' && parts[4] === 'scan') {
    sendJson(response, 200, await scanInbox(projectId));
    return;
  }

  if (request.method === 'POST' && parts.length === 4 && parts[3] === 'pages') {
    const body = await readBody(request);
    sendJson(response, 201, { page: await store.addPage(projectId, body.imageData) });
    return;
  }

  if (request.method === 'PATCH' && parts.length === 4 && parts[3] === 'pages') {
    const body = await readBody(request);
    sendJson(response, 200, { pages: await store.reorderPages(projectId, body.pageIds) });
    return;
  }

  if (parts.length >= 5 && parts[3] === 'pages') {
    const pageId = parts[4];

    if (request.method === 'GET' && parts.length === 6 && parts[5] === 'image') {
      const image = await store.imagePath(projectId, pageId);
      response.writeHead(200, {
        'Content-Type': image.mime,
        'Cache-Control': 'no-store'
      });
      createReadStream(image.filePath).pipe(response);
      return;
    }

    if (request.method === 'GET' && parts.length === 5) {
      sendJson(response, 200, { page: await store.getPagePayload(projectId, pageId) });
      return;
    }

    if (request.method === 'PATCH' && parts.length === 5) {
      const body = await readBody(request);
      sendJson(response, 200, { page: await store.updatePageText(projectId, pageId, body.text) });
      return;
    }

    if (request.method === 'PATCH' && parts.length === 6 && parts[5] === 'editorial') {
      const body = await readBody(request);
      sendJson(response, 200, {
        page: await store.updatePageEditorial(projectId, pageId, body)
      });
      return;
    }

    if (request.method === 'PATCH' && parts.length === 6 && parts[5] === 'crop') {
      const body = await readBody(request);
      sendJson(response, 200, {
        page: await store.updatePageCrop(projectId, pageId, body)
      });
      return;
    }

    if (request.method === 'DELETE' && parts.length === 5) {
      sendJson(response, 200, { pages: await store.deletePage(projectId, pageId) });
      return;
    }

    if (request.method === 'POST' && parts.length === 6 && parts[5] === 'ocr') {
      sendJson(response, 200, { page: await store.runPageOcr(projectId, pageId) });
      return;
    }
  }

  if (request.method === 'POST' && parts.length === 4 && parts[3] === 'export') {
    sendJson(response, 200, { export: await store.exportEpub(projectId) });
    return;
  }

  if (request.method === 'GET' && parts.length === 5 && parts[3] === 'exports') {
    const filePath = await store.exportPath(projectId, parts[4]);
    response.writeHead(200, {
      'Content-Type': 'application/epub+zip',
      'Content-Disposition': `attachment; filename="${path.basename(filePath)}"`,
      'Cache-Control': 'no-store'
    });
    createReadStream(filePath).pipe(response);
    return;
  }

  throw Object.assign(new Error('Ruta API no encontrada.'), { statusCode: 404 });
}

async function handleStatic(request, response, url) {
  const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
  const requestedPath = path.normalize(path.join(PUBLIC_DIR, pathname));

  if (!requestedPath.startsWith(PUBLIC_DIR)) {
    throw Object.assign(new Error('Ruta no permitida.'), { statusCode: 403 });
  }

  try {
    const file = await readFile(requestedPath);
    response.writeHead(200, {
      'Content-Type': MIME_TYPES.get(path.extname(requestedPath)) || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    response.end(file);
  } catch (error) {
    if (error.code === 'ENOENT') {
      const index = await readFile(path.join(PUBLIC_DIR, 'index.html'));
      response.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store'
      });
      response.end(index);
      return;
    }
    throw error;
  }
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

    if (url.pathname.startsWith('/api/')) {
      await handleApi(request, response, url);
      return;
    }

    await handleStatic(request, response, url);
  } catch (error) {
    sendError(response, error);
  }
});

await store.ensure();

async function scanInbox(projectId) {
  if (activeInboxScans.has(projectId)) {
    return {
      importedPages: [],
      importedCount: 0,
      skippedDuplicates: 0,
      unsupported: [],
      errors: [{ error: 'Ya hay un escaneo de esta carpeta en curso.' }],
      project: await store.getProject(projectId)
    };
  }

  activeInboxScans.add(projectId);
  try {
    return await store.importFromInbox(projectId);
  } finally {
    activeInboxScans.delete(projectId);
  }
}

async function scanWatchedInboxes() {
  const projects = await store.listProjects();
  for (const project of projects) {
    if (!project.inbox?.watch || activeInboxScans.has(project.id)) {
      continue;
    }

    scanInbox(project.id).catch((error) => {
      console.warn(`No se pudo escanear la bandeja de ${project.id}: ${error.message}`);
    });
  }
}

setInterval(scanWatchedInboxes, INBOX_SCAN_INTERVAL_MS).unref();

server.listen(PORT, HOST, () => {
  console.log(`BookSaver listo en http://${HOST}:${PORT}`);
});
