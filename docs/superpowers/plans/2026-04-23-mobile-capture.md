# Mobile Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local mobile capture mode so a phone on the same Wi-Fi can open a temporary URL, take page photos, and append them to the active BookSaver project.

**Architecture:** Keep the existing desktop app bound to its current host, and start a small temporary mobile-only HTTP server when a project enables mobile capture. The mobile server exposes only a token-protected upload page and upload API; desktop controls activate/deactivate the session and poll for new uploads.

**Tech Stack:** Node.js native HTTP, ES modules, browser Fetch/File APIs, existing BookSaver storage APIs, `node:test`.

---

### Task 1: Mobile Capture Session Model

**Files:**
- Create: `src/lib/mobile-capture.js`
- Test: `tests/mobile-capture.test.js`

- [ ] Add failing tests for token-protected sessions, LAN URL construction, upload counters, and inactive-token rejection.
- [ ] Implement a small `MobileCaptureSessionManager` with `start(projectId)`, `stop(projectId)`, `status(projectId)`, `requireActiveToken(token)`, and `recordUpload(page)`.
- [ ] Run `node --test tests/mobile-capture.test.js`.

### Task 2: Backend Routes And Temporary Mobile Server

**Files:**
- Modify: `src/server.js`
- Create: `public/mobile.html`
- Create: `public/mobile.js`

- [ ] Add desktop API routes:
  - `GET /api/projects/:projectId/mobile-capture`
  - `POST /api/projects/:projectId/mobile-capture`
  - `DELETE /api/projects/:projectId/mobile-capture`
- [ ] Start the mobile server on activation, bound to `0.0.0.0` and `MOBILE_CAPTURE_PORT || 5174`.
- [ ] Serve `/mobile/:token`, `/mobile.js`, `/styles.css`, and `POST /api/mobile-capture/:token/pages` from the mobile server.
- [ ] Reuse `store.addPage(projectId, imageData)` for uploads and call `recordUpload(page)` after a successful mobile upload.

### Task 3: Desktop Controls

**Files:**
- Modify: `public/index.html`
- Modify: `public/app.js`
- Modify: `public/styles.css`

- [ ] Add a compact mobile capture panel in the capture view.
- [ ] Add state and actions for start/stop/copy URL.
- [ ] Poll active mobile capture status every 2 seconds and refresh the project when `uploadedCount` increases.
- [ ] Keep all user-facing copy in Spanish.

### Task 4: Mobile Upload UX

**Files:**
- Modify: `public/mobile.html`
- Modify: `public/mobile.js`
- Modify: `public/styles.css`

- [ ] Use `<input type="file" accept="image/*" capture="environment">` to open the phone camera.
- [ ] Convert selected images to JPEG/PNG data URLs compatible with the existing page API.
- [ ] Upload immediately and show success/error states on the phone.

### Task 5: Verification

**Files:**
- Modify: `README.md`

- [ ] Document the mobile capture flow and local-network limitation.
- [ ] Run `node --test`.
- [ ] Start `npm start` and verify the desktop API can create a mobile session.
- [ ] Manually verify the mobile upload endpoint with a tiny data URL if a physical phone is not available.
