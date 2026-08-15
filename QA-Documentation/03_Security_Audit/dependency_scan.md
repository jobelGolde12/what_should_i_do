# Dependency Security Scan — TaskMind

**Date:** 2026-08-15
**Commands:** `npm audit --omit=dev --json` · `npm outdated`
**Scope:** production dependencies (183 prod, 437 dev, 135 optional — 655 total).

---

## 1. `npm audit` — Summary

| Severity | Count |
|---|---|
| Critical | 1 |
| High | 6 |
| Moderate | 0 |
| Low | 0 |
| **Total** | **7** |

### 1.1 Critical — `protobufjs ≤ 7.6.2`
- **Chain:** `@xenova/transformers` → `onnxruntime-web` → `onnx-proto` → `protobufjs`
- **Advisories (aggregated):**
  - Arbitrary code execution in protobufjs — GHSA-xq3m-2v4x-88gg
  - Code injection through bytes field defaults (generated `toObject`) — GHSA-66ff-xgx4-vchm
  - Prototype injection in generated message constructors — GHSA-fx83-v9x8-x52w
  - Code generation gadget after prototype pollution — GHSA-75px-5xx7-5xc7
  - DoS variants (recursion, crafted field names, unsafe option paths, unbounded Any/JSON expansion, overlong UTF-8) — GHSA-685m-2w69-288q, GHSA-q6x5-8v7m-xcrf, GHSA-jggg-4jg4-v7c6, GHSA-wcpc-wj8m-hjx6, GHSA-jvwf-75h9-cwgg, GHSA-2pr8-phx7-x9h3
  - Schema-name shadowing — GHSA-f38q-mgvj-vph7

### 1.2 High findings

| Package | Issue | Note |
|---|---|---|
| `@xenova/transformers ≥1.4.3` | inherits onnxruntime-web + sharp vulns | On-device summarizer; server-side only |
| `onnxruntime-web` | via `onnx-proto` (protobufjs) | Used by transformers |
| `onnx-proto` | via `protobufjs` | Transitive |
| `sharp < 0.35.0` | libvips CVEs: CVE-2026-33327, CVE-2026-33328, CVE-2026-35590, CVE-2026-35591 | Image processing for file conversion/OCR |
| `next 9.3.4-canary.0 – 16.3.0-preview.10` | aggregate of ~20 advisories (DoS in Image Optimizer, Server Components DoS, cache poisoning via RSC, request smuggling in rewrites, XSS with CSP nonces, XSS in `beforeInteractive` scripts, SSRF in rewrites / Server Actions / WebSocket upgrades, middleware cache poisoning, unbounded image cache growth, internal Server Function endpoint disclosure, etc.) | Individual impact varies by version; see 1.3 |
| `postcss ≤ 8.5.22` | XSS via unescaped `</style>`, arbitrary `.map` file disclosure via sourceMappingURL | Affects `next` (bundled postcss) |

### 1.3 Which advisories actually hit 14.2.35
`npm audit` aggregates advisories across all affected versions. Several of the above (e.g. the 2025-era XSS/cache-poisoning batch) are patched in 14.2.x patch lines and may already be resolved at 14.2.35; the audit still flags the package because the aggregate range extends past it. **The two clean, actionable upgrades remain:**
- `next` → fixed line (audit suggests 16.3.1 — major).
- transformers chain → `@xenova/transformers@1.4.2` (breaking) or migrate to `@huggingface/transformers`.

### 1.4 Fix availability
| Vuln | Fix | Breaking? |
|---|---|---|
| `next` / `postcss` | next 16.3.1 | Yes (major) |
| transformers chain (protobufjs, onnx-proto, onnxruntime-web, sharp) | `@xenova/transformers@1.4.2` | Yes (major) |

No fix exists within the current major for either chain — a planned upgrade is required. `npm audit fix --force` would apply both breaking changes and must be validated against the summarize/convert pipelines.

## 2. `npm outdated` — key gaps

| Package | Current | Wanted | Latest | Notes |
|---|---|---|---|---|
| `next` | 14.2.35 | 14.2.35 | **16.3.1** | 2 majors behind |
| `react` / `react-dom` | 18.2.0 | 18.3.1 | **19.2.8** | Pairs with next upgrade |
| `pdfjs-dist` | 5.4.530 | 5.7.284 | **6.2.108** | PDF parsing; also implicated in dev crash (BUG-05) |
| `stripe` | 17.7.0 | 17.7.0 | **22.5.0** | Minor-version pin |
| `@xenova/transformers` | (current) | — | 1.4.2 | Deprecated upstream in favor of `@huggingface/transformers` |
| `tailwindcss` / `@tailwindcss/postcss` | 4.1.18 | 4.3.3 | 4.3.3 | Patch-level |
| `typescript` | 5.9.3 | 5.9.3 | **7.0.2** | Major (optional) |
| `eslint` | 9.39.2 | 9.39.5 | **10.8.1** | Major |
| `lucide-react` | 0.562.0 | 0.562.0 | **1.31.0** | Major |
| `mammoth` | 1.11.0 | 1.12.1 | 1.12.1 | Patch |

**Adoption risk for upgrades:** the `summarize` (transformers/onnxruntime/sharp) and `convert` (pdfjs-dist, mammoth, tesseract) pipelines are the highest-risk surfaces and should be regression-tested after any of the above.

## 3. Health signals
- `caniuse-lite` browserslist DB is ~8 months stale (build warning) — run `npx browserslist@latest --update-db`.
- Dev tools (eslint-config-next 16.1.1) are ahead of the runtime `next` 14.2.35 — a mismatch worth resolving when upgrading.
- No known *direct* (non-transitive) vulnerabilities; all 7 findings trace to two dependency subtrees: the transformers/onnxruntime chain and the next/postcss line.

## 4. Recommendations
1. Schedule a major upgrade of `next` + `react` + `react-dom` as a single tracked work item (they move together).
2. Migrate `@xenova/transformers` → `@huggingface/transformers` and re-verify summarize cold-start + output.
3. Re-run `npm audit` after each upgrade; re-run this scan monthly or on dependency bumps.
