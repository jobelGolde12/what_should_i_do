# Contributing & Support — Detailed Plan

Guidelines for contributing to TaskMind and where to find support.

---

## Contributing

Standard GitHub flow:

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/AmazingFeature`
3. Commit changes with clear messages.
4. Push the branch: `git push origin feature/AmazingFeature`
5. Open a Pull Request (use the `blackboxai/` prefix for AI-assisted branches, per team convention).

### Before submitting a PR
- Run `npm run lint` and fix any warnings.
- Run `npm run build` to ensure the app compiles.
- Test manually against the checklist in `08-installation-development.md`.
- Keep changes focused; reference the relevant plan file in `enhancement-plan/`.

---

## Suggested Contribution Areas

| Area | Description | Relevant Files |
|------|-------------|----------------|
| **Better deadline detection** | Parse relative dates ("next Friday", "EOD") into concrete dates; expand regex | `src/app/actions/analyzeText.ts`, `src/lib/openrouter.ts` |
| **New models** | Support additional OpenRouter models / model picker; cheaper fallback model | `src/lib/openrouter.ts` |
| **Additional languages** | Translation support beyond Tagalog | `src/components/TranslatedResult/page.tsx` |
| **UI/UX improvements** | Urgency color badges, loading skeletons, mobile nav, footer social links | `src/components/*` |
| **Documentation & examples** | Rewrite README (remove stale WebLLM content), expand docs | `README.md`, `docs/`, `enhancement-plan/` |
| **Prompt engineering** | Few-shot examples per message type; better confusion extraction | `src/lib/openrouter.ts` |
| **Messy input handling** | Expand OCR typo dictionary; multi-language normalization | `src/app/actions/analyzeText.ts` |
| **Production hardening** | Timeouts, sanitization, telemetry, rate limiting | `src/lib/openrouter.ts`, `src/app/actions/analyzeText.ts` |
| **Dashboard & auth** | Build out the placeholder routes | `src/app/dashboard/`, `src/app/auth/` |

---

## Support Channels

| Channel | Where |
|---------|-------|
| Issues / bug reports | GitHub Issues: https://github.com/jobelGolde12/what_should_i_do/issues |
| Discussions / feature requests | GitHub Discussions |
| Documentation / wiki | GitHub Wiki |
| Live demo for testing | https://whatshouldido-five.vercel.app |
| Internal troubleshooting | `docs/analyze-results-not-working.md` (API keys, rate limits, network, fallback) |

---

## Development Setup Recap

```bash
git clone https://github.com/jobelGolde12/what_should_i_do.git
cd what_should_i_do
npm install
# create .env.local with OPENROUTER_API_KEY1 (+ optional KEY2/KEY3)
npm run dev
```

See `08-installation-development.md` for the full guide.

---

## License

MIT (per README). By contributing, you agree your contributions are licensed under the same terms.

---

## Community & Recognition

- Acknowledge the original WebLLM/MLC AI approach in README history.
- Credit early testers and contributors.
- If the project grows, consider:
  - A `CONTRIBUTING.md` file (expanding this plan).
  - A `CODE_OF_CONDUCT.md`.
  - CI pipeline (GitHub Actions) running `lint` + `build` on PRs.
  - A `CHANGELOG.md` for release notes.

