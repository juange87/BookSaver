import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildBookReadingView } from '../src/lib/book-reading.js';
import { buildEpubPreview } from '../src/lib/epub.js';

const metadata = {
  id: 'reading-book',
  title: 'Lectura continua',
  author: 'Codex',
  language: 'es'
};

test('buildBookReadingView follows the EPUB preview chapter order', () => {
  const pages = [
    {
      id: 'page-0001',
      number: 1,
      text: 'Primera pagina',
      status: 'ocr-complete',
      reviewed: true,
      editorial: { chapterStart: true, chapterTitle: 'Capitulo uno' }
    },
    {
      id: 'page-0002',
      number: 2,
      text: 'Segunda pagina',
      status: 'ocr-complete',
      reviewed: true,
      editorial: {}
    },
    {
      id: 'page-0003',
      number: 3,
      text: 'Tercera pagina',
      status: 'ocr-complete',
      reviewed: true,
      editorial: { chapterStart: true, chapterTitle: 'Capitulo dos' }
    }
  ];

  const preview = buildEpubPreview(metadata, pages);
  const reading = buildBookReadingView(metadata, pages);

  assert.deepEqual(
    reading.chapters.map((chapter) => chapter.title),
    preview.chapters.map((chapter) => chapter.title)
  );
  assert.deepEqual(reading.chapters.map((chapter) => chapter.pageStart), [1, 3]);
  assert.deepEqual(reading.navigation.map((item) => item.title), preview.navigation.map((item) => item.title));
});

test('buildBookReadingView exposes review warnings and editor jump targets', () => {
  const reading = buildBookReadingView(metadata, [
    {
      id: 'page-0001',
      number: 1,
      text: '',
      status: 'captured',
      reviewed: false,
      editorial: {}
    },
    {
      id: 'page-0002',
      number: 2,
      text: 'Texto dudoso',
      status: 'ocr-complete',
      reviewed: false,
      ocrNeedsReview: true,
      editorial: {}
    },
    {
      id: 'page-0003',
      number: 3,
      text: '',
      status: 'captured',
      reviewed: true,
      editorial: { imageMode: 'image' }
    }
  ]);

  const [first, second, third] = reading.chapters[0].pages;

  assert.deepEqual(first.warnings.map((warning) => warning.code), ['pending-review', 'missing-text']);
  assert.deepEqual(second.warnings.map((warning) => warning.code), ['pending-review', 'low-confidence-ocr']);
  assert.deepEqual(third.warnings.map((warning) => warning.code), ['image-page']);
  assert.deepEqual(second.jumpTarget, { pageId: 'page-0002', pane: 'text' });
  assert.equal(reading.warningCount, 5);
});

test('buildBookReadingView keeps text blocks local and does not include image data', () => {
  const reading = buildBookReadingView(metadata, [
    {
      id: 'page-0001',
      number: 1,
      text: 'Primer parrafo.\n\nSegundo parrafo.',
      imageData: Buffer.from('private image bytes'),
      status: 'text-edited',
      reviewed: true,
      editorial: {}
    }
  ]);

  const page = reading.chapters[0].pages[0];

  assert.equal(page.blocks.length, 2);
  assert.equal(page.blocks[0].text, 'Primer parrafo.');
  assert.equal(Object.hasOwn(page, 'imageData'), false);
});
