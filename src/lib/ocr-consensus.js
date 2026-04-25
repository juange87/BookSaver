import { layoutToText } from './layout.js';

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function bigrams(value) {
  const text = normalize(value);
  if (text.length < 2) {
    return new Set(text ? [text] : []);
  }

  const pairs = new Set();
  for (let index = 0; index < text.length - 1; index += 1) {
    pairs.add(text.slice(index, index + 2));
  }
  return pairs;
}

export function lineSimilarity(a, b) {
  const left = bigrams(a);
  const right = bigrams(b);
  if (!left.size && !right.size) {
    return 1;
  }

  const intersection = [...left].filter((item) => right.has(item)).length;
  const union = new Set([...left, ...right]).size;
  return union ? intersection / union : 0;
}

function sortLines(lines) {
  return [...lines].sort((a, b) => Number(a.top || 0) - Number(b.top || 0) || Number(a.left || 0) - Number(b.left || 0));
}

function pickLine(lines) {
  return sortLines(lines).sort((a, b) => Number(b.confidence || 0) - Number(a.confidence || 0))[0];
}

function mergeLines(candidates) {
  const lines = sortLines(candidates.flatMap((candidate) => candidate.layout?.lines || []));
  const groups = [];

  for (const line of lines) {
    const group = groups.find((items) => items.some((item) => lineSimilarity(item.text, line.text) > 0.72));
    if (group) {
      group.push(line);
    } else {
      groups.push([line]);
    }
  }

  return groups.map(pickLine);
}

export function buildConsensusResult(candidates = []) {
  const lines = mergeLines(candidates);
  const blocks = lines
    .filter((line) => String(line.text || '').trim())
    .map((line) => ({
      type: 'paragraph',
      text: String(line.text).trim(),
      confidence: Number(line.confidence || 0)
    }));
  const layout = {
    version: 1,
    source: 'ocr-consensus',
    page: candidates.find((candidate) => candidate.layout?.page)?.layout.page || {},
    textBounds: null,
    lines,
    blocks
  };

  return {
    id: 'consensus:local',
    provider: 'local',
    engine: 'consensus',
    profile: 'apple-vision+tesseract',
    language: candidates.find((candidate) => candidate.language)?.language || null,
    text: layoutToText(layout),
    tsv: '',
    layout,
    warning: null,
    status: blocks.length ? 'ocr-complete' : 'ocr-error'
  };
}
