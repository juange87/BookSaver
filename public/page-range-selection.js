export function extendSelection(orderedIds, selectedIds, anchorId, targetId, checked) {
  const next = new Set(selectedIds);
  const targetIndex = orderedIds.indexOf(targetId);
  const anchorIndex = anchorId ? orderedIds.indexOf(anchorId) : -1;
  const span =
    anchorIndex >= 0 && targetIndex >= 0
      ? orderedIds.slice(Math.min(anchorIndex, targetIndex), Math.max(anchorIndex, targetIndex) + 1)
      : [targetId];

  for (const id of span) {
    if (checked) {
      next.add(id);
    } else {
      next.delete(id);
    }
  }
  return next;
}

export function selectionBounds(pages, selectedIds) {
  const numbers = (pages || [])
    .filter((page) => selectedIds.has(page.id))
    .map((page) => Number(page.number))
    .filter(Number.isFinite);

  if (!numbers.length) {
    return null;
  }
  return { start: Math.min(...numbers), end: Math.max(...numbers) };
}

export function adjacentPageId(visiblePages, currentId, direction) {
  const list = visiblePages || [];
  if (!list.length) {
    return null;
  }
  const index = list.findIndex((page) => page.id === currentId);
  if (index < 0) {
    return list[0].id;
  }
  return list[index + direction]?.id || null;
}
