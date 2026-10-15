export function startCaptureSession(pages = []) {
  return { baselineIds: (pages || []).map((page) => page.id) };
}

export function summarizeCaptureSession(session, pages = []) {
  const empty = { count: 0, newPageIds: [], firstPageId: null, contiguous: false, range: null };
  if (!session) {
    return empty;
  }

  const baseline = new Set(session.baselineIds || []);
  const newPages = (pages || []).filter((page) => !baseline.has(page.id));
  if (!newPages.length) {
    return empty;
  }

  const numbers = newPages.map((page) => Number(page.number)).sort((a, b) => a - b);
  const contiguous = numbers.every((value, index) => index === 0 || value === numbers[index - 1] + 1);

  return {
    count: newPages.length,
    newPageIds: newPages.map((page) => page.id),
    firstPageId: newPages[0].id,
    contiguous,
    range: contiguous ? { start: numbers[0], end: numbers[numbers.length - 1] } : null
  };
}
