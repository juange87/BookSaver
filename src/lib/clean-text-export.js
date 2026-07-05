import { buildEpubModel } from './epub.js';

function slugify(value) {
  return String(value || 'capitulo')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'capitulo';
}

function cleanText(value = '') {
  return String(value || '')
    .replace(/\r\n?/gu, '\n')
    .split(/\n{2,}/u)
    .map((paragraph) => paragraph.replace(/[ \t]+/gu, ' ').trim())
    .filter(Boolean)
    .join('\n\n');
}

function pageText(page) {
  if (page.editorial?.imageMode === 'image') {
    return '';
  }

  return cleanText(page.text);
}

export function buildCleanTextChapterFiles(metadata = {}, pages = []) {
  const model = buildEpubModel(metadata, pages);

  return model.chapters
    .map((chapter, index) => {
      const textPages = chapter.pages
        .map((page) => ({
          page,
          text: pageText(page)
        }))
        .filter((entry) => entry.text);
      const pageNumbers = textPages.map((entry) => entry.page.number).filter(Boolean);
      const body = textPages.map((entry) => entry.text).join('\n\n');
      const title = chapter.title || `Capitulo ${index + 1}`;
      const data = [`# ${title}`, body].filter(Boolean).join('\n\n').trimEnd() + '\n';

      return {
        fileName: `${String(index + 1).padStart(2, '0')}-${slugify(title)}.txt`,
        title,
        pageStart: pageNumbers[0] || null,
        pageEnd: pageNumbers.at(-1) || null,
        pageCount: chapter.pages.length,
        textPageCount: textPages.length,
        data
      };
    })
    .filter((file) => file.textPageCount > 0);
}
