import { createHash } from 'node:crypto';
import path from 'node:path';

import { createStoreZip } from './epub.js';

export const BOOK_PACKAGE_FORMAT = 'booksaver-package';
export const BOOK_PACKAGE_VERSION = 1;
export const BOOK_PACKAGE_EXTENSION = '.booksaver.zip';
export const BOOK_PACKAGE_SIZE_WARNING_BYTES = 500 * 1024 * 1024;

function packageError(message, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}

export function safePackagePath(value, options = {}) {
  const { allowEmpty = false } = options;
  const raw = String(value || '').trim();

  if (!raw) {
    if (allowEmpty) {
      return '';
    }
    throw packageError('El paquete contiene una ruta no segura.');
  }

  if (raw.includes('\0') || raw.includes('\\') || /^[a-z]:/i.test(raw) || path.posix.isAbsolute(raw)) {
    throw packageError('El paquete contiene una ruta no segura.');
  }

  const normalized = path.posix.normalize(raw);
  if (
    normalized === '.' ||
    normalized === '..' ||
    normalized.startsWith('../') ||
    normalized.split('/').includes('..')
  ) {
    throw packageError('El paquete contiene una ruta no segura.');
  }

  return normalized;
}

function sha256(data) {
  return createHash('sha256').update(data).digest('hex');
}

function textFile(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function checksumFile(entries) {
  return entries
    .filter((entry) => entry.name !== 'checksums.sha256')
    .map((entry) => `${sha256(Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data))}  ${entry.name}`)
    .sort((a, b) => a.localeCompare(b))
    .join('\n')
    .concat('\n');
}

function packageManifest({ metadata, pages, assets, createdAt }) {
  const hasCover = assets.some((asset) => asset.name.startsWith('cover/'));

  return {
    format: BOOK_PACKAGE_FORMAT,
    version: BOOK_PACKAGE_VERSION,
    createdAt,
    sourceApp: 'BookSaver',
    projectId: metadata.id,
    title: metadata.title || 'Libro sin titulo',
    pageCount: pages.length,
    includes: {
      metadata: true,
      pages: true,
      ocrText: true,
      layout: assets.some((asset) => asset.name.endsWith('/layout.json')),
      cover: hasCover,
      exports: false
    }
  };
}

export function createBookSaverPackage({ metadata, pages, assets = [], createdAt = new Date().toISOString() }) {
  const normalizedAssets = assets.map((asset) => ({
    name: safePackagePath(asset.name),
    data: Buffer.isBuffer(asset.data) ? asset.data : Buffer.from(asset.data || '')
  }));
  const manifest = packageManifest({ metadata, pages, assets: normalizedAssets, createdAt });
  const entries = [
    {
      name: 'booksaver-package.json',
      data: textFile(manifest)
    },
    {
      name: 'metadata.json',
      data: textFile(metadata)
    },
    {
      name: 'pages.json',
      data: textFile({ pages })
    },
    ...normalizedAssets
  ];
  const withChecksums = [
    ...entries,
    {
      name: 'checksums.sha256',
      data: checksumFile(entries)
    }
  ];

  return {
    archive: createStoreZip(withChecksums),
    manifest,
    entries: withChecksums
  };
}

export function readStoreZipEntries(input) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
  const entries = [];
  const seen = new Set();
  let offset = 0;

  while (offset + 4 <= buffer.length) {
    const signature = buffer.readUInt32LE(offset);

    if (signature === 0x02014b50 || signature === 0x06054b50) {
      break;
    }

    if (signature !== 0x04034b50) {
      throw packageError('El paquete ZIP no tiene una estructura valida.');
    }

    const flags = buffer.readUInt16LE(offset + 6);
    const method = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const uncompressedSize = buffer.readUInt32LE(offset + 22);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const nameEnd = nameStart + nameLength;
    const dataStart = nameEnd + extraLength;
    const dataEnd = dataStart + compressedSize;

    if (flags & 0x08) {
      throw packageError('El paquete ZIP usa descriptores no soportados.');
    }

    if (method !== 0) {
      throw packageError('El paquete ZIP debe estar guardado sin compresion.');
    }

    if (compressedSize !== uncompressedSize || nameEnd > buffer.length || dataEnd > buffer.length) {
      throw packageError('El paquete ZIP no tiene una estructura valida.');
    }

    const name = safePackagePath(buffer.subarray(nameStart, nameEnd).toString('utf8'));
    if (seen.has(name)) {
      throw packageError('El paquete contiene archivos duplicados.');
    }
    seen.add(name);

    if (!name.endsWith('/')) {
      entries.push({
        name,
        data: buffer.subarray(dataStart, dataEnd)
      });
    }

    offset = dataEnd;
  }

  return entries;
}

