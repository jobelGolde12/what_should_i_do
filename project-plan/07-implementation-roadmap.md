# 07 — Implementation Roadmap

> **Project:** TaskMind — Universal Instruction Translator
> **Date:** 2026-08-25

---

## Phase-by-Phase Breakdown

### Phase 1: Core Analysis Pipeline ✅ (Complete)
**Deliverable:** Working text analysis with multi-provider AI cascade
**Effort:** L (was implemented before current session)

| Item | Size | Status | Acceptance Criteria |
|------|------|--------|-------------------|
| AI client with TokenRouter → OpenRouter → Zen cascade | L | ✅ | Analyze any text; cascade on failure |
| Circuit breakers (per-provider, per-route) | M | ✅ | Break after 3 failures; recover after 30s |
| Schema validation + repair (zod) | M | ✅ | Validate/repair output from any provider |
| Rule-based fallback analyzer | M | ✅ | Works without any AI provider |
| SSE streaming endpoint | M | ✅ | Real-time text deltas to client |
| Versioned prompts (standard + deep) | M | ✅ | Few-shot examples; JSON output contract |
| Rate limiting (in-memory per-IP) | S | ✅ | 15/min/IP on analyze endpoint |
| Structured logging (zero PII) | S | ✅ | Request metadata only; no text logged |

---

### Phase 2: Chat Mode & Provider Isolation ✅ (Complete)
**Deliverable:** Grounded analysis chat with OpenRouter-only provider
**Effort:** M (implemented in current session)

| Item | Size | Status | Acceptance Criteria |
|------|------|--------|-------------------|
| Chat provider (`chat/provider.ts`) | M | ✅ | OpenRouter-only streaming; idle watchdog; retry pre-delta |
| Chat config resolution (`chat/config.ts`) | S | ✅ | Env var precedence; graceful degradation |
| Chat route with hardened SSE | M | ✅ | Size limits; history sanitization; abort handling |
| SafeMarkdown component | S | ✅ | Renders markdown; strips dangerous HTML |
| Retry/regenerate controls | S | ✅ | One-tap retry on failure; regenerate last answer |
| Copy-to-clipboard | S | ✅ | Clipboard API with "Copied" feedback |
| Auto-resizing composer | S | ✅ | Grows with content up to ~6 rows |
| Chat provider tests | M | ✅ | Config resolution, error normalization, streaming |
| Chat route tests | M | ✅ | SSE streaming, error handling, rate limiting |
| Documentation (`docs/chat-openrouter.md`) | S | ✅ | Architecture, error handling, observability |

---

### Phase 3: Auth & Data Sync 🔄 (In Progress)
**Deliverable:** User accounts with cloud sync
**Effort:** L

| Item | Size | Status | Acceptance Criteria |
|------|------|--------|-------------------|
| Scrypt password hashing | S | ✅ | Timing-safe compare |
| HMAC session cookies | S | ✅ | 30-day expiry; auth_version revocation |
| Email verification (Mailgun) | M | ✅ | Stateless HMAC tokens; single-use |
| Password reset flow | M | ✅ | Stateless HMAC tokens; 1h expiry |
| Turso/libSQL schema | M | ✅ | DDL + migrations; version tracking |
| User CRUD | M | ✅ | Register, login, logout, delete |
| Data sync (LWW merge) | L | ✅ | PUT /api/users/me with conflict resolution |
| Sync record validation | M | ✅ | Strict allow-list; reject invalid records |
| CSRF protection | S | ✅ | Origin check in proxy.ts |
| Share links (AES-256-GCM) | M | ✅ | Encrypted tokens; 30-day TTL |
| **Total sync test coverage** | M | 🔄 | Add tests for edge cases in LWW merge |

---

### Phase 4: Pro Tier & Billing 🔄 (In Progress)
**Deliverable:** Stripe integration with Pro features
**Effort:** L

| Item | Size | Status | Acceptance Criteria |
|------|------|--------|-------------------|
| Plan tiers & limits | S | ✅ | Free/Pro limits defined in plans.ts |
| Stripe checkout | M | ✅ | Create checkout session |
| Stripe webhook handler | M | ✅ | Handle subscription events; dedup |
| Usage metering (atomic) | M | ✅ | tryIncrement prevents race conditions |
| Pro gating | S | ✅ | proGate() returns 403 for non-Pro |
| Deep analysis mode | M | ✅ | Extended prompt; higher limits |
| Reply drafting | M | ✅ | Tone presets; send-ready replies |
| **Batch analysis** | M | 🔄 | Multiple texts in one request |
| **Export (JSON/CSV)** | M | 🔄 | Download analysis results |
| **Inbox (Mailgun forwarding)** | L | 🔄 | Forward-to-TaskMind; auto-analyze |
| **Reminders** | M | 🔄 | Deadline reminders via email |
| **Weekly digest** | M | 🔄 | Summary email with stats |
| **Priority support** | S | 🔄 | Support ticket system |

---

### Phase 5: File Processing & Advanced Features 🔄 (In Progress)
**Deliverable:** Document upload, conversion, and OCR
**Effort:** L

