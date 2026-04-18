# BookSaver

BookSaver is a local-first tool for digitizing old physical books into readable
ebooks.

The goal is to let a user capture pages with a high-quality camera, keep the
captures ordered, extract text with OCR, review the result, and export a clean
EPUB that can be used on Kobo or sent to Kindle.

## MVP Goal

The first version should prove the complete book-saving loop:

1. Create a book project with title, author, language, and optional notes.
2. Select a camera source, ideally an iPhone exposed to macOS through
   Continuity Camera.
3. Capture pages one by one and store the original images locally.
4. Show the captured pages in order, with basic delete and reorder actions.
5. Run OCR on captured pages.
6. Let the user review and edit recognized text.
7. Export an EPUB containing the recognized text and basic metadata.

## Product Principles

- Local-first: book images and OCR output should stay on the user's machine by
  default.
- Recoverable: original page captures should be kept so OCR can be rerun later.
- Simple capture flow: taking the next page should be fast and hard to mess up.
- EPUB first: generate a standard EPUB suitable for Kobo and Kindle conversion
  flows.
- Extensible capture: start with web camera capture, but keep room for a native
  macOS or iOS capture path if higher resolution is needed.

## Early Architecture Direction

The initial implementation is expected to be a local web app:

- Frontend: camera preview, capture controls, page review, OCR editor, export UI.
- Local backend: project storage, image persistence, OCR pipeline, EPUB builder.
- Storage: one folder per book project, with images, OCR text, metadata, and
  generated exports.

This keeps the MVP fast to build while still allowing a later native shell
through Electron, Tauri, or a dedicated macOS/iOS companion.

## Legal Note

BookSaver is intended for personal preservation of books the user owns, public
domain works, or content the user has permission to digitize. It should not be
used to distribute copyrighted material without authorization.