function entryMapFrom(entries) {
  return new Map(entries.map((entry) => [entry.name, entry.data]));
}

function readJsonEntry(entryMap, name) {
  const data = entryMap.get(name);
  if (!data) {
    throw packageError(`Falta ${name} en el paquete BookSaver.`);
  }

  try {
    return JSON.parse(data.toString('utf8'));
  } catch {
    throw packageError(`${name} no contiene JSON valido.`);
  }
}

function parseChecksums(value = '') {
  return String(value)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = /^([a-f0-9]{64})\s+(.+)$/.exec(line);
      if (!match) {
        throw packageError('El archivo checksums.sha256 no tiene un formato valido.');
      }
      return {
        hash: match[1],
        name: safePackagePath(match[2])
      };
    });
}

function verifyChecksums(entryMap) {
  const checksumData = entryMap.get('checksums.sha256');
  if (!checksumData) {
    return;
  }

  for (const item of parseChecksums(checksumData.toString('utf8'))) {
    const data = entryMap.get(item.name);
    if (!data) {
      throw packageError(`Falta ${item.name}, declarado en checksums.sha256.`);
    }
    if (sha256(data) !== item.hash) {
      throw packageError(`El checksum de ${item.name} no coincide.`);
    }
  }
}

function requiredEntry(entryMap, name, message) {
  const safeName = safePackagePath(name);
  if (!entryMap.has(safeName)) {
    throw packageError(message || `Falta ${safeName} en el paquete BookSaver.`);
  }
  return safeName;
}

function optionalEntry(entryMap, name) {
  if (!name) {
    return null;
  }
  const safeName = safePackagePath(name);
  return entryMap.has(safeName) ? safeName : null;
}

function validateManifest(manifest) {
  if (manifest?.format !== BOOK_PACKAGE_FORMAT) {
    throw packageError('El archivo no es un paquete BookSaver valido.');
  }

  if (manifest.version !== BOOK_PACKAGE_VERSION) {
    throw packageError('Este paquete usa una version de BookSaver mas nueva. Actualiza la app antes de importarlo.');
  }
}

function validatePackageReferences({ entryMap, metadata, pages }) {
  const assetPaths = new Set();

  if (!Array.isArray(pages)) {
    throw packageError('pages.json no contiene una lista de paginas valida.');
  }

  for (const page of pages) {
    assetPaths.add(requiredEntry(entryMap, page.image, `Falta la captura original de ${page.id || 'una pagina'}.`));

    if (page.text) {
      assetPaths.add(requiredEntry(entryMap, page.text, `Falta el texto OCR de ${page.id || 'una pagina'}.`));
    }

    for (const name of [page.tsv, page.layout, page.source?.preservedOriginal]) {
      const safeName = optionalEntry(entryMap, name);
      if (safeName) {
        assetPaths.add(safeName);
      } else if (name) {
        throw packageError(`Falta ${safePackagePath(name)} en el paquete BookSaver.`);
      }
    }
  }

  if (metadata?.cover?.mode === 'upload') {
    assetPaths.add(requiredEntry(entryMap, metadata.cover.image, 'Falta la imagen de portada del paquete.'));
  }

  return assetPaths;
}

export function readBookSaverPackage(input) {
  const entries = readStoreZipEntries(packageBufferFromInput(input));
  const entryMap = entryMapFrom(entries);
  const manifest = readJsonEntry(entryMap, 'booksaver-package.json');

  validateManifest(manifest);
  verifyChecksums(entryMap);

  const metadata = readJsonEntry(entryMap, 'metadata.json');
  const pagesPayload = readJsonEntry(entryMap, 'pages.json');
  const pages = Array.isArray(pagesPayload.pages) ? pagesPayload.pages : [];
  const assetPaths = validatePackageReferences({ entryMap, metadata, pages });

  return {
    entries,
    entryMap,
    manifest,
    metadata,
    pages,
    assetPaths
  };
}

export function packageBufferFromInput(input) {
  if (Buffer.isBuffer(input)) {
    return input;
  }

  if (typeof input !== 'string') {
    throw packageError('No se recibio ningun paquete BookSaver.');
  }

  const dataUrlMatch = /^data:[^;,]+(?:;[^,]+)*;base64,(.+)$/i.exec(input);
  if (dataUrlMatch) {
    return Buffer.from(dataUrlMatch[1], 'base64');
  }

  return Buffer.from(input, 'base64');
}
