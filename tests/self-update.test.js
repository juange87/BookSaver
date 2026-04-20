import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { buildSelfUpdatePlan, detectInstallMode } from '../src/lib/self-update.js';

test('detectInstallMode recognizes git checkouts', async () => {
  const appRoot = await mkdtemp(path.join(os.tmpdir(), 'booksaver-git-'));

  try {
    await mkdir(path.join(appRoot, '.git'), { recursive: true });
    assert.equal(await detectInstallMode(appRoot), 'git');
  } finally {
    await rm(appRoot, { recursive: true, force: true });
  }
});

test('buildSelfUpdatePlan enables automatic install for source ZIP releases on macOS', async () => {
  const appRoot = await mkdtemp(path.join(os.tmpdir(), 'booksaver-portable-'));

  try {
    await writeFile(path.join(appRoot, 'package.json'), '{ "name": "booksaver" }\n', 'utf8');

    const plan = await buildSelfUpdatePlan({
      appRootDir: appRoot,
      platform: 'darwin',
      arch: 'arm64',
      releasesUrl: 'https://github.com/juange87/BookSaver/releases',
      updateInfo: {
        available: true,
        releaseUrl: 'https://github.com/juange87/BookSaver/releases/tag/v1.1.0',
        zipballUrl: 'https://api.github.com/repos/juange87/BookSaver/zipball/v1.1.0'
      }
    });

    assert.equal(plan.installMode, 'portable');
    assert.equal(plan.portableFlavor, 'source');
    assert.equal(plan.autoInstallSupported, true);
    assert.equal(plan.actionLabel, 'Actualizar ahora');
    assert.equal(plan.downloadUrl, 'https://api.github.com/repos/juange87/BookSaver/zipball/v1.1.0');
  } finally {
    await rm(appRoot, { recursive: true, force: true });
  }
});

test('buildSelfUpdatePlan uses packaged assets for bundled Windows installs', async () => {
  const appRoot = await mkdtemp(path.join(os.tmpdir(), 'booksaver-portable-win-'));

  try {
    await writeFile(path.join(appRoot, 'package.json'), '{ "name": "booksaver" }\n', 'utf8');
    await writeFile(path.join(appRoot, 'node.exe'), 'runtime', 'utf8');

    const plan = await buildSelfUpdatePlan({
      appRootDir: appRoot,
      platform: 'win32',
      arch: 'x64',
      releasesUrl: 'https://github.com/juange87/BookSaver/releases',
      updateInfo: {
        available: true,
        releaseUrl: 'https://github.com/juange87/BookSaver/releases/tag/v1.1.0',
        zipballUrl: 'https://api.github.com/repos/juange87/BookSaver/zipball/v1.1.0',
        assets: [
          {
            name: 'BookSaver-1.1.0-windows-x64.zip',
            browserDownloadUrl: 'https://example.com/BookSaver-1.1.0-windows-x64.zip'
          }
        ]
      }
    });

    assert.equal(plan.installMode, 'portable');
    assert.equal(plan.portableFlavor, 'packaged-windows');
    assert.equal(plan.autoInstallSupported, true);
    assert.equal(plan.downloadUrl, 'https://example.com/BookSaver-1.1.0-windows-x64.zip');
  } finally {
    await rm(appRoot, { recursive: true, force: true });
  }
});

test('buildSelfUpdatePlan disables bundled installs without a matching packaged asset', async () => {
  const appRoot = await mkdtemp(path.join(os.tmpdir(), 'booksaver-portable-win-missing-'));

  try {
    await writeFile(path.join(appRoot, 'package.json'), '{ "name": "booksaver" }\n', 'utf8');
    await writeFile(path.join(appRoot, 'node.exe'), 'runtime', 'utf8');

    const plan = await buildSelfUpdatePlan({
      appRootDir: appRoot,
      platform: 'win32',
      arch: 'x64',
      releasesUrl: 'https://github.com/juange87/BookSaver/releases',
      updateInfo: {
        available: true,
        releaseUrl: 'https://github.com/juange87/BookSaver/releases/tag/v1.1.0',
        zipballUrl: 'https://api.github.com/repos/juange87/BookSaver/zipball/v1.1.0',
        assets: []
      }
    });

    assert.equal(plan.autoInstallSupported, false);
    assert.match(plan.guideMessage || '', /paquete compatible/i);
  } finally {
    await rm(appRoot, { recursive: true, force: true });
  }
});

test('buildSelfUpdatePlan disables automatic install for git checkouts', async () => {
  const appRoot = await mkdtemp(path.join(os.tmpdir(), 'booksaver-git-plan-'));

  try {
    await mkdir(path.join(appRoot, '.git'), { recursive: true });

    const plan = await buildSelfUpdatePlan({
      appRootDir: appRoot,
      platform: 'darwin',
      releasesUrl: 'https://github.com/juange87/BookSaver/releases',
      updateInfo: {
        available: true,
        releaseUrl: 'https://github.com/juange87/BookSaver/releases/tag/v1.1.0',
        zipballUrl: 'https://api.github.com/repos/juange87/BookSaver/zipball/v1.1.0'
      }
    });

    assert.equal(plan.installMode, 'git');
    assert.equal(plan.autoInstallSupported, false);
    assert.match(plan.guideMessage || '', /git pull|ZIP nuevo/i);
  } finally {
    await rm(appRoot, { recursive: true, force: true });
  }
});
