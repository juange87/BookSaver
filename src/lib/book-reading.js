import { textToBlocks } from './layout.js';
import { buildEpubModel, buildEpubPreview } from './epub.js';

function pageNumberRange(chapter) {
  const pageNumbers = chapter.pages.map((page) => page.number).filter(Boolean);

  return {
    pageStart: pageNumbers[0] || null,
    pageEnd: pageNumbers.at(-1) || null
  };
}

function compactText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function readingBlocks(page) {
  if (page.editorial.imageMode === 'image') {
    return [];
  }

  const blocks = page.layout?.blocks?.length ? page.layout.blocks : textToBlocks(page.text);
  return blocks.map((block) => ({
    type: block.type || 'paragraph',
    text: String(block.text || ''),
    indent: block.indent !== false
  })).filter((block) => block.text.trim());
}

function readingWarning(code, message, severity = 'medium') {
  return { code, message, severity };
}

function pageReadingWarnings(page) {
  const warnings = [];

  if (page.editorial.imageMode === 'image') {
    warnings.push(readingWarning('image-page', 'Página marcada como imagen en el EPUB.', 'info'));
    return warnings;
  }

  if (!page.reviewed) {
    warnings.push(readingWarning('pending-review', 'Página pendiente de revisión.', 'medium'));
  }

  if (!compactText(page.text)) {
    warnings.push(readingWarning('missing-text', 'Página sin texto revisado.', 'high'));
  }

  if (page.ocrNeedsReview) {
    warnings.push(readingWarning('low-confidence-ocr', 'OCR con baja confianza.', 'high'));
  }

  if (page.ocrWarning) {
    warnings.push(readingWarning('ocr-warning', String(page.ocrWarning), 'medium'));
  }

  return warnings;
}

function readingPage(page) {
  return {
    id: page.id,
    pageId: page.id,
    number: page.number,
    status: page.status || 'captured',
    imageMode: page.editorial.imageMode,
    reviewed: Boolean(page.reviewed),
    blocks: readingBlocks(page),
    warnings: pageReadingWarnings(page),
    jumpTarget: {
      pageId: page.id,
      pane: page.editorial.imageMode === 'image' ? 'structure' : 'text'
    }
  };
}

export function buildBookReadingView(metadata = {}, pages = []) {
  const model = buildEpubModel(metadata, pages);
  const preview = buildEpubPreview(metadata, pages);
  const chapters = model.chapters.map((chapter) => {
    const chapterPages = chapter.pages.map(readingPage);
    return {
      id: chapter.id,
      title: chapter.title,
      ...pageNumberRange(chapter),
      pageCount: chapter.pages.length,
      empty: Boolean(chapter.empty),
      pages: chapterPages
    };
  });
  const warningCount = chapters.reduce(
    (total, chapter) => total + chapter.pages.reduce((sum, page) => sum + page.warnings.length, 0),
    0
  );

  return {
    metadata: {
      title: metadata.title || 'Libro sin titulo',
      author: metadata.author || 'Autor desconocido',
      language: metadata.language || 'es'
    },
    summary: `${chapters.length} ${chapters.length === 1 ? 'capítulo' : 'capítulos'} en lectura continua.`,
    pageCount: model.pages.length,
    chapterCount: chapters.length,
    warningCount,
    navigation: preview.navigation,
    chapters
  };
}
