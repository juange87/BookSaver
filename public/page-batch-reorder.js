function orderedSelection(pageIds, selectedIds) {
  const selected = new Set(Array.isArray(selectedIds) ? selectedIds : []);
  return pageIds.filter((pageId) => selected.has(pageId));
}

export function movePageSelection(pageIds, selectedIds, target) {
  const orderedPageIds = Array.isArray(pageIds) ? pageIds : [];
  const selected = orderedSelection(orderedPageIds, selectedIds);

  if (selected.length === 0) {
    return orderedPageIds;
  }

  const selectedSet = new Set(selected);
  const remaining = orderedPageIds.filter((pageId) => !selectedSet.has(pageId));

  if (target === 'start') {
    return [...selected, ...remaining];
  }

  if (target === 'end') {
    return [...remaining, ...selected];
  }

  const mode = target?.mode;
  const anchorId = target?.anchorId;
  const anchorIndex = remaining.indexOf(anchorId);
  if (!anchorId || anchorIndex === -1 || selectedSet.has(anchorId)) {
    return orderedPageIds;
  }

  const insertIndex = mode === 'after' ? anchorIndex + 1 : anchorIndex;
  return [
    ...remaining.slice(0, insertIndex),
    ...selected,
    ...remaining.slice(insertIndex)
  ];
}

function sourceTime(page) {
  const source = page?.source || {};
  const values = [source.captureMs, source.mtimeMs, Date.parse(source.capturedAt || ''), Date.parse(page?.createdAt || '')];

  for (const value of values) {
    const timestamp = Number(value);
    if (Number.isFinite(timestamp) && timestamp > 0) {
      return timestamp;
    }
  }

  return Number.MAX_SAFE_INTEGER;
}

function sourceName(page) {
  return String(page?.source?.fileName || page?.id || '');
}

export function sortPageIdsBySource(pages, mode) {
  const sorted = [...(Array.isArray(pages) ? pages : [])];

  sorted.sort((left, right) => {
    if (mode === 'name') {
      const byName = sourceName(left).localeCompare(sourceName(right), undefined, {
        numeric: true,
        sensitivity: 'base'
      });
      if (byName !== 0) {
        return byName;
      }
    } else {
      const byTime = sourceTime(left) - sourceTime(right);
      if (byTime !== 0) {
        return byTime;
      }
    }

    return Number(left.number || 0) - Number(right.number || 0);
  });

  return sorted.map((page) => page.id);
}
