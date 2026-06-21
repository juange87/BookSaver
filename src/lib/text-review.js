function dictionaryTermSet(dictionary = {}) {
  return new Set(
    (Array.isArray(dictionary.terms) ? dictionary.terms : [])
      .map((term) => String(term || '').trim().toLocaleLowerCase('es'))
      .filter(Boolean)
  );
}

function contextFor(text, start, end) {
  const left = Math.max(0, start - 24);
  const right = Math.min(text.length, end + 24);
  const prefix = left > 0 ? '...' : '';
  const suffix = right < text.length ? '...' : '';
  return `${prefix}${text.slice(left, right)}${suffix}`.replace(/\s+/g, ' ').trim();
}

function suspicionReason(word) {
  if (/\p{L}/u.test(word) && /\p{N}/u.test(word)) {
    return 'Mezcla letras y digitos que suele indicar un error de OCR.';
  }

  if (/[_�□|]/u.test(word)) {
    return 'Contiene simbolos raros que conviene revisar.';
  }

  if (/[A-Za-z]\p{Lu}{2,}\p{Ll}/u.test(word) || /\p{Ll}\p{Lu}{2,}/u.test(word)) {
    return 'Tiene mayusculas interiores poco habituales.';
  }

  return null;
}

export function normalizeSuspiciousWord(value) {
  return String(value || '').trim().toLocaleLowerCase('es');
}

export function findSuspiciousWords(input = {}) {
  const text = String(input.text || '');
  const acceptedTerms = dictionaryTermSet(input.dictionary);
  const seen = new Set();
  const findings = [];
  const tokenPattern = /[\p{L}\p{N}_�□|'-]{2,}/gu;

  for (const match of text.matchAll(tokenPattern)) {
    const word = match[0].replace(/^['-]+|['-]+$/g, '');
    const normalized = normalizeSuspiciousWord(word);
    if (!word || acceptedTerms.has(normalized) || seen.has(normalized)) {
      continue;
    }

    const reason = suspicionReason(word);
    if (!reason) {
      continue;
    }

    seen.add(normalized);
    findings.push({
      word,
      normalized,
      reason,
      context: contextFor(text, match.index, match.index + match[0].length),
      start: match.index,
      end: match.index + match[0].length
    });
  }

  return findings;
}
