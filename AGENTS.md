# AGENTS.md

Guidance for coding agents working on BookSaver.

## Project Intent

BookSaver helps a user digitize physical books locally: capture page images,
extract text, review OCR, and export EPUB files. The default assumption is that
the app handles private user documents, so avoid unnecessary network calls and
keep data local unless the user explicitly asks otherwise.

## Working Rules

- Prefer small, testable changes that move the MVP forward.
- Preserve original captures; never design an OCR flow that only keeps processed
  or derived text.
- Keep the capture path modular so the app can start as a web app and later add
  a native macOS/iOS capture option.
- Treat generated EPUBs as build artifacts. Source-of-truth project data should
  remain in editable metadata, images, and OCR text files.
- Do not add cloud services, accounts, analytics, or telemetry without explicit
  user approval.
- Keep user-facing copy in Spanish unless the user requests another language.

## Suggested MVP Stack

Use the repository's established stack once it exists. Until then, prefer:

- TypeScript for app and backend code.
- A local web UI for the first capture workflow.
- A lightweight local backend for filesystem access, OCR orchestration, and EPUB
  generation.
- Structured project folders on disk rather than an opaque database for the
  earliest MVP.

## Verification Expectations

- Run available lint, typecheck, and tests before finishing code changes.
- For camera/UI work, verify the main flow manually in a browser when possible.
- For EPUB export, validate that an `.epub` file is generated and contains the
  expected metadata and reading order.
