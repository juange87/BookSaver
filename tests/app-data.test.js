import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { migrateLegacyStorage, resolveAppDataDir } from '../src/lib/app-data.js';

test('resolveAppDataDir maps each platform to a system data folder', () => {
  assert.equal(
    resolveAppDataDir({
      platform: 'darwin',
      homeDir: '/Users/demo'
    }),
    path.join('/Users/demo', 'Library', 'Application Support', 'BookSaver')
  );

  assert.equal(
    resolveAppDataDir({
      platform: 'win32',
      homeDir: 'C:\\Users\\demo',
      env: { LOCALAPPDATA: 'C:\\Users\\demo\\AppData\\Local' }
    }),
    path.join('C:\\Users\\demo\\AppData\\Local', 'BookSaver')
  );

  assert.equal(
    resolveAppDataDir({
      platform: 'linux',
      homeDir: '/home/demo',
      env: {}
    }),
    path.join('/home/demo', '.local', 'share', 'BookSaver')
  );
});

test('migrateLegacyStorage moves books and inbox into the app data directory', async () => {
  const legacyRoot = await mkdtemp(path.join(os.tmpdir(), 'booksaver-legacy-'));
  const dataRoot = await mkdtemp(path.join(os.tmpdir(), 'booksaver-data-'));

  try {
    const legacyBooks = path.join(legacyRoot, 'books', 'demo-project');
    const legacyInbox = path.join(legacyRoot, 'inbox', 'demo-project');

    await mkdir(legacyBooks, { recursive: true });
    await mkdir(legacyInbox, { recursive: true });
    await writeFile(path.join(legacyBooks, 'metadata.json'), '{"title":"Demo"}\n', 'utf8');
    await writeFile(path.join(legacyInbox, 'IMG_0001.jpg'), 'fake-image', 'utf8');
    await mkdir(path.join(dataRoot, 'books'), { recursive: true });
    await mkdir(path.join(dataRoot, 'inbox'), { recursive: true });

    const summary = await migrateLegacyStorage({
      legacyRootDir: legacyRoot,
      dataRootDir: dataRoot
    });

    assert.equal(summary.migrated, true);
    assert.equal(summary.movedEntries, 2);
    assert.equal(summary.skippedEntries, 0);
    assert.equal((await stat(path.join(dataRoot, 'books', 'demo-project'))).isDirectory(), true);
    assert.equal((await stat(path.join(dataRoot, 'inbox', 'demo-project'))).isDirectory(), true);
    assert.equal(
      await readFile(path.join(dataRoot, 'books', 'demo-project', 'metadata.json'), 'utf8'),
      '{"title":"Demo"}\n'
    );
    await assert.rejects(stat(path.join(legacyRoot, 'books', 'demo-project')), /ENOENT/);
    await assert.rejects(stat(path.join(legacyRoot, 'inbox', 'demo-project')), /ENOENT/);
  } finally {
    await rm(legacyRoot, { recursive: true, force: true });
    await rm(dataRoot, { recursive: true, force: true });
  }
});
