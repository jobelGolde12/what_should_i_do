# Feature 03 — Urgency Classifier

> **Status: DONE** — Added `src/lib/urgency.ts` as the single source of truth (`URGENCY_LEVELS`, `URGENCY_VALUES`, `clampUrgency`, `isUrgencyLevel`) used by the rule classifier, AI prompt/validation, and UI. New `classifyUrgency()` returns a level + human-readable `reason` + `confidence` (lost-item → Informational, weather → Urgent, deadline <24h → Urgent, <7d → Important). AI path now returns `urgencyReason`/`urgencyConfidence` (type + both normalizers updated). `UrgencyMeter` shows the reason/help text from shared constants; per-action urgency dots added to `ActionList`; board items now use `urgencyForAction()` instead of the global level.

## 1. What it is & its role

The **Urgency Classifier** assigns a color-coded urgency level to each analysis so the user can quickly triage what needs attention *first*. It answers: **"How urgent is this?"** with three levels:

- 🟢 **Informational** — can be addressed later / no action needed.
- 🟡 **Important** — should be addressed soon (this week).
- 🔴 **Urgent** — requires immediate attention.

## 2. Current functionality

### Where it lives
- **AI extraction:** `src/lib/openrouter.ts` → system prompt returns `urgency` restricted to `"Urgent" | "Important" | "Informational"`.
- **Rule fallback:** `src/lib/analyzeRules.ts` → `URGENT_KEYWORDS` + heuristics (lost-item notices default to Informational; weather/cyclone → Urgent; presence of deadlines → Important).
- **Validation:** both `openrouter.ts` (`validateAndNormalizeResponse`) and `analyzeRules.ts` (`normalizeAnalysisResult`) clamp to the three valid values.
- **Rendering:** `src/components/results/UrgencyMeter.tsx` (segmented meter) and `src/components/ui/Badge.tsx` (`UrgencyBadge`).

### How it works today
1. The model returns an `urgency` value; it is validated against the allowed set.
2. Rule fallback computes urgency from keywords and context.
3. `ResultsPanel.tsx` shows an `UrgencyBadge` and `UrgencyMeter`.
4. The urgency follows each action onto the Actions Board (Feature 12) and into History filters (Feature 11).

### Current limitations
- **Single global urgency** for the whole analysis — not per-action or per-deadline.
- Rule fallback is keyword-based and can misfire (e.g., "urgent" in an unrelated sentence).
- No supporting rationale ("why is this urgent?").
- No education/help text explaining levels to new users.
- No configurable thresholds or user override.

## 3. Future enhancements (production-ready Urgency Classifier)

### 3.1 Per-action & per-deadline urgency
- Return urgency at the action/deadline level in addition to the overall level so users can prioritize individual items.

### 3.2 Confidence & rationale
- Include a short `reason` string ("Deadline within 24h", "Loss of money risk") and a `confidence` score.
- Show the reason in a tooltip/expandable area.

### 3.3 Configurable thresholds
- Let users define what counts as urgent (e.g., time-window-based) in Settings.

### 3.4 User override
- Allow users to manually change the urgency of an item on the board, with persistence.

### 3.5 Consistent semantics
- Use the same urgency vocabulary across AI prompt, rule fallback, types, and UI (already mostly true) and add a single source-of-truth constants file.

### 3.6 Testing
- Unit tests for the rule-based urgency classifier across many message types.
- Integration tests ensuring the AI output is always validated to one of the three levels.

> **Definition of "done" for this feature:** Urgency is per-item, explainable, overridable, configurable, and uniformly consistent across the whole product and covered by tests.
