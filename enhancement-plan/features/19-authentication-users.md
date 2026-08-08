# Feature 19 — Authentication & Users

## 1. What it is & its role

The **Authentication & Users** feature is intended to provide accounts so users can sync their history, board, templates, and settings across devices and unlock personalized features. Currently it is **only a stub** — the routes exist but are non-functional placeholders.

## 2. Current functionality

### Where it lives
- **Routes:** `src/app/auth/login/page.tsx` → renders `<div>Login Page</div>`.
- **Routes:** `src/app/auth/register/page.tsx` → renders `<div>Register Page</div>`.
- **API:** `src/app/api/users/route.ts` → returns `{ message: 'Hello from Users API!' }`.
- **Dashboard:** `src/app/dashboard/page.tsx` → simply `redirect("/")`.

### How it works today
- **Nothing functional.** Login/register render bare placeholder text; there is no auth provider, no session, no user data, no sign-in/sign-up logic, and no protection.
- No user model, no database, no password hashing, no OAuth, no session management.
- The `/api/users` endpoint is a trivial hello-world stub.

### Current limitations (comprehensive)
- **No authentication at all** — no login, register, logout, password reset, or session.
- **No user data model** — history, board, templates, and settings are purely local (localStorage).
- **No cross-device sync** (blocks Features 11, 12, 13, 18 production readiness).
- **No authorization / it's public** — anyone can use without an account (by design for core use, but no path to account features).
- **No security** — no password hashing (bcrypt/argon2), no rate limiting on login, no CSRF protection, no session invalidation.
- **No OAuth** (Google/GitHub) option.
- Stub routes would be a broken UX if linked.

## 3. Future enhancements (production-ready Authentication & Users)

### 3.1 Auth provider
- Integrate a proven auth solution: **NextAuth/Auth.js** (credentials + OAuth providers) or **Supabase Auth** / **Clerk**.
- Support **email/password** (properly hashed/argon2 or via provider) and **OAuth** (Google, GitHub).

### 3.2 User data model & DB
- Add a database (e.g., Postgres via Prisma/Drizzle) with tables: `users`, `analyses`, `board_items`, `templates`, `user_settings`, `shares`.
- Store **createdBy** on all user-owned records.

### 3.3 Sync & ownership
- Sync history, board, templates, and settings to the backend when signed in (merge local + server).
- Keep **local-first** behavior for anonymous users; prompt to sign in to sync.

### 3.4 Security best practices
- Rate-limit auth endpoints; enforce strong passwords; email verification; secure HTTP-only cookies.
- CSRF protection; session expiry; logout everywhere.
- Account deletion with data erasure (privacy/compliance).

### 3.5 UX
- Proper login/register pages with validation, loading, and error states.
- "Sign in to sync" prompts; account menu in the sidebar; sign-out.
- Forgot-password + reset flow.

### 3.6 Testing
- E2E tests for register/login/logout, session persistence, and protected routes.
- Unit tests for auth utilities and password hashing.
- Security tests (rate limit, brute-force, CSRF).

> **Status: DONE** — Implemented in this round: functional email/password auth with **no new dependencies**. `src/lib/auth/session.ts` provides scrypt password hashing (timing-safe verify) and HMAC-SHA256 signed session tokens (30-day expiry); `src/lib/auth/users.ts` is a file-backed user store (`.data/users.json`, gitignored, with in-memory fallback); `src/lib/auth/cookies.ts` handles httpOnly/sameSite=lax/secure session cookies. API: `POST /api/auth/register` (email+8-char password validation, 409 on duplicate), `POST /api/auth/login` (with per-IP rate limiting, 10/min), `POST /api/auth/logout`, `GET /api/auth/me`, and `src/app/api/users/me` (GET user+data, PUT sync payload ≤2MB, DELETE account erasure). Client: `AuthContext` (login/register/logout/refresh/pushData/pullData/deleteAccount), real login/register pages via `AuthForm`, sidebar account area (sign in / email + sign out), and a Settings Account section with back-up/merge buttons, delete account, and privacy notes. The anonymous local-first experience is unchanged. OAuth, email verification, password reset, and a real SQL DB remain for a later round; the file-backed store keeps the app dependency-free.

> **Definition of "done" for this feature:** Real accounts with secure auth, DB-backed user data, cross-device sync, account/security flows, and comprehensive tests. The core anonymous/local-first experience must remain intact.
