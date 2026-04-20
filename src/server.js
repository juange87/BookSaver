import { createReadStream } from 'node:fs';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import { resolveAppDataDir } from './lib/app-data.js';
import { inspectRuntimeSupport } from './lib/ocr.js';
import { buildSelfUpdatePlan, launchPortableUpdate } from './lib/self-update.js';
import { LibraryStore } from './lib/storage.js';
import { buildUpdateInfo, fetchLatestRelease } from './lib/updates.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const PACKAGE_JSON_PATH = path.join(ROOT_DIR, 'package.json');
const PORT = Number(process.env.PORT || 5173);
const HOST = process.env.HOST || '127.0.0.1';
const MAX_BODY_BYTES = 60 * 1024 * 1024;
const INBOX_SCAN_INTERVAL_MS = 5000;
const REPOSITORY_URL = 'https://github.com/juange87/BookSaver';
const REPOSITORY_OWNER = 'juange87';
const REPOSITORY_NAME = 'BookSaver';
const RELEASES_URL = `${REPOSITORY_URL}/releases`;
const README_GUIDE_URL = `${REPOSITORY_URL}#instalacion-personas-no-tecnicas`;
const UPDATE_CACHE_TTL_MS = 30 * 60 * 1000;
const UPDATE_ERROR_CACHE_TTL_MS = 5 * 60 * 1000;
const APP_VERSION = JSON.parse(await readFile(PACKAGE_JSON_PATH, 'utf8')).version;
const DATA_ROOT_DIR = resolveAppDataDir();

const store = new LibraryStore(ROOT_DIR, {
  dataRootDir: DATA_ROOT_DIR
});
const activeInboxScans = new Set();
const execFileAsync = promisify(execFile);
const updateState = {
  value: buildUpdateInfo(APP_VERSION),
  expiresAt: 0,
  pending: null
};

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

function summarizeLanguages(languages, limit = 10) {
  if (!languages.length) {
    return 'ninguno';
  }

  const preview = languages.slice(0, limit).join(', ');
  return languages.length > limit ? `${preview} ... (${languages.length} total)` : preview;
}

function buildIssueReportUrl(system) {
  const details = [
    '## Que ha pasado',
    '',
    'Describe aqui el problema.',
    '',
    '## Como reproducirlo',
    '1. ',
    '2. ',
    '3. ',
    '',
    '## Resultado esperado',
    '',
    '## Sistema',
    `- Version de BookSaver: ${APP_VERSION}`,
    `- Sistema operativo: ${system.platformLabel}`,
    `- Node.js: ${process.version}`,
    `- OCR por defecto: ${system.preferredEngineLabel}`,
    `- Tesseract detectado: ${system.tesseractInstalled ? 'si' : 'no'}`,
    `- Idiomas Tesseract: ${summarizeLanguages(system.tesseractLanguages)}`
  ];

  if (system.dataRootDir) {
    details.push(`- Carpeta de datos: ${system.dataRootDir}`);
  }

  return `${REPOSITORY_URL}/issues/new?title=${encodeURIComponent('Error en BookSaver')}&body=${encodeURIComponent(details.join('\n'))}`;
}

async function getUpdateInfo({ refresh = false } = {}) {
  const now = Date.now();

  if (!refresh && updateState.expiresAt > now) {
    return updateState.value;
  }

  if (updateState.pending) {
    return updateState.pending;
  }

  updateState.pending = (async () => {
    try {
      const release = await fetchLatestRelease({
        owner: REPOSITORY_OWNER,
        repo: REPOSITORY_NAME
      });
      updateState.value = buildUpdateInfo(APP_VERSION, release);
      updateState.expiresAt = Date.now() + UPDATE_CACHE_TTL_MS;
      return updateState.value;
    } catch (error) {
      updateState.value = buildUpdateInfo(APP_VERSION, null, error);
      updateState.expiresAt = Date.now() + UPDATE_ERROR_CACHE_TTL_MS;
      return updateState.value;
    } finally {
      updateState.pending = null;
    }
  })();

  return updateState.pending;
}

async function chooseFolderMacOS() {
  const { stdout } = await execFileAsync(
    'osascript',
    ['-e', 'POSIX path of (choose folder with prompt "Selecciona la carpeta de entrada de BookSaver")'],
    { maxBuffer: 1024 * 1024 }
  );
  return stdout.trim().replace(/\/$/, '');
}

