function numeric(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeText(value = '') {
  return String(value)
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([¿¡(])\s+/g, '$1')
    .replace(/\s+([)\]])/g, '$1')
    .trim();
}

function unionBox(items) {
  const left = Math.min(...items.map((item) => item.left));
  const top = Math.min(...items.map((item) => item.top));
  const right = Math.max(...items.map((item) => item.left + item.width));
  const bottom = Math.max(...items.map((item) => item.top + item.height));

  return {
    left,
    top,
    width: right - left,
    height: bottom - top,
    right,
    bottom,
    centerX: left + (right - left) / 2
  };
}

function groupBy(items, keyFn) {
  const groups = new Map();

  for (const item of items) {
    const key = keyFn(item);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(item);
  }

  return groups;
}

function parseTsvRows(tsv) {
  const lines = String(tsv || '').split(/\r?\n/).filter(Boolean);
  const header = lines.shift()?.split('\t') || [];
  const rows = [];

  for (const line of lines) {
    const columns = line.split('\t');
    if (columns.length < header.length) {
      continue;
    }

    const row = {};
    for (const [index, key] of header.entries()) {
      row[key] = index === header.length - 1 ? columns.slice(index).join('\t') : columns[index];
    }
    rows.push(row);
  }

  return rows;
}

function rowsToLines(rows) {
  const words = rows
    .filter((row) => Number(row.level) === 5 && normalizeText(row.text))
    .map((row) => ({
      pageNum: numeric(row.page_num),
      blockNum: numeric(row.block_num),
      parNum: numeric(row.par_num),
      lineNum: numeric(row.line_num),
      wordNum: numeric(row.word_num),
      left: numeric(row.left),
      top: numeric(row.top),
      width: numeric(row.width),
      height: numeric(row.height),
      conf: numeric(row.conf, -1),
      text: normalizeText(row.text)
    }));

  const lineGroups = groupBy(
    words,
    (word) => `${word.pageNum}:${word.blockNum}:${word.parNum}:${word.lineNum}`
  );

  return [...lineGroups.values()]
    .map((lineWords) => {
      const sortedWords = lineWords.sort((a, b) => a.left - b.left || a.wordNum - b.wordNum);
      const box = unionBox(sortedWords);
      const confidenceWords = sortedWords.filter((word) => word.conf >= 0);

      return {
        pageNum: sortedWords[0].pageNum,
        blockNum: sortedWords[0].blockNum,
        parNum: sortedWords[0].parNum,
        lineNum: sortedWords[0].lineNum,
        text: normalizeText(sortedWords.map((word) => word.text).join(' ')),
        words: sortedWords,
        confidence:
          confidenceWords.reduce((sum, word) => sum + word.conf, 0) /
          Math.max(confidenceWords.length, 1),
        ...box
      };
    })
    .filter((line) => line.text)
    .sort((a, b) => a.top - b.top || a.left - b.left);
}

function textBoundsFromLines(lines) {
  if (lines.length === 0) {
    return null;
  }
  return unionBox(lines);
}

function filterNoiseLines(lines) {
  return lines.filter((line) => {
    const text = line.text.trim();
    const hasLetter = /\p{L}/u.test(text);
    const wordCount = line.wordCount ?? line.words?.length ?? text.split(/\s+/).filter(Boolean).length;

    if (!text) {
      return false;
    }

    if (text.length <= 1) {
      return false;
    }

    if (!hasLetter && text.length <= 4) {
      return false;
    }

    if (text.length <= 4 && line.confidence < 85) {
      return false;
    }

    if (wordCount <= 2 && line.confidence < 65) {
      return false;
    }

    return true;
  });
}

function uppercaseRatio(text) {
  const letters = [...text].filter((char) => /\p{L}/u.test(char));
  if (letters.length === 0) {
    return 0;
  }
  return letters.filter((char) => char === char.toUpperCase() && char !== char.toLowerCase()).length /
    letters.length;
}

function isCenteredLine(line, textBounds) {
  if (!textBounds) {
    return false;
  }

  const centerTolerance = Math.max(28, textBounds.width * 0.09);
  const nearCenter = Math.abs(line.centerX - textBounds.centerX) <= centerTolerance;
  const shortEnough = line.width <= textBounds.width * 0.82;
  const notTooLong = line.text.length <= 90;
  const strongCue = uppercaseRatio(line.text) > 0.55 || /^[\p{Lu}\d\s.,:;!?-]+$/u.test(line.text);

  return nearCenter && shortEnough && (notTooLong || strongCue);
}

function blockTypeForCenteredLine(line) {
  const shortLine = line.text.length <= 60;
  const looksLikeHeading = uppercaseRatio(line.text) > 0.55 || /^[\p{Lu}\d\s.,:;!?-]+$/u.test(line.text);
  return shortLine && looksLikeHeading ? 'heading' : 'centered';
}

