# Changelog

All notable changes to TaskMind will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- CI/CD pipeline with GitHub Actions (lint, typecheck, test, security, build, deploy)
- Docker support with multi-stage Dockerfile and docker-compose.yml
- Sentry error tracking integration (client, server, and edge)
- Error boundary component for graceful error handling
- CONTRIBUTING.md with development guidelines
- CHANGELOG.md for version history tracking

### Changed
- Enhanced Next.js config with Sentry webpack plugin integration
- Updated project-plan with comprehensive architecture documentation

## [0.1.0] - 2026-08-25

### Added

#### Core Features
- Multi-provider AI analysis cascade (TokenRouter → OpenRouter → OpenCode Zen → rule-based fallback)
- Real-time SSE streaming for analysis results
- Schema validation and repair for AI output (zod)
- Circuit breakers for provider resilience (per-provider and per-route)
- Rate limiting (in-memory per-IP and DB-backed for auth)

#### Chat Mode
- Grounded Q&A over analysis results (OpenRouter-only provider)
- SafeMarkdown component for rendering AI responses
- Retry/regenerate controls for failed responses
- Copy-to-clipboard for assistant messages
- Auto-resizing chat composer
- History sanitization and size limits for security

#### Authentication & Security
- User registration with email verification (Mailgun)
- HMAC-signed session cookies (30-day expiry)
- Stateless email tokens with auth_version revocation
- CSRF protection via Origin header check (proxy.ts)
- Share links with AES-256-GCM encryption (30-day TTL)
- Password reset flow with secure tokens

#### Data Management
- Local-first storage (localStorage) for offline functionality
- Cloud sync for signed-up users (LWW merge conflict resolution)
- Turso/libSQL database with idempotent schema migrations
- JSON export/import for data backup

#### Pro Features
- Stripe integration for subscriptions
- Usage metering with atomic increment (tryIncrement)
- Deep analysis mode with extended prompts
- Reply drafting with tone presets
- Batch analysis for multiple texts

#### File Processing
- PDF text extraction (pdfjs-dist)
- DOCX extraction (mammoth)
- OCR for images (Tesseract.js)
- Document-to-Markdown conversion (MinerU)
- Drag-and-drop file upload with preview

#### UI/UX
- Action board (Kanban) for task management
- Multi-language translation
- Voice reading (TTS) with per-language voices
- History management with search
- Template system for reusable text
- Dark mode support
- Responsive design

#### API Endpoints
- `POST /api/analyze/stream` - SSE analysis streaming
- `POST /api/analysis/chat` - SSE chat streaming
- `POST /api/auth/*` - Authentication endpoints
- `GET/PUT/DELETE /api/users/me` - User data sync
- `POST /api/share` - Share link creation
- `POST /api/translate` - Text translation
- `POST /api/billing/*` - Stripe billing
- `POST /api/mailgun/inbound` - Inbound email processing
- `POST /api/cron/*` - Scheduled tasks

#### Documentation
- Comprehensive README with quick start guide
- Security documentation with endpoint inventory
- Architecture decision records (ADRs)
- Project plan with implementation roadmap

### Security
- Scrypt password hashing with timing-safe compare
- Session revocation via auth_version bump
- Stateless email tokens (no DB storage required)
- Input validation and sanitization
- Structured logging (zero PII)
- CSP headers and security headers in production
- Dependency vulnerability scanning (npm audit)

## [0.0.1] - 2026-08-01

### Added
- Initial project setup
- Basic text analysis functionality
- Local storage for history
- Simple UI for input and results

---

## Versioning Strategy

- **Major (X.0.0):** Breaking changes to API, database schema, or configuration
- **Minor (0.X.0):** New features, enhancements, non-breaking changes
- **Patch (0.0.X):** Bug fixes, security patches, documentation updates

## Release Process

1. Update version in `package.json`
2. Update this CHANGELOG.md
3. Create a git tag: `git tag v1.0.0`
4. Push to remote: `git push origin main --tags`
5. CI/CD will automatically build and deploy

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to contribute to this project.