async function chooseFolderWindows() {
  const script = [
    'Add-Type -AssemblyName System.Windows.Forms',
    '$dialog = New-Object System.Windows.Forms.FolderBrowserDialog',
    '$dialog.Description = "Selecciona la carpeta de entrada de BookSaver"',
    '$dialog.ShowNewFolderButton = $true',
    'if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {',
    '  [Console]::Out.Write($dialog.SelectedPath)',
    '} else {',
    '  exit 1',
    '}'
  ].join('; ');

  const { stdout } = await execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-STA', '-Command', script],
    { maxBuffer: 1024 * 1024 }
  );
  return stdout.trim();
}

async function chooseFolder() {
  if (process.platform === 'darwin') {
    try {
      return await chooseFolderMacOS();
    } catch {
      throw Object.assign(new Error('Seleccion de carpeta cancelada o no disponible.'), {
        statusCode: 400
      });
    }
  }

  if (process.platform === 'win32') {
    try {
      return await chooseFolderWindows();
    } catch {
      throw Object.assign(new Error('Seleccion de carpeta cancelada o no disponible.'), {
        statusCode: 400
      });
    }
  }

  throw Object.assign(
    new Error('El selector de carpetas nativo solo esta disponible en macOS y Windows.'),
    { statusCode: 400 }
  );
}

async function handleApi(request, response, url) {
  const parts = routeParts(url);

  if (request.method === 'GET' && parts.join('/') === 'api/system') {
    const system = await inspectRuntimeSupport();
    const update = await getUpdateInfo({
      refresh: ['1', 'true', 'yes'].includes(String(url.searchParams.get('refresh') || '').toLowerCase())
    });
    const storage = store.getStorageInfo();
    const updatePlan = await buildSelfUpdatePlan({
      appRootDir: ROOT_DIR,
      platform: process.platform,
      updateInfo: update,
      releasesUrl: RELEASES_URL
    });
    sendJson(response, 200, {
      system: {
        ...system,
        appVersion: APP_VERSION,
        releasesUrl: RELEASES_URL,
        dataRootDir: storage.dataRootDir,
        storage,
        update: {
          ...update,
          ...updatePlan
        },
        nodeVersion: process.version,
        links: {
          setupGuide: README_GUIDE_URL,
          reportIssue: buildIssueReportUrl({
            ...system,
            dataRootDir: storage.dataRootDir
          }),
          releases: RELEASES_URL
        }
      }
    });
    return;
  }

  if (request.method === 'POST' && parts.join('/') === 'api/system/update') {
    const update = await getUpdateInfo({ refresh: true });
    if (update.error) {
      throw Object.assign(
        new Error('No se pudo comprobar la última versión de BookSaver en GitHub.'),
        { statusCode: 400 }
      );
    }

    if (!update.available) {
      throw Object.assign(new Error('No hay una versión nueva disponible ahora mismo.'), {
        statusCode: 400
      });
    }

    const updatePlan = await buildSelfUpdatePlan({
      appRootDir: ROOT_DIR,
      platform: process.platform,
      updateInfo: update,
      releasesUrl: RELEASES_URL
    });

    if (!updatePlan.autoInstallSupported) {
      throw Object.assign(new Error(updatePlan.guideMessage), { statusCode: 400 });
    }

    await launchPortableUpdate({
      appRootDir: ROOT_DIR,
      platform: process.platform,
      updateInfo: update
    });

    sendJson(response, 202, {
      message: `Instalando BookSaver ${update.latestVersion}. La pestaña volverá a conectarse cuando el servidor se reinicie.`,
      expectedVersion: update.latestVersion
    });

    setTimeout(() => process.exit(0), 800).unref();
    return;
  }

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

    if (request.method === 'PATCH' && parts.length === 6 && parts[5] === 'rotation') {
      const body = await readBody(request);
      sendJson(response, 200, {
        page: await store.updatePageRotation(projectId, pageId, body)
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

  if (request.method === 'GET' && parts.length === 5 && parts[3] === 'export' && parts[4] === 'check') {
    sendJson(response, 200, { check: await store.inspectExport(projectId) });
    return;
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
  console.log(`Datos de usuario en ${store.getStorageInfo().dataRootDir}`);
});
