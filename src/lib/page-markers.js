export const PAGE_MARKER_TAGS = [
  'favorite',
  'review-later',
  'ocr-problem',
  'image-problem',
  'editorial-question'
];

const PAGE_MARKER_TAG_SET = new Set(PAGE_MARKER_TAGS);
const MAX_MARKER_NOTE_LENGTH = 500;

export function normalizePageMarkers(input = {}) {
  const tagsInput = Array.isArray(input.tags) ? input.tags : input.markerTags;
  const noteInput = Object.prototype.hasOwnProperty.call(input, 'note') ? input.note : input.markerNote;
  const tags = [];

  for (const tag of Array.isArray(tagsInput) ? tagsInput : []) {
    const normalizedTag = String(tag || '').trim();
    if (PAGE_MARKER_TAG_SET.has(normalizedTag) && !tags.includes(normalizedTag)) {
      tags.push(normalizedTag);
    }
  }

  return {
    tags,
    note: String(noteInput || '').trim().slice(0, MAX_MARKER_NOTE_LENGTH)
  };
}

export function pageHasMarkerTag(page, tag) {
  if (!PAGE_MARKER_TAG_SET.has(tag)) {
    return false;
  }
  return normalizePageMarkers(page?.markers || page).tags.includes(tag);
}

export function filterPagesByMarkerTag(pages = [], tag = 'all') {
  if (!PAGE_MARKER_TAG_SET.has(tag)) {
    return pages;
  }
  return pages.filter((page) => pageHasMarkerTag(page, tag));
}
