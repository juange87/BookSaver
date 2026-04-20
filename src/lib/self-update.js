import { execFile, spawn } from 'node:child_process';
import { mkdtemp, mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { findReleaseAssetForPlatform } from './updates.js';

const execFileAsync = promisify(execFile);

async function pathExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function escapePowerShellString(value) {
  return String(value || '').replace(/'/g, "''");
}

async function detectPortableFlavor(appRootDir, platform = process.platform) {
  if (platform === 'darwin') {
    const bundledNode = path.resolve(appRootDir, '..', '..', 'MacOS', 'node');
    return (await pathExists(bundledNode)) ? 'packaged-macos' : 'source';
  }

  if (platform === 'win32') {
    return (await pathExists(path.join(appRootDir, 'node.exe'))) ? 'packaged-windows' : 'source';
  }

  return 'source';
}

function resolveInstallTargetRoot(appRootDir, portableFlavor) {
  if (portableFlavor === 'packaged-macos') {
    return path.resolve(appRootDir, '..', '..', '..');
  }

  return appRootDir;
}

function resolveDownloadSource(updateInfo, { platform, arch, portableFlavor }) {
  if (portableFlavor === 'packaged-macos' || portableFlavor === 'packaged-windows') {
    const asset = findReleaseAssetForPlatform(updateInfo, { platform, arch });

    if (!asset?.browserDownloadUrl) {
      return null;
    }

    return {
      kind: 'package-asset',
      url: asset.browserDownloadUrl,
      asset
    };
  }

  if (!updateInfo?.zipballUrl) {
    return null;
  }

  return {
    kind: 'source-zip',
    url: updateInfo.zipballUrl,
    asset: null
  };
}

async function extractArchive(archivePath, destinationDir, platform = process.platform) {
  await mkdir(destinationDir, { recursive: true });

  if (platform === 'win32') {
    const command = `Expand-Archive -LiteralPath '${escapePowerShellString(archivePath)}' -DestinationPath '${escapePowerShellString(destinationDir)}' -Force`;
    await execFileAsync('powershell.exe', ['-NoProfile', '-Command', command], {
      maxBuffer: 1024 * 1024 * 20
    });
    return;
  }

  if (platform === 'darwin') {
    await execFileAsync('ditto', ['-x', '-k', archivePath, destinationDir], {
      maxBuffer: 1024 * 1024 * 20
    });
    return;
  }

  throw new Error('El actualizador guiado solo está listo en macOS y Windows.');
}

async function findExtractedRoot(extractDir) {
  const entries = await readdir(extractDir, { withFileTypes: true });
  const firstDirectory = entries.find((entry) => entry.isDirectory());

  if (!firstDirectory) {
    throw new Error('No se pudo leer el contenido de la actualización descargada.');
  }

  return path.join(extractDir, firstDirectory.name);
}

function buildInstallerScript() {
  return `
import { spawn } from 'node:child_process';
import { chmod, cp, readdir, rm } from 'node:fs/promises';
import path from 'node:path';

const [appRootDir, targetRootDir, extractedRootDir] = process.argv.slice(2);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const excluded = new Set(['.git', 'books', 'inbox']);

async function applyUpdate() {
  const entries = await readdir(extractedRootDir, { withFileTypes: true });
  await delay(1200);

  for (const entry of entries) {
    if (excluded.has(entry.name)) {
      continue;
    }

    const sourcePath = path.join(extractedRootDir, entry.name);
    const destinationPath = path.join(targetRootDir, entry.name);
    await rm(destinationPath, { recursive: true, force: true });
    await cp(sourcePath, destinationPath, { recursive: true, force: true });
  }

  const launcher = path.join(appRootDir, 'start-booksaver.command');
  await chmod(launcher, 0o755).catch(() => {});

  const child = spawn(process.execPath, ['src/server.js'], {
    cwd: appRootDir,
    detached: true,
    stdio: 'ignore'
  });
  child.unref();
}

applyUpdate().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
`.trimStart();
}

async function downloadReleaseArchive(downloadUrl, destinationPath, fetchImpl = fetch) {
  const response = await fetchImpl(downloadUrl, {
    headers: {
      Accept: 'application/octet-stream',
      'User-Agent': 'BookSaver'
    }
  });

  if (!response.ok) {
    throw new Error(`No se pudo descargar la actualización (${response.status}).`);
  }

  const archive = Buffer.from(await response.arrayBuffer());
  await writeFile(destinationPath, archive);
}

export async function detectInstallMode(appRootDir) {
  return (await pathExists(path.join(appRootDir, '.git'))) ? 'git' : 'portable';
}

export async function buildSelfUpdatePlan({
  appRootDir,
  platform = process.platform,
  arch = process.arch,
  updateInfo,
  releasesUrl
} = {}) {
  const installMode = await detectInstallMode(appRootDir);

  if (!updateInfo?.available) {
    return {
      installMode,
      autoInstallSupported: false,
      actionLabel: 'Ver versiones',
      guideMessage: 'No hay una versión nueva pendiente de instalar.',
      releaseUrl: updateInfo?.releaseUrl || releasesUrl || null
    };
  }

  if (installMode === 'git') {
    return {
      installMode,
      autoInstallSupported: false,
      actionLabel: 'Abrir release',
      guideMessage:
        'Esta instalación parece un clon de Git. Para actualizarla usa git pull o descarga el ZIP nuevo.',
      releaseUrl: updateInfo.releaseUrl || releasesUrl || null
    };
  }

  if (!['darwin', 'win32'].includes(platform)) {
    return {
      installMode,
      autoInstallSupported: false,
      actionLabel: 'Abrir release',
      guideMessage: 'El actualizador guiado todavía solo está listo en macOS y Windows.',
      releaseUrl: updateInfo.releaseUrl || releasesUrl || null
    };
  }

  const portableFlavor = await detectPortableFlavor(appRootDir, platform);
  const downloadSource = resolveDownloadSource(updateInfo, {
    platform,
    arch,
    portableFlavor
  });

  if (!downloadSource?.url) {
    return {
      installMode,
      portableFlavor,
      autoInstallSupported: false,
      actionLabel: 'Abrir release',
      guideMessage:
        portableFlavor === 'packaged-macos' || portableFlavor === 'packaged-windows'
          ? 'La release nueva no incluye un paquete compatible con esta plataforma.'
          : 'La release nueva no expone un paquete ZIP descargable.',
      releaseUrl: updateInfo.releaseUrl || releasesUrl || null
    };
  }

  return {
    installMode,
    portableFlavor,
    autoInstallSupported: true,
    actionLabel: 'Actualizar ahora',
    guideMessage:
      downloadSource.kind === 'package-asset'
        ? 'BookSaver puede descargar el paquete oficial nuevo y reiniciar el servidor local.'
        : 'BookSaver puede descargar la nueva versión y reiniciar el servidor local.',
    releaseUrl: updateInfo.releaseUrl || releasesUrl || null,
    downloadUrl: downloadSource.url
  };
}

export async function launchPortableUpdate({
  appRootDir,
  platform = process.platform,
  arch = process.arch,
  updateInfo,
  fetchImpl = fetch,
  execPath = process.execPath
} = {}) {
  const portableFlavor = await detectPortableFlavor(appRootDir, platform);
  const downloadSource = resolveDownloadSource(updateInfo, {
    platform,
    arch,
    portableFlavor
  });

  if (!downloadSource?.url) {
    throw new Error('No hay un paquete de actualización compatible disponible para esta versión.');
  }

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'booksaver-update-'));
  const archivePath = path.join(tempRoot, 'release.zip');
  const extractDir = path.join(tempRoot, 'release');
  const installerPath = path.join(tempRoot, 'apply-update.mjs');
  const targetRootDir = resolveInstallTargetRoot(appRootDir, portableFlavor);

  await downloadReleaseArchive(downloadSource.url, archivePath, fetchImpl);
  await extractArchive(archivePath, extractDir, platform);
  const extractedRootDir = await findExtractedRoot(extractDir);
  await writeFile(installerPath, buildInstallerScript(), 'utf8');

  const updater = spawn(execPath, [installerPath, appRootDir, targetRootDir, extractedRootDir], {
    detached: true,
    stdio: 'ignore'
  });
  updater.unref();

  return {
    tempRoot,
    extractedRootDir
  };
}
