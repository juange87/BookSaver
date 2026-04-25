function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(Number(value || 0) * factor) / factor;
}

function lineConfidence(layout) {
  const lines = (layout?.lines || []).filter((line) => Number.isFinite(Number(line.confidence)));
  if (!lines.length) {
    return 0;
  }
  return lines.reduce((sum, line) => sum + Number(line.confidence), 0) / lines.length;
}

function blockConfidence(layout) {
  const blocks = (layout?.blocks || []).filter((block) => Number.isFinite(Number(block.confidence)));
  if (!blocks.length) {
    return 0;
  }
  return blocks.reduce((sum, block) => sum + Number(block.confidence), 0) / blocks.length;
}

function usefulWordCount(text) {
  return String(text || '')
    .split(/\s+/)
    .filter((word) => /\p{L}{2,}/u.test(word)).length;
}

function suspiciousCharacterRatio(text) {
  const value = String(text || '');
  if (!value.length) {
    return 1;
  }

  const suspicious = [...value].filter((char) => /[�□|_~^={}<>\\]/u.test(char)).length;
  return suspicious / value.length;
}

function punctuationNoiseRatio(text) {
  const value = String(text || '').replace(/\s/g, '');
  if (!value.length) {
    return 1;
  }

  const punctuation = [...value].filter((char) => /[.,:;!?'"()[\]¿¡-]/u.test(char)).length;
  return punctuation / value.length;
}

export function scoreOcrResult(result = {}) {
  const text = String(result.text || '').trim();
  const confidence = round(Math.max(lineConfidence(result.layout), blockConfidence(result.layout)), 1);
  const words = usefulWordCount(text);
  const suspiciousRatio = suspiciousCharacterRatio(text);
  const punctuationRatio = punctuationNoiseRatio(text);
  const textLengthScore = Math.min(18, words * 0.7);
  const confidenceScore = Math.min(60, confidence * 0.6);
  const warningPenalty = result.warning ? 8 : 0;
  const suspiciousPenalty = Math.min(24, suspiciousRatio * 120);
  const punctuationPenalty = punctuationRatio > 0.35 ? 12 : 0;
  const emptyPenalty = text ? 0 : 60;
  const qualityScore = round(
    Math.max(0, confidenceScore + textLengthScore - warningPenalty - suspiciousPenalty - punctuationPenalty - emptyPenalty),
    1
  );
  const needsReview = qualityScore < 55 || confidence < 55 || words < 8 || suspiciousRatio > 0.05;

  return {
    confidence,
    qualityScore,
    needsReview,
    words,
    suspiciousRatio: round(suspiciousRatio, 3),
    punctuationRatio: round(punctuationRatio, 3)
  };
}

export function candidateSummary(candidate = {}) {
  const quality = candidate.quality || scoreOcrResult(candidate);

  return {
    id: candidate.id || `${candidate.engine || 'ocr'}:${candidate.profile || 'default'}`,
    provider: candidate.provider || 'local',
    engine: candidate.engine || null,
    profile: candidate.profile || null,
    model: candidate.model || null,
    confidence: quality.confidence,
    qualityScore: quality.qualityScore,
    textLength: String(candidate.text || '').length,
    warning: candidate.warning || null
  };
}

export function pickBestOcrCandidate(candidates = []) {
  const scored = candidates
    .filter((candidate) => candidate && candidate.status !== 'ocr-error')
    .map((candidate) => ({
      ...candidate,
      quality: scoreOcrResult(candidate)
    }))
    .sort((a, b) => b.quality.qualityScore - a.quality.qualityScore || b.quality.confidence - a.quality.confidence);

  if (!scored.length) {
    return null;
  }

  return scored[0];
}

export function shouldEscalateOcr(result) {
  return scoreOcrResult(result).needsReview;
}
