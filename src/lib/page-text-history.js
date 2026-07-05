import { randomUUID } from 'node:crypto';

export const PAGE_TEXT_HISTORY_LIMIT = 10;

const PAGE_TEXT_HISTORY_SOURCES = new Set([
  'manual-edit',
  'ocr',
  'replacement',
  'suspicious-word',
  'restore'
]);

function safeTimestamp(value) {
  const timestamp = value ? new Date(value) : new Date();
  return Number.isNaN(timestamp.getTime()) ? new Date().toISOString() : timestamp.toISOString();
}

function textHistoryId(createdAt) {
  return `text-history-${createdAt.replace(/\D/g, '').slice(0, 14)}-${randomUUID().slice(0, 8)}`;
}

export function buildPageTextHistoryEntry(text, options = {}) {
  const createdAt = safeTimestamp(options.createdAt);
  const source = PAGE_TEXT_HISTORY_SOURCES.has(options.source) ? options.source : 'manual-edit';

  return {
    id: String(options.id || textHistoryId(createdAt)),
    source,
    createdAt,
    note: String(options.note || '').trim(),
    text: String(text || '')
  };
}

export function normalizePageTextHistory(entries = []) {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries
    .map((entry) => ({
      id: String(entry?.id || '').trim(),
      source: String(entry?.source || ''),
      createdAt: safeTimestamp(entry?.createdAt),
      note: String(entry?.note || '').trim(),
      text: String(entry?.text || '')
    }))
    .filter((entry) => entry.id && PAGE_TEXT_HISTORY_SOURCES.has(entry.source) && entry.text.trim())
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, PAGE_TEXT_HISTORY_LIMIT);
}
