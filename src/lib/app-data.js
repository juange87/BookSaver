import os from 'node:os';
import path from 'node:path';
import { cp, mkdir, readdir, rename, rm, stat } from 'node:fs/promises';

async function pathExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readDirectoryEntries(folderPath) {
  try {
    return await readdir(folderPath, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function moveEntry(sourcePath, destinationPath) {
  try {
    await rename(sourcePath, destinationPath);
    return true;
  } catch (error) {
    if (error.code === 'EXDEV') {
      await cp(sourcePath, destinationPath, {
        recursive: true,
        errorOnExist: true,
        force: false
      });
      await rm(sourcePath, { recursive: true, force: true });
      return true;
    }

    if (error.code === 'EEXIST') {
      return false;
    }

    throw error;
  }
}

export function resolveAppDataDir({
  platform = process.platform,
  env = process.env,
  homeDir = os.homedir()
} = {}) {
  if (platform === 'darwin') {
    return path.join(homeDir, 'Library', 'Application Support', 'BookSaver');
  }

  if (platform === 'win32') {
    return path.join(env.LOCALAPPDATA || path.join(homeDir, 'AppData', 'Local'), 'BookSaver');
  }

  return path.join(env.XDG_DATA_HOME || path.join(homeDir, '.local', 'share'), 'BookSaver');
}

export async function migrateLegacyStorage({ legacyRootDir, dataRootDir } = {}) {
  const resolvedLegacyRootDir = path.resolve(String(legacyRootDir || '.'));
  const resolvedDataRootDir = path.resolve(String(dataRootDir || resolvedLegacyRootDir));
  const summary = {
    legacyRootDir: resolvedLegacyRootDir,
    dataRootDir: resolvedDataRootDir,
    migrated: false,
    movedEntries: 0,
    skippedEntries: 0,
    folders: []
  };

  if (resolvedLegacyRootDir === resolvedDataRootDir) {
    return summary;
  }

  await mkdir(resolvedDataRootDir, { recursive: true });

  for (const folderName of ['books', 'inbox']) {
    const sourceDir = path.join(resolvedLegacyRootDir, folderName);
    const destinationDir = path.join(resolvedDataRootDir, folderName);
    const entries = await readDirectoryEntries(sourceDir);

    if (!entries.length) {
      continue;
    }

    await mkdir(destinationDir, { recursive: true });

    let moved = 0;
    let skipped = 0;

    for (const entry of entries) {
      const sourcePath = path.join(sourceDir, entry.name);
      const destinationPath = path.join(destinationDir, entry.name);

      if (await pathExists(destinationPath)) {
        skipped += 1;
        continue;
      }

      if (await moveEntry(sourcePath, destinationPath)) {
        moved += 1;
      } else {
        skipped += 1;
      }
    }

    summary.folders.push({ name: folderName, moved, skipped });
    summary.movedEntries += moved;
    summary.skippedEntries += skipped;
    summary.migrated ||= moved > 0;

    if ((await readDirectoryEntries(sourceDir)).length === 0) {
      await rm(sourceDir, { recursive: true, force: true });
    }
  }

  return summary;
}