| Item | Size | Status | Acceptance Criteria |
|------|------|--------|-------------------|
| PDF text extraction (pdfjs-dist) | M | ✅ | Extract text from PDFs |
| DOCX extraction (mammoth) | M | ✅ | Extract text from DOCX |
| OCR (Tesseract.js) | L | ✅ | Extract text from images |
| MinerU document conversion | M | ✅ | Document-to-Markdown |
| Drag-and-drop upload | M | ✅ | File upload with preview |
| **Image-to-text pipeline** | M | 🔄 | End-to-end OCR flow |
| **Multi-file batch** | M | 🔄 | Upload multiple files |
| **ICS calendar export** | S | 🔄 | Export deadlines as calendar events |

---

### Phase 6: UI Polish & UX 🔄 (In Progress)
**Deliverable:** Refined user interface
**Effort:** M

| Item | Size | Status | Acceptance Criteria |
|------|------|--------|-------------------|
| Action board (Kanban) | M | ✅ | Drag-and-drop status changes |
| Translation (multi-language) | M | ✅ | One-click translation |
| Voice reading (TTS) | M | ✅ | Browser TTS; per-language voices |
| History management | M | ✅ | Browse, search, delete past analyses |
| Template system | S | ✅ | Save and reuse text templates |
| Dark mode | S | ✅ | System/light/dark preference |
| **Loading skeletons** | S | 🔄 | Skeleton UI during data fetch |
| **Empty states** | S | 🔄 | Helpful empty state messages |
| **Error boundaries** | S | 🔄 | Graceful error recovery |
| **Responsive design** | M | 🔄 | Mobile-friendly layout |

---

### Phase 7: Documentation & DevOps 🔄 (In Progress)
**Deliverable:** Complete documentation and deployment setup
**Effort:** M

| Item | Size | Status | Acceptance Criteria |
|------|------|--------|-------------------|
| README with quick start | M | ✅ | Accurate setup instructions |
| Security documentation | M | ✅ | Endpoint inventory; hardening status |
| Architecture docs | S | ✅ | Chat mode; AI cascade; provider isolation |
| Husky pre-commit hooks | S | ✅ | Lint-staged (Prettier); typecheck |
| npm scripts (dev, build, test) | S | ✅ | Standard workflow commands |
| **CONTRIBUTING.md** | S | 🔄 | Local setup; coding conventions; PR process |
| **CHANGELOG.md** | S | 🔄 | Versioned with dates |
| **CI/CD pipeline** | M | 🔄 | GitHub Actions workflow |
| **Dockerfile** | M | 🔄 | Multi-stage build |
| **Monitoring/alerting** | L | 🔄 | Error tracking; uptime monitoring |

---

## Risk Register

| Phase | Risk | Probability | Impact | Mitigation |
|-------|------|-------------|--------|-----------|
| 3 | Sync conflicts with concurrent edits | Medium | Medium | LWW merge with server timestamp authority |
| 3 | Mailgun delivery failures | Low | Medium | Retry logic; fallback to no-email mode |
| 4 | Stripe webhook processing delays | Low | Medium | Idempotent processing; dedup table |
| 4 | Usage metering race conditions | Low | High | Atomic SQL (tryIncrement WHERE count < limit) |
| 5 | Large file processing OOM | Medium | High | Size limits; streaming processing; worker threads |
| 5 | OCR accuracy on low-quality images | High | Low | Graceful degradation; user guidance |
| 7 | Self-hosted deployment complexity | Medium | Medium | Docker; clear README; health checks |

---

## Sequence Dependency Diagram

```
Phase 1 (Core Analysis) ──────────────┐
                                        ├──→ Phase 3 (Auth & Sync)
Phase 2 (Chat Mode) ─────────────────┘         │
                                                ├──→ Phase 4 (Pro & Billing)
                                                │         │
                                                │         ├──→ Phase 5 (File Processing)
                                                │         │         │
                                                │         │         └──→ Phase 6 (UI Polish)
                                                │         │
                                                │         └──→ Phase 7 (Docs & DevOps)
                                                │
                                                └──→ Phase 6 (UI Polish)
```

### Parallelizable Streams
- **Stream A:** Phase 3 (Auth) → Phase 4 (Billing) → Phase 5 (Files)
- **Stream B:** Phase 6 (UI Polish) — can start after Phase 2
- **Stream C:** Phase 7 (Docs) — can start after Phase 1

---

## Effort Estimates Summary

| Phase | Effort | Dependencies | Parallelizable |
|-------|--------|-------------|---------------|
| Phase 1: Core Analysis | L | None | — |
| Phase 2: Chat Mode | M | Phase 1 | — |
| Phase 3: Auth & Sync | L | Phase 1 | With Phase 2 |
| Phase 4: Pro & Billing | L | Phase 3 | — |
| Phase 5: File Processing | L | Phase 1 | With Phase 4 |
| Phase 6: UI Polish | M | Phase 2 | With Phase 4 |
| Phase 7: Docs & DevOps | M | Phase 1 | With Phase 3+ |
| **Total** | **XL** | | |

---
