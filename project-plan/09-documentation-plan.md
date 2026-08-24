# 09 — Documentation Plan

> **Project:** TaskMind — Universal Instruction Translator
> **Date:** 2026-08-25

---

## API Documentation Tooling & Standard

### Current Approach
- **Inline JSDoc:** All exported functions, classes, and modules have JSDoc comments.
- **README API Reference:** High-level endpoint documentation in README.md.
- **Security docs:** Endpoint inventory with auth/rate-limit/size-limit in `docs/security.md`.

### Recommended Enhancement
- **OpenAPI/Swagger:** Generate `openapi.json` from route handler annotations.
- **Tool:** `@asteasolutions/zod-to-openapi` — generate OpenAPI specs from existing zod schemas.
- **Endpoint:** Serve at `/api/docs` (admin-only in production).
- **Benefit:** Auto-generated client SDKs; API testing tools; documentation as code.

---

## Code Documentation Standard

### JSDoc Requirements

#### Exported Functions
```typescript
/**
 * Streams one chat completion from OpenRouter.
 *
 * Retries transient failures with exponential backoff ONLY while nothing
 * has been delivered; once the first delta streams, any failure propagates
 * immediately so callers can keep partial content without duplicated output.
 *
 * @param messages - The conversation messages to send
 * @param onDelta - Callback invoked with accumulated text on each SSE chunk
 * @param options - Streaming options (signal, config, maxTokens, temperature)
 * @returns The complete response with content, model, and usage metadata
 * @throws {ChatProviderError} On provider failure (classified by `kind`)
 * @throws {ChatCancelledError} When the caller's signal aborts the request
 */
export async function streamChatCompletion(
  messages: ChatMessage[],
  onDelta: (accumulated: string) => void,
  options: StreamChatOptions = {}
): Promise<ChatStreamResult> { ... }
```

#### Exported Types
```typescript
/**
 * Error classification for chat provider failures.
 * Used to map provider errors to user-friendly copy without leaking internals.
 */
export type ChatErrorKind =
  | "unconfigured"  // No API key set
  | "auth"          // 401/403 from provider
  | "rate-limit"    // 429 temporary throttling
  | "quota"         // 402 or explicit credit exhaustion
  | "timeout"       // Idle watchdog or fetch timeout
  | "network"       // fetch() failure
  | "invalid-response"  // Empty or malformed response
  | "provider";     // Catch-all for other errors
```

#### Classes
```typescript
/**
 * Normalized provider failure with classified error kind.
 *
 * Server-side logs may contain the raw provider message for debugging;
 * callers must NEVER expose `message` to the client — map `kind` to
 * safe, actionable copy instead.
 */
export class ChatProviderError extends Error { ... }
```

#### Module-Level
```typescript
/**
 * OpenRouter-only chat transport for Chat Mode.
 *
 * Responsibilities (kept out of React components and route handlers):
 * - Request construction against the OpenAI-compatible endpoint
 * - SSE parsing, including keep-alive comments and mid-stream errors
 * - Controlled retries: ONLY before any content has streamed
 * - Error normalization into ChatProviderError
 * - Provider metadata capture (actual model used)
 */
```

### Documentation Rules
- **Every public function:** Must have JSDoc with description, @param, @returns, @throws.
- **Every exported type:** Must have description comment.
- **Every module:** Must have module-level description comment.
- **Complex algorithms:** Must have inline comments explaining the approach.
- **TODO comments:** Prohibited in production code; use GitHub Issues instead.
- **No stubs:** Every function must have a real implementation.

---

## Repository Documentation Files

### README.md ✅ (Exists)
- Project description and overview
- Features list with icons
- Quick start instructions
- Installation guide
- Usage examples (API, CLI, module)
- API reference (endpoints)
- Contributing guide
- License

### CONTRIBUTING.md 🔄 (To Create)
Contents:
- Local development setup (prerequisites, install, run)
- Coding conventions (TypeScript strict, Tailwind, file naming)
- Branch naming (`feature/`, `fix/`, `docs/`)
- Commit message format (conventional commits)
- PR process (description, tests, review)
- Testing requirements (run `npm test` before PR)
- Code review checklist
- Issue templates

