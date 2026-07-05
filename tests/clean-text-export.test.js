import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildCleanTextChapterFiles } from '../src/lib/clean-text-export.js';

test('buildCleanTextChapterFiles follows EPUB chapter order and skips image pages', () => {
  const files = buildCleanTextChapterFiles(
    { title: 'Libro limpio' },
    [
      {
        id: 'page-0001',
        number: 1,
        text: 'Texto del primer capítulo.',
        editorial: {
          imageMode: 'text',
          chapterStart: true,
          chapterTitle: 'Capítulo uno',
          chapterEnd: false
        }
      },
      {
        id: 'page-0002',
        number: 2,
        text: 'No debe salir como texto.',
        editorial: {
          imageMode: 'image',
          chapterStart: false,
          chapterTitle: '',
          chapterEnd: true
        }
      },
      {
        id: 'page-0003',
        number: 3,
        text: 'Texto del segundo capítulo.',
        editorial: {
          imageMode: 'text',
          chapterStart: true,
          chapterTitle: 'Capítulo dos',
          chapterEnd: false
        }
      }
    ]
  );

  assert.deepEqual(files.map((file) => file.fileName), [
    '01-capitulo-uno.txt',
    '02-capitulo-dos.txt'
  ]);
  assert.match(files[0].data, /Texto del primer capítulo/);
  assert.doesNotMatch(files[0].data, /No debe salir/);
  assert.match(files[1].data, /Texto del segundo capítulo/);
});
