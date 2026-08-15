# TODO — Suggested followups

Deferred work surfaced by the QA remediation pass (security audit, bug fixes,
a11y/UI fixes). Ordered by priority within each group.

## Breaking dependency upgrades (DONE 2026-08)

- [x] **Next.js 16.3.1 migration** — `next@16.3.1` + `react/react-dom@19.2.x`,
      async `cookies()`/`params`, `middleware.ts` → `proxy.ts`,
      `serverExternalPackages` at top level, `--webpack` build flag. Cleared
      all `next` + bundled `postcss` advisories.
- [x] **`@xenova/transformers` chain** — `protobufjs` overridden to `^7.6.3`
      and `sharp` to `^0.35.0` (npm `overrides`); no transformers downgrade
      needed. `onnxruntime-web` (the protobufjs consumer) is browser-only and
      never loaded — summarization runs server-side via `onnxruntime-node`.
- [x] **`underscore` (via `mammoth`)** — overridden to `^1.13.6` (installs
      latest 1.13.x). `npm audit --omit=dev` now reports 0 vulnerabilities.

## Security followups (DONE 2026-08)

- [x] **SEC-09 — session revocation**: `users.auth_version` bumped on password
      change / token issue; sessions and tokens signed before the bump are
      rejected (`src/lib/auth/cookies.ts`, `verify.ts`).
- [x] **SEC-10 — verification tokens via signed URL** (stateless, version
      stamped; no stored hash; single-use via `auth_version` bump).
- [x] **SEC-12 — legacy base64 share-token decode path removed** (30-day TTL
      means no valid legacy links exist).
- [x] **SEC-13 — CSP nonce rework** (assessed): requires a custom Node server;
      Next self-hosted has no nonce support. Kept strict CSP + documented the
      trade-off in `next.config.js` and `docs/security.md`; headers verified
      against the live Next 16 production build.
- [x] **SEC-18 — strict validation on `users/me` PUT** (whitelist fields,
      all-or-nothing batch reject).
- [x] **SEC-22 — auth/request logs must not include email addresses** (PII);
      logs use a stable SHA-256 digest (`maskEmail`).

## Real-world verification (needs live services/browser — OPEN)

- [ ] Stripe checkout + webhook end-to-end (create → status → renew).
- [ ] Mailgun outbound delivery + inbound webhook signature path.
- [ ] Paid AI path (TokenRouter) — confirm streaming + fallback behavior.
- [ ] Browser pass: a11y contrast (A4/A12), `aria-live` stream verbosity,
      QuickSearch/ShareDialog focus traps, BottomNav/touch targets at 320px,
      ActionsBoard touch drag-and-drop, `scrollIntoView` jump during streaming.

## Accessibility polish (DONE 2026-08)

- [x] **A10 — visible labels**: SavedView template forms now have visible
      labels; InputArea textarea is associated with its visible "Input" header
      (`aria-labelledby`). Search/command fields keep `aria-label`
      (command-palette convention — documented, no visual regression).
- [x] **A11 — micro font sizes**: `--text-xxs` 10→11px, `--text-2xs` 11→12px
      (`src/app/globals.css`).
- [x] **A16 — keyboard move for ActionsBoard**: cards are focusable and move
      columns with `←`/`→` (an accessible alternative to drag-and-drop; the
      explicit move buttons remain).
- [x] **A18 — shortcut hints**: Analyze button announces its shortcut via
      `aria-label`; shortcut reference stays discoverable in Settings.
