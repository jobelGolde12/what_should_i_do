# Project Overview

**TaskMind** (formerly ActionClarity / "What Should I Do") is an AI-powered productivity web application that turns confusing messages, emails, announcements, memos, notices, or documents into clear, structured, actionable items.

**Live demo:** https://whatshouldido-five.vercel.app  
**Repository:** https://github.com/jobelGolde12/what_should_i_do

It is **not** a generic summarizer or chatbot. It is a **decision & action clarity tool** focused on extracting what you actually need to *do*, when, how urgent it is, and what is still unclear.

---

## At a Glance

| Aspect | Details |
|--------|---------|
| **Name** | TaskMind (branding on live site & metadata) / ActionClarity (README) / what_should_i_do (repo) |
| **Purpose** | Transform messy text into structured actions, deadlines, urgency levels, confusing parts, a single next-step recommendation, and a concise summary |
| **Tech Stack** | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS 4, OpenRouter API (Claude 3.5 Sonnet), client-side file parsing (PDF, DOCX, images via OCR) |
| **Privacy Model** | Server-side LLM calls via OpenRouter (with multi-key failover). No user accounts required for core use. Ads are present (Google AdSense). |
| **Deployment** | Vercel (live demo) |
| **License** | MIT (per README) |
| **Target Users** | Students, professionals, everyday people dealing with official notices, emails, group messages, government/barangay announcements, etc. |

---

## Branding Status (as of latest code)

| Surface | Current Value | File |
|---------|---------------|------|
| Header brand | **TaskMind** | `src/components/header/page.tsx` |
| Footer brand | **TaskMind** | `src/components/Footer.tsx` |
| Root layout metadata title | **TaskMind** | `src/app/layout.tsx` |
| Landing page metadata title | **TaskMind - AI-Powered Task & Deadline Analyzer** | `src/app/page.tsx` |
| Structured data name | TaskMind | `src/app/page.tsx` |
| OpenRouter request title | `TaskMind - Text Analysis` | `src/lib/openrouter.ts` |
| README | ActionClarity (stale) | `README.md` |
| Canonical/OG URL | `https://whatshouldido.app/` (stale) | `src/app/page.tsx` |
| Sitemap URL | `https://whatshouldido-five.vercel.app/` | `src/app/sitemap.ts` |

> **Enhancement follow-up:** Align README + canonical/OG URLs + sitemap with the final production TaskMind domain for fully consistent branding.

---

## Core Differentiators

1. **Action-focused**, not summarization-only — extracts *what to do*.
2. **Deadline-aware** — converts vague time references into concrete dates/times.
3. **Urgency-aware** — color-coded low/medium/high.
4. **Confusion-aware** — highlights ambiguous sentences and explains why.
5. **Decision-oriented** — always outputs a single "next step" recommendation.
6. **Resilient AI backend** — 3-key rotation + rule-based fallback when all keys fail.
7. **No-login core** — usable immediately; ads sustain the service.

