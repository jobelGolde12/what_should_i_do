# Feature 15 — Share Links

## 1. What it is & its role

The **Share Links** feature lets users generate a shareable URL of an analysis so others can view the structured result without an account. Its role is to enable collaboration and sharing of action plans.

## 2. Current functionality

### Where it lives
- **Link generation/parsing:** `src/lib/share.ts` → `buildShareLink`, `copyShareLink`, `parseShareToken`.
- **Shared view:** `src/components/share/ShareView.tsx` + route `src/app/share/[id]/page.tsx`.
- **Types:** `src/lib/types.ts` → `SharePayload`.
- **UI entry:** `ResultsPanel.tsx` "Share" button (copies the link).

### How it works today
1. User clicks "Share" on a results panel.
2. `buildShareLink` serializes `{ input, output, timestamp }`, base64-encodes (URL-safe), and returns `{origin}/share/{token}`.
3. Link is copied to clipboard via `navigator.clipboard`.
4. The `/share/[id]` route decodes the token and renders the full analysis read-only.
5. Invalid/edited links show an "This link isn't valid" empty state.

### Current limitations
- **Data is embedded in the URL** — long analyses exceed URL length limits (browsers/servers ~2K–8K chars) and links break.
- **No server storage/ID** — no analytics, expiry, or revocation.
- **Any viewer can read** the full raw input (privacy concern if shared publicly).
- **No server-side canonical share** for SEO/social cards (the token isn't crawlable); `robots: noindex`.
- No "copy as markdown/text" alternative.
- Clipboard can fail silently (permission); no fallback to show the link manually.
- Base64 encoding isn't encrypted — not suitable for sensitive content.

## 3. Future enhancements (production-ready Share Links)

### 3.1 Server-backed share records
- Persist shares to a database, returning a short, stable ID (e.g., `/share/abc123`).
- Support **expiry**, optional **password protection**, and **revocation**.

### 3.2 Privacy controls
- Let the user choose whether to include the raw input or only the structured result.
- Add a "sensitive content" flag that hides the raw input by default.

### 3.3 Analytics & social
- Track share views (server-side).
- Add **server-side Open Graph / social card** from the share record (better previews) while keeping the page `noindex`/`index` per user choice.

### 3.4 Robust copying
- Provide a visible fallback text field when clipboard fails.

### 3.5 Share formats
- "Copy as text/markdown" export alongside the link.

### 3.6 Testing
- Unit tests for encode/decode/validation.
- Integration test for the share API and view route.

> **Status: DONE** — Implemented in this round: new `ShareDialog` with privacy controls (toggle to include raw input, sensitive flag that hides raw input on the shared page), a visible read-only link field with robust copy fallback (`copyText` uses `navigator.clipboard` then `execCommand`; manual-copy hint shown on failure), and "Copy as markdown" export (`buildShareMarkdown`); `SharePayload` extended with `includeInput`/`sensitive`; `ShareView` hides the raw input quote block when input is excluded or flagged sensitive (with a ShieldAlert notice). Server-backed records, expiry/revocation, analytics and OG cards deferred to the auth/backend round (F19).

> **Definition of "done" for this feature:** Shares are server-backed short URLs with access control, expiry/revocation, privacy options, social metadata, analytics, robust clipboard fallback, and tests.
