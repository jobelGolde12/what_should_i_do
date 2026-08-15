# TODO — Suggested followups

Deferred work surfaced by the QA remediation pass (security audit, bug fixes,
a11y/UI fixes). Ordered by priority within each group.

## Breaking dependency upgrades (fix remaining `npm audit` findings)

- [ ] **Next.js 15/16 migration** — fixes all `next` + bundled `postcss`
      advisories (DoS, XSS, cache poisoning). Requires React 19 and the async
      request APIs (`headers()`/`cookies()`); a dedicated effort. Keep pinned to
      newest 14.2.x until then. See `docs/security.md` item 1.
- [ ] **`@xenova/transformers` downgrade to 1.4.2** (breaking) or wait for a
      patched release — clears the `protobufjs` critical + `sharp` chain used
      only by `/api/summarize`. See `docs/security.md` item 2.
- [ ] **`underscore` (via `mammoth`)** — docx extraction parser; consider a
      patched pin or a different .docx extractor. See `docs/security.md` item 3.

## Security followups (deferred SEC items)

- [ ] **SEC-09 — session revocation**: invalidate existing sessions on password
      change / email change.
- [ ] **SEC-10 — verification tokens via signed URL** (no stored hash).
- [ ] **SEC-12 — drop the legacy base64 share-token decode path** (decision
      needed; current TTL applies to both paths).
- [ ] **SEC-13 — CSP nonce rework** (blocked on Next 15+ nonce support).
- [ ] **SEC-18 — strict validation on `users/me` PUT** (whitelist fields).
- [ ] **SEC-22 — auth/request logs must not include email addresses** (PII).

## Real-world verification (needs live services/browser)

- [ ] Stripe checkout + webhook end-to-end (create → status → renew).
- [ ] Mailgun outbound delivery + inbound webhook signature path.
- [ ] Paid AI path (TokenRouter) — confirm streaming + fallback behavior.
- [ ] Browser pass: a11y contrast (A4/A12), `aria-live` stream verbosity,
      QuickSearch/ShareDialog focus traps, BottomNav/touch targets at 320px,
      ActionsBoard touch drag-and-drop, `scrollIntoView` jump during streaming.

## Accessibility polish (low)

- [ ] **A10 — visible labels** for placeholder-as-label fields (InputArea,
      QuickSearch, InboxView, SavedView) — currently only `aria-label`.
- [ ] **A11 — micro font sizes** (`--text-xxs`/`--text-2xs`, 10–11px) bump;
      ripples across 65+ usages, so deliberate design decision.
- [ ] **A16 — keyboard drag-and-drop** for ActionsBoard (move buttons exist as
      a fallback; native `datalist`/sortable would be nicer).
- [ ] **A18 — shortcut hints** (`kbd`) are `hidden sm:inline`; expose on mobile
      or announce the shortcuts.
