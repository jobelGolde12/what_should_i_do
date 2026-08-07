# Example — Sample Input & Expected Output

This document defines the canonical example used for testing and documentation, plus the exact expected output structure and how it maps to the UI.

---

## Input

> "Hi team, just a reminder that the final project needs to be submitted via the online portal by Friday. Also, don't forget about the mandatory presentation tomorrow at 10 AM. Late submissions might have penalties but I need to check the exact rules. See you tomorrow!"

---

## Output Structure (English)

| Section | Content |
|---------|---------|
| **ACTIONS** | Submit final project via online portal; Attend mandatory project presentation |
| **DEADLINES** | Today – Project presentation at 10:00 AM; Friday – Final submission |
| **CONFUSING PARTS** | Exact penalties for late submission not specified; Presentation duration/grading criteria unclear |
| **URGENCY** | Urgent |
| **NEXT STEP** | Prepare for tomorrow's presentation and submit the final project before Friday |
| **SUMMARY** | Immediate action required due to tight deadlines and upcoming presentation |

Plus one-click translation (e.g., to Tagalog).

---

## JSON Shape Produced by the Backend

Matches `AnalysisResult` from `src/app/actions/analyzeText.ts`:

```json
{
  "actions": [
    "Submit final project via online portal",
    "Attend mandatory project presentation"
  ],
  "deadlines": [
    "Project presentation at 10:00 AM (tomorrow)",
    "Final submission by Friday"
  ],
  "urgency": "Urgent",
  "confusingParts": [
    { "sentence": "Late submissions might have penalties but I need to check the exact rules.",
      "explanation": "The exact penalties for late submission are not specified." },
    { "sentence": "Presentation duration/grading criteria are unclear.",
      "explanation": "The message does not specify how long the presentation is or how it will be graded." }
  ],
  "nextStep": "Prepare for tomorrow's presentation and submit the final project before Friday",
  "summary": "Immediate action required due to tight deadlines and upcoming presentation.",
  "analysisMethod": "ai"
}
```

> `analysisMethod` is only present in the server-action path (`"ai"` or `"fallback"`). The raw OpenRouter shape (`src/lib/openrouter.ts` → `validateAndNormalizeResponse`) omits it.

---

## Tagalog Translation Example

```
BUOD
Kinakailangan ang agarang aksyon dahil sa nalalapit na presentasyon at mahigpit na mga deadline.

MGA GAWAIN
✅ Isumite ang final project sa online portal
✅ Dumalo sa mandatory na presentasyon

MGA DEADLINE
📅 Bukas: Presentasyon sa 10:00 AM
📅 Biyernes: Huling pagsumite

MGA NAKAKALITONG BAHAGI
⚠️ Hindi tinukoy ang eksaktong parusa sa late submission
⚠️ Hindi malinaw ang tagal ng presentasyon at pamantayan sa pagmamarka

SUSUNOD NA HAKBANG
👉 Maghanda para sa presentasyon bukas at isumite ang final project bago ang Biyernes
```

*(Reference translation; actual output may vary based on the translation backend.)*

---

## How It Renders in the UI

1. **Urgency pill** — `Urgent` rendered as a badge in `main-input-area`.
2. **Actions** — bulleted list with blue dot markers.
3. **Deadlines** — bulleted list with purple dot markers.
4. **ConfusingParts** — via `src/components/ConfusingParts/page.tsx` (sentence + explanation).
5. **Next Step** — highlighted blue box: "If you do only one thing, do this."
6. **Summary** — green box with an "AI Analysis" badge (`analysisMethod === "ai"`) or "Basic Analysis" badge (`"fallback"`).
7. **Translation** — `TranslatedResult` gives one-click translation (e.g., to Tagalog).
8. **Ads** — `AdsContainer` appears once a result exists.

---

## Using This Example

- **Manual QA:** paste the input at `/` and verify all six sections appear with correct values.
- **Fallback test:** temporarily set no valid API keys (or block network) and confirm the rules-based path still returns a reasonable result and shows the "Basic Analysis" badge + "Retry AI" button.
- **Translation test:** confirm the Tagalog toggle produces a translated summary/actions and matches the reference above approximately.

