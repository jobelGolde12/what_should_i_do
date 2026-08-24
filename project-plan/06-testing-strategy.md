# 06 — Testing Strategy

> **Project:** TaskMind — Universal Instruction Translator
> **Date:** 2026-08-25

---

## Testing Pyramid

```
                    ┌─────────┐
                    │  E2E    │  ← Manual / Playwright (future)
                    │ (5-10%) │
                   ┌┴─────────┴┐
                   │Integration │  ← API route tests, DB tests
                   │  (20-30%)  │
                  ┌┴────────────┴┐
                  │   Unit Tests  │  ← Pure functions, utilities, AI client
                  │   (60-70%)    │
                  └───────────────┘
```

---

## Test Framework & Assertions

| Tool | Purpose | Version |
|------|---------|---------|
| **Vitest** | Test runner | 4.1.10 |
| **vitest globals** | `describe`, `it`, `expect`, `vi` | Built-in |
| **vi.fn()** | Mocking | Built-in |
| **vi.mock()** | Module mocking | Built-in |
| **vi.stubGlobal()** | Global stubs (fetch, etc.) | Built-in |
| **Node test environment** | Server-side tests | vitest config |

### Configuration
- **File pattern:** `tests/**/*.test.ts`
- **Setup:** `tests/setup-env.ts` (environment variable setup)
- **Parallelism:** Disabled (`fileParallelism: false`) — tests share in-memory state
- **Hook timeout:** 30 seconds

---

## Mock/Stub/Fixture Strategy

### Module Mocks
```typescript
vi.mock("@/lib/auth/cookies", () => ({
  getCurrentUserId: vi.fn(),
}));
```

### Global Stubs
```typescript
vi.stubGlobal("fetch", fetchMock);
```

### Test Fixtures
- **Analysis fixtures:** Hardcoded `ANALYSIS_RESULT` objects in test files.
- **Request fixtures:** Helper functions like `chatRequest()`, `analyzeRequest()`.
- **SSE fixtures:** `sseFetch()` helper that creates mock streaming responses.
- **DB fixtures:** In-memory SQLite via `getDb()` fallback (no external DB needed).

### Mock Pattern
```typescript
// Before each test
vi.mocked(getCurrentUserId).mockResolvedValue("user-1");
vi.mocked(rateLimit).mockReturnValue({ allowed: true, remaining: 14, resetAt: Date.now() + 60_000 });

// After each test
vi.restoreAllMocks();
```

---

## Database Testing Strategy

- **In-memory SQLite:** Tests use the local file fallback (`file:.data/taskmind.db`) — no external Turso instance needed.
- **Schema isolation:** `ensureSchema()` runs lazily; tests can call `resetDbCache()` for clean state.
- **No containerized DB:** Acceptable for unit/integration tests; E2E tests may need Turso cloud.
- **Test data:** Created per-test; cleaned up by `resetDbCache()`.

---

## Existing Test Suites

| Test File | Coverage Area | Test Count |
|-----------|--------------|------------|
| `tests/ai.test.ts` | AI client cascade, retry, circuit breaker, quota classification | ~15 |
| `tests/ai-mock.test.ts` | Mock AI (classification, grounding, streaming) | ~10 |
| `tests/analysisChat.test.ts` | Chat route (SSE streaming, error handling, rate limiting) | ~8 |
| `tests/chatProvider.test.ts` | Chat provider (config resolution, error normalization, streaming) | ~12 |
| `tests/auth.test.ts` | Auth (register, login, verify, session) | ~15 |
| `tests/db.test.ts` | Database (schema, CRUD, migrations) | ~10 |
| `tests/rateLimit.test.ts` | Rate limiting (in-memory, DB-backed) | ~8 |
| `tests/share.test.ts` | Share links (create, decrypt, expiry) | ~6 |
| `tests/sync.test.ts` | Cloud sync (LWW merge, conflict resolution) | ~8 |
| `tests/convert.test.ts` | File conversion (PDF, DOCX, images) | ~6 |
| `tests/mineru.test.ts` | MinerU document conversion | ~4 |
| `tests/format.test.ts` | Text formatting utilities | ~8 |
| `tests/deadline.test.ts` | Deadline detection | ~6 |
| `tests/urgency.test.ts` | Urgency classification | ~6 |
| `tests/actionUtils.test.ts` | Action text cleaning/dedup | ~8 |
| `tests/mailgun.test.ts` | Mailgun integration | ~4 |
| `tests/reminders.test.ts` | Reminder management | ~6 |
| `tests/digest.test.ts` | Weekly digest | ~4 |
| `tests/inbound.test.ts` | Inbound email processing | ~5 |
| `tests/inbox-routes.test.ts` | Inbox API routes | ~6 |
| `tests/chats.test.ts` | Chat topics CRUD | ~6 |
| `tests/tts.test.ts` | Text-to-speech | ~3 |
| `tests/batch.test.ts` | Batch analysis | ~4 |
| `tests/reply.test.ts` | Reply drafting | ~4 |

