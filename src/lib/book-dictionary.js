function now() {
  return new Date().toISOString();
}

function cleanTerm(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeTerms(terms = []) {
  const seen = new Map();

  for (const term of Array.isArray(terms) ? terms : []) {
    const cleaned = cleanTerm(term);
    const key = cleaned.toLocaleLowerCase('es');
    if (cleaned && !seen.has(key)) {
      seen.set(key, cleaned);
    }
  }

  return [...seen.values()].sort((left, right) => left.localeCompare(right, 'es'));
}

function normalizeReplacements(replacements = []) {
  const seen = new Set();
  const normalized = [];

  for (const item of Array.isArray(replacements) ? replacements : []) {
    const from = cleanTerm(item?.from);
    const to = cleanTerm(item?.to);
    const key = from.toLocaleLowerCase('es');
    if (!from || seen.has(key)) {
      continue;
    }
    seen.add(key);
    normalized.push({ from, to });
  }

  return normalized;
}

export function normalizeBookDictionary(input = {}) {
  return {
    version: 1,
    updatedAt: input.updatedAt || now(),
    terms: normalizeTerms(input.terms),
    replacements: normalizeReplacements(input.replacements)
  };
}

function replaceAllWithCount(text, from, to) {
  if (!from || !String(text).includes(from)) {
    return { text, count: 0 };
  }

  const pieces = String(text).split(from);
  return {
    text: pieces.join(to),
    count: pieces.length - 1
  };
}

export function previewDictionaryReplacements(text, replacements = []) {
  let nextText = String(text || '');
  const applied = [];
  let changeCount = 0;

  for (const replacement of normalizeReplacements(replacements)) {
    const result = replaceAllWithCount(nextText, replacement.from, replacement.to);
    if (!result.count) {
      continue;
    }
    nextText = result.text;
    changeCount += result.count;
    applied.push({
      ...replacement,
      count: result.count
    });
  }

  return {
    changed: nextText !== String(text || ''),
    changeCount,
    text: nextText,
    replacements: applied
  };
}
