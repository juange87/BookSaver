import { randomUUID } from 'node:crypto';

export const BOOK_SNAPSHOT_VERSION = 1;
export const BOOK_SNAPSHOT_RETENTION_LIMIT = 10;

const SNAPSHOT_REASONS = new Set([
  'manual',
  'delete-page',
  'reorder-pages',
  'crop-range',
  'mark-reviewed-range',
  'rotate-range',
  'run-ocr',
  'dictionary-replacements',
  'import-inbox',
  'restore-snapshot'
]);

function cleanReason(reason) {
  const value = String(reason || 'manual').trim();
  return SNAPSHOT_REASONS.has(value) ? value : 'manual';
}

function safeTimestamp(value) {
  const date = new Date(value || Date.now());
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function snapshotId(createdAt, id = '') {
  const cleanId = String(id || '').trim();
  if (/^snapshot-[a-z0-9-]+$/u.test(cleanId)) {
    return cleanId;
  }

  const timestamp = safeTimestamp(createdAt)
    .replace(/[-:]/gu, '')
    .replace(/\.\d{3}Z$/u, 'z')
    .toLowerCase();
  return `snapshot-${timestamp}-${randomUUID().slice(0, 8)}`;
}

function stripLocalSourcePaths(source) {
  if (!source || typeof source !== 'object') {
    return source || null;
  }

  const next = { ...source };
  delete next.path;
  delete next.fingerprint;
  return next;
}

function sanitizeMetadata(metadata = {}) {
  const inbox = metadata.inbox || {};
  return {
    ...metadata,
    inbox: {
      ...inbox,
      path: '',
      watch: Boolean(inbox.watch)
    }
  };
}

function sanitizePage(page = {}) {
  return {
    ...page,
    source: stripLocalSourcePaths(page.source),
    ocrText: String(page.ocrText || ''),
    layoutData: page.layoutData || null
  };
}

function cleanSummary(summary = {}) {
  const affectedPageIds = Array.isArray(summary.affectedPageIds)
    ? summary.affectedPageIds.map((pageId) => String(pageId)).filter(Boolean)
    : [];

  return {
    ...summary,
    affectedPageIds
  };
}

export function buildBookSnapshot({
  id = '',
  metadata = {},
  pages = [],
  reason = 'manual',
  summary = {},
  createdAt = new Date().toISOString()
} = {}) {
  const timestamp = safeTimestamp(createdAt);
  const snapshotPages = Array.isArray(pages) ? pages.map(sanitizePage) : [];

  return {
    format: 'booksaver-snapshot',
    version: BOOK_SNAPSHOT_VERSION,
    id: snapshotId(timestamp, id),
    reason: cleanReason(reason),
    createdAt: timestamp,
    metadata: sanitizeMetadata(metadata),
    summary: {
      ...cleanSummary(summary),
      pageCount: snapshotPages.length
    },
    pages: snapshotPages
  };
}

export function snapshotSummary(snapshot = {}, fileName = '') {
  return {
    id: String(snapshot.id || ''),
    reason: cleanReason(snapshot.reason),
    createdAt: safeTimestamp(snapshot.createdAt),
    pageCount: Number(snapshot.summary?.pageCount ?? snapshot.pages?.length ?? 0),
    affectedPageIds: Array.isArray(snapshot.summary?.affectedPageIds)
      ? snapshot.summary.affectedPageIds
      : [],
    ...(fileName ? { fileName } : {})
  };
}