### CHANGELOG.md 🔄 (To Create)
Format: [Keep a Changelog](https://keepachangelog.com/)
```markdown
# Changelog

All notable changes to TaskMind will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-08-25
### Added
- Chat mode with OpenRouter-only provider
- SafeMarkdown component for AI responses
- Retry/regenerate controls in chat UI
- Copy-to-clipboard for assistant messages
- Auto-resizing chat composer

### Changed
- Chat route isolated to OpenRouter (no cascade)
- SSE streaming hardened with abort handling

### Security
- Added size limits and history sanitization to chat route
```

### docs/security.md ✅ (Exists)
- Architecture security model
- Endpoint inventory with controls
- Hardening status checklist
- Known risks & remediation
- Dependency status

### docs/chat-openrouter.md ✅ (Exists)
- Chat mode architecture
- Error handling details
- Observability guide
- Configuration reference

### README.md Developer Notes ✅ (Exists)
- Stack description
- Build flag explanation
- Runtime-loaded assets
- CSRF protection
- Auth model
- Migration history

---

## Architecture Diagram Regeneration

### Cadence
- **On significant change:** When new features alter the architecture
- **Quarterly review:** Ensure diagrams match current state

### Tools
- **Text-based:** Current diagrams use ASCII art (see 01-architecture-overview.md)
- **Mermaid:** Recommended for rendering in GitHub markdown
- **D2:** Recommended for complex diagrams

### Diagram Locations
| Diagram | File | Content |
|---------|------|---------|
| High-level architecture | `01-architecture-overview.md` | Component diagram, data flow |
| Data flow | `01-architecture-overview.md` | Critical path diagrams |
| Dependency graph | `03-component-breakdown.md` | Import relationships |
| Auth flow | `04-route-and-endpoint-design.md` | Registration → verify → login |
| Sync flow | `04-route-and-endpoint-design.md` | LWW merge lifecycle |

---

## Runbook Documentation

### Operations Runbook

#### Application Startup
1. Verify environment variables are set
2. Run `npm run build` (if not already built)
3. Start with `npm start` (or `node server.js` for standalone)
4. Verify health check: `curl http://localhost:3000/api/health`
5. Verify database: `ensureSchema()` runs on first request

#### Database Migration
1. Schema migrations run automatically via `ensureSchema()`
2. Check `schema_migrations` table for current version
3. If migration fails, check logs for error details
4. Rollback: restore from backup (no automated rollback)

#### AI Provider Failure
1. Check circuit breaker state: `GET /api/debug/ai` (with ADMIN_TOKEN)
2. Verify API keys are valid and have credits
3. Check provider status pages (TokenRouter, OpenRouter, OpenCode Zen)
4. Rule-based fallback ensures analysis works without providers
5. If quota exhausted: top up credits or switch provider keys

#### Rate Limit Issues
1. Check rate limit logs for IP addresses hitting limits
2. In-memory rate limiter resets on restart (acceptable for abuse protection)
3. DB-backed rate limiter (auth ops) persists across restarts
4. If legitimate traffic is blocked: adjust limits in code or add IP to allow-list

#### Stripe Webhook Issues
1. Check webhook events table for processed/deduped events
2. Verify `STRIPE_WEBHOOK_SECRET` matches Stripe dashboard
3. Check logs for webhook processing errors
4. Manually trigger webhook from Stripe dashboard if needed

#### Mailgun Issues
1. Verify `MAILGUN_API_KEY` and `MAILGUN_DOMAIN` are correct
2. Check Mailgun dashboard for delivery status
3. Verify inbound webhook URL is correct
4. Check HMAC signature verification in logs

#### Performance Issues
1. Check structured logs for latency metrics
2. Monitor circuit breaker state (frequent opens indicate provider issues)
3. Check database query performance (ensureSchema indexes)
4. Verify no memory leaks (monitor Node.js heap usage)

#### Security Incidents
1. Rotate `AUTH_SECRET` immediately (revokes all sessions)
2. Rotate `SHARE_SECRET` if share links are compromised
3. Rotate provider API keys if leaked
4. Check logs for unauthorized access attempts
5. Review `docs/security.md` for known risks

---

## Documentation Maintenance

### Ownership
| Document | Owner | Review Cadence |
|----------|-------|---------------|
| README.md | Tech Lead | Monthly |
| CONTRIBUTING.md | Tech Lead | Monthly |
| CHANGELOG.md | All developers | On each release |
| docs/security.md | Security Engineer | Quarterly |
| docs/chat-openrouter.md | Chat feature owner | On feature change |
| project-plan/*.md | Tech Lead | On significant architecture change |
| Inline JSDoc | Component author | On code change |

### Quality Standards
- **Accuracy:** Documentation must match current code state
- **Completeness:** Every public API must be documented
- **Clarity:** Written for developers new to the project
- **Currency:** Updated when code changes; stale docs flagged in PR review

---