function joinParagraphLines(lines) {
  let text = '';

  for (const line of lines) {
    const clean = normalizeText(line.text);
    if (!clean) {
      continue;
    }

    if (!text) {
      text = clean;
      continue;
    }

    if (/[-\u00ad]$/.test(text)) {
      text = `${text.replace(/[-\u00ad]$/, '')}${clean}`;
    } else {
      text = `${text} ${clean}`;
    }
  }

  return normalizeText(text);
}

function lineHeight(lines) {
  if (lines.length === 0) {
    return 12;
  }

  const heights = lines.map((line) => line.height).sort((a, b) => a - b);
  return heights[Math.floor(heights.length / 2)] || 12;
}

function pushParagraph(blocks, lines, textBounds) {
  const text = joinParagraphLines(lines);
  if (!text) {
    return;
  }

  const firstLine = lines[0];
  const indent = textBounds ? firstLine.left - textBounds.left > textBounds.width * 0.04 : false;
  blocks.push({
    type: 'paragraph',
    text,
    indent,
    confidence:
      lines.reduce((sum, line) => sum + line.confidence, 0) / Math.max(lines.length, 1)
  });
}

function linesToBlocks(lines, textBounds) {
  const blocks = [];
  const medianLineHeight = lineHeight(lines);
  const sortedLines = [...lines].sort((a, b) => a.top - b.top || a.left - b.left);
  let pendingParagraph = [];

  for (const line of sortedLines) {
    const previous = pendingParagraph.at(-1);
    const verticalGap = previous ? line.top - previous.bottom : 0;
    const firstLineIndent =
      textBounds && line.left - textBounds.left > textBounds.width * 0.08 && pendingParagraph.length > 0;
    const previousLooksClosed = previous ? /[.!?…»”"]$/.test(previous.text) : false;
    const previousEndsHyphen = previous ? /[-\u00ad]$/.test(previous.text) : false;
    const indentationStartsParagraph = firstLineIndent && previousLooksClosed && !previousEndsHyphen;
    const paragraphGap =
      previous &&
      (indentationStartsParagraph ||
        (verticalGap > medianLineHeight * 1.45 &&
          (previousLooksClosed || firstLineIndent || verticalGap > medianLineHeight * 2.15)));

    if (isCenteredLine(line, textBounds)) {
      pushParagraph(blocks, pendingParagraph, textBounds);
      pendingParagraph = [];
      blocks.push({
        type: blockTypeForCenteredLine(line),
        text: normalizeText(line.text),
        confidence: line.confidence
      });
      continue;
    }

    if (paragraphGap) {
      pushParagraph(blocks, pendingParagraph, textBounds);
      pendingParagraph = [];
    }

    pendingParagraph.push(line);
  }

  pushParagraph(blocks, pendingParagraph, textBounds);
  return blocks.filter((block) => block.text);
}

export function buildLayoutFromTsv(tsv) {
  const rows = parseTsvRows(tsv);
  const pageRow = rows.find((row) => Number(row.level) === 1);
  const lines = filterNoiseLines(rowsToLines(rows));
  const textBounds = textBoundsFromLines(lines);
  const blocks = linesToBlocks(lines, textBounds);

  return {
    version: 1,
    source: 'tesseract-tsv',
    page: {
      width: numeric(pageRow?.width),
      height: numeric(pageRow?.height)
    },
    textBounds,
    lines: lines.map(({ words, ...line }) => line),
    blocks
  };
}

export function buildLayoutFromVision(visionResult) {
  const rawLines = (visionResult?.lines || [])
    .map((line, index) => {
      const left = numeric(line.left);
      const top = numeric(line.top);
      const width = numeric(line.width);
      const height = numeric(line.height);
      const text = normalizeText(line.text);

      return {
        pageNum: 1,
        blockNum: 1,
        parNum: 1,
        lineNum: index + 1,
        text,
        left,
        top,
        width,
        height,
        right: left + width,
        bottom: top + height,
        centerX: left + width / 2,
        confidence: numeric(line.confidence, -1),
        wordCount: text.split(/\s+/).filter(Boolean).length
      };
    })
    .filter((line) => line.text)
    .sort((a, b) => a.top - b.top || a.left - b.left);

  const lines = filterNoiseLines(rawLines);
  const textBounds = textBoundsFromLines(lines);
  const blocks = linesToBlocks(lines, textBounds);

  return {
    version: 1,
    source: 'apple-vision',
    page: {
      width: numeric(visionResult?.page?.width),
      height: numeric(visionResult?.page?.height)
    },
    textBounds,
    lines,
    blocks
  };
}

export function layoutToText(layout) {
  const blocks = layout?.blocks || [];
  return blocks.map((block) => normalizeText(block.text)).filter(Boolean).join('\n\n');
}

export function textToBlocks(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((paragraph) => normalizeText(paragraph.replace(/\n/g, ' ')))
    .filter(Boolean)
    .map((paragraph) => ({
      type: looksLikeHeading(paragraph) ? 'heading' : 'paragraph',
      text: paragraph,
      indent: true
    }));
}

function looksLikeHeading(text) {
  return text.length <= 80 && uppercaseRatio(text) > 0.55;
}
