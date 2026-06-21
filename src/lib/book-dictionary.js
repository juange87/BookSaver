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

