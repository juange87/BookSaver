import { buildBookChecklist } from './book-checklist.js';

function pageEditorial(page) {
  return page?.editorial || {};
}

function latestUpdatedAt(metadata = {}, pages = []) {
  const timestamps = [metadata.updatedAt, metadata.createdAt, ...pages.map((page) => page.updatedAt)]
    .filter(Boolean)
    .sort();
  return timestamps.at(-1) || null;
}

function exportStatusFor(pageCount, check) {
  if (pageCount === 0) {
    return 'empty';
  }
  return check.ready ? 'ready' : 'needs-attention';
}

export function buildBookProgress({ metadata = {}, pages = [], checkedAt = new Date().toISOString() } = {}) {
  const safePages = Array.isArray(pages) ? pages : [];
  const check = buildBookChecklist({ metadata, pages: safePages, checkedAt });
  const pageCount = safePages.length;
  const imagePageCount = safePages.filter((page) => pageEditorial(page).imageMode === 'image').length;
  const textPageCount = pageCount - imagePageCount;
  const reviewedPageCount = safePages.filter((page) => Boolean(page.reviewed)).length;
  const pendingReviewCount = Math.max(0, pageCount - reviewedPageCount);
  const reviewedPercent = pageCount ? Math.round((reviewedPageCount / pageCount) * 100) : 0;

  return {
    checkedAt,
    pageCount,
    textPageCount,
    imagePageCount,
    ocrCompleteCount: safePages.filter((page) => page.status === 'ocr-complete').length,
    reviewedPageCount,
    pendingReviewCount,
    reviewedPercent,
    pendingProblemCount: check.warnings.length,
    readyToExport: check.ready,
    exportStatus: exportStatusFor(pageCount, check),
    updatedAt: latestUpdatedAt(metadata, safePages),
    warnings: check.warnings.map((warning) => ({
      code: warning.code,
      severity: warning.severity,
      message: warning.message
    }))
  };
}