**Total: ~247 tests** (as reported in README)

---

## Performance/Load Test Scenarios

| Scenario | Threshold | Method |
|----------|-----------|--------|
| Analysis (first token) | < 3s P95 | Manual timing in tests |
| Analysis (full stream) | < 30s standard, < 60s deep | Manual timing |
| Chat (first token) | < 5s P95 | Manual timing |
| DB query (single row) | < 50ms P95 | Benchmark tests |
| Rate limiter overhead | < 1ms per request | Micro-benchmark |
| Schema init (cold start) | < 500ms | Startup timing |
| Bundle size | < 250 KB JS | `next build` output analysis |

### Load Test Scenarios (Future)
- **Concurrent analysis:** 50 simultaneous POST /api/analyze/stream requests.
- **Concurrent chat:** 100 simultaneous POST /api/analysis/chat requests.
- **Auth burst:** 1000 login attempts in 1 minute (rate limiter validation).
- **Sync conflict:** 10 concurrent PUT /api/users/me with overlapping records.

---

## Security Test Scenarios

### OWASP Top 10 Coverage

| OWASP Category | Test Case | Status |
|---------------|-----------|--------|
| A01 Broken Access Control | Auth bypass attempts; Pro feature access without subscription | ✅ Covered |
| A02 Cryptographic Failures | Session token forgery; share link decryption | ✅ Covered |
| A03 Injection | SQL injection via input fields; XSS via AI output | ✅ Covered |
| A04 Insecure Design | Rate limiting bypass; webhook signature forgery | ✅ Covered |
| A05 Security Misconfiguration | Debug routes in production; CSP headers | ✅ Covered |
| A06 Vulnerable Components | npm audit; dependency overrides | ✅ Covered |
| A07 Auth Failures | Session revocation; password timing attack | ✅ Covered |
| A08 Data Integrity | Sync record validation; webhook dedup | ✅ Covered |
| A09 Logging Failures | PII in logs; email in logs | ✅ Covered |
| A10 SSRF | No user-controlled URLs in server requests | ✅ N/A |

### Specific Test Cases
- **CSRF:** Send cross-origin POST to /api/analyze/stream → expect 403.
- **Rate limiting:** Send 16th request in 1 minute → expect 429.
- **Auth bypass:** Access /api/users/me without session → expect 401.
- **Pro bypass:** Access /api/billing/checkout as free user → expect 403.
- **Session revocation:** Change password → old session cookie → expect 401.
- **Input overflow:** Send 50,001 char text → expect 413.
- **Empty input:** Send empty message → expect 400.
- **Share expiry:** Access share link > 30 days old → expect 404.
- **Webhook forge:** Send invalid Stripe signature → expect 400.
- **SQL injection:** Send `' OR 1=1--` in text field → expect safe handling.

---

## Test Data Management

- **Fixture files:** Hardcoded in test files (no external fixtures directory).
- **DB state:** Each test creates its own data; `resetDbCache()` for clean slate.
- **Environment variables:** `tests/setup-env.ts` sets required env vars before tests.
- **No external services:** All tests run against mocks (fetch, AI providers, Mailgun, Stripe).
- **Deterministic:** Tests use fixed timestamps and IDs where needed.

---

## Coverage Thresholds

| Category | Minimum Coverage | Current |
|----------|-----------------|---------|
| Unit functions | 90% line coverage | ~85% |
| API routes | 80% branch coverage | ~75% |
| AI client | 95% line coverage | ~90% |
| Validation | 95% branch coverage | ~90% |
| Auth | 90% line coverage | ~85% |
| Overall | 80% line coverage | ~80% |

### Gap Analysis
- **E2E tests:** Not yet implemented; recommended for Playwright or Cypress.
- **Load tests:** Not yet implemented; recommended for k6 or artillery.
- **Edge cases:** Some AI provider error paths may have insufficient mock coverage.
- **Browser tests:** TTS, drag-and-drop, and clipboard operations need browser testing.

---
