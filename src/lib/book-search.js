const DEFAULT_CONTEXT_LENGTH = 40;
const DEFAULT_MAX_MATCHES_PER_PAGE = 20;

function normalizeQuery(query) {
  return String(query || '').trim().replace(/\s+/g, ' ');
}

function searchableText(page) {
  if (page?.editorial?.imageMode === 'image') {
    return '';
  }
  return String(page?.text ?? page?.ocrText ?? '');
}

function buildExcerpt(text, index, length, contextLength) {
  const start = Math.max(0, index - contextLength);
  const end = Math.min(text.length, index + length + contextLength);
  const prefix = start > 0 ? '...' : '';
  const suffix = end < text.length ? '...' : '';
  const body = text.slice(start, end).replace(/\s+/g, ' ').trim();
  return `${prefix}${body}${suffix}`;
}

function pageMatches(page, query, options) {
  const text = searchableText(page);
  if (!text) {
    return [];
  }

  const needle = query.toLocaleLowerCase();
  const haystack = text.toLocaleLowerCase();
  const matches = [];
  let index = haystack.indexOf(needle);

  while (index !== -1 && matches.length < options.maxMatchesPerPage) {
    matches.push({
      index,
      length: query.length,
      excerpt: buildExcerpt(text, index, query.length, options.contextLength)
    });
    index = haystack.indexOf(needle, index + Math.max(needle.length, 1));
  }

  return matches;
}

export function searchBookText(pages = [], query, options = {}) {
  const normalizedQuery = normalizeQuery(query);
  if (!normalizedQuery) {
    return {
      query: '',
      totalMatches: 0,
      pages: []
    };
  }

  const searchOptions = {
    contextLength: Number(options.contextLength || DEFAULT_CONTEXT_LENGTH),
    maxMatchesPerPage: Number(options.maxMatchesPerPage || DEFAULT_MAX_MATCHES_PER_PAGE)
  };
  const resultPages = [];
  let totalMatches = 0;

  for (const page of pages) {
    const matches = pageMatches(page, normalizedQuery, searchOptions);
    if (!matches.length) {
      continue;
    }

    totalMatches += matches.length;
    resultPages.push({
      pageId: page.id,
      pageNumber: page.number,
      matchCount: matches.length,
      matches
    });
  }

  return {
    query: normalizedQuery,
    totalMatches,
    pages: resultPages
  };
}
