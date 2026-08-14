Here is a copy-paste-ready implementation prompt designed for your AI coding assistant (such as Cursor, Claude, or ChatGPT) or development team. It incorporates OpenRouter as a fallback provider alongside production best practices and architectural enhancements.

---

```markdown
# Developer Task: Integrate OpenRouter Fallback & Enhance AI Pipeline in TaskMind

## Objective
Update the AI analysis system in `TaskMind` to integrate **OpenRouter** as a secondary AI model fallback layer whenever the primary `TokenRouter/Unorouter` client fails or encounters schema errors. Implement resilient multi-tier fallback routing, enhanced diagnostics, and unified schema validation across all provider attempts.

---

## Architecture Requirements

### 1. Multi-Tiered Fallback Cascade
Implement a clear 3-stage fallback flow:

```

[User Input]
│
▼
┌─────────────────────────┐
│  Stage 1: Primary AI    │ ──(Success)──► [Validation & Output]
│  (Unorouter / Token)    │
└────────────┬────────────┘
│ (Transient error / Max retries / Schema failure)
▼
┌─────────────────────────┐
│  Stage 2: Secondary AI  │ ──(Success)──► [Validation & Output]
│  (OpenRouter Provider)  │
└────────────┬────────────┘
│ (Total AI Failure / Offline / Network Timeout)
▼
┌─────────────────────────┐
│  Stage 3: Local Rules   │ ──────────────► [Rule-Based Output]
│  (Rule-Based Fallback)  │
└─────────────────────────┘

```

> **Note on Quota Errors**: If *both* AI providers return quota exhaustion errors (HTTP 429 / Out of credits), propagate the quota error directly to the UI instead of silently dropping down to rule-based analysis.

---

## Key Best Practices & Enhancements to Implement

1. **Unified Schema Validation & JSON Repair**:
   - Both Unorouter and OpenRouter responses must route through the single Zod validation engine in `src/lib/validateAnalysis.ts`.
   - On valid JSON output or repairable truncated JSON, salvage the response before moving to the next fallback tier.

2. **OpenRouter Provider Integration (`src/lib/ai.ts`)**:
   - Use an OpenAI-compatible interface or direct HTTP fetch to OpenRouter (`https://openrouter.ai/api/v1/chat/completions`).
   - Standardize required headers:
     - `Authorization: Bearer process.env.OPENROUTER_API_KEY`
     - `HTTP-Referer: process.env.NEXT_PUBLIC_APP_URL`
     - `X-Title: TaskMind`
   - Configure a fallback model list (e.g., `anthropic/claude-3.5-sonnet`, `meta-llama/llama-3.3-70b-instruct`).
   - Enforce structured outputs by passing system prompt requirements and `response_format: { type: "json_object" }` if supported by the targeted OpenRouter model.

3. **Circuit Breaker & Resilience Overhead**:
   - Maintain independent circuit breaker state tracking for:
     1. `Unorouter` primary status
     2. `OpenRouter` secondary status
   - Skip to OpenRouter immediately if the Unorouter circuit breaker is open (tripped).
   - Implement exponential backoff with jitter for retries within each provider stage.

4. **Telemetry & Diagnostics Tracking**:
   - Update `aiClient.getDiagnostics()` to log provider performance metadata:
     - `lastProviderUsed`: `"unorouter" | "openrouter" | "rule-based"`
     - `fallbackOccurred`: boolean
     - `providerErrors`: record of status codes/error types per provider
   - Ensure **zero PII/user input text** is stored in diagnostic telemetry.

5. **Type Definition & Metadata Updates (`src/lib/types.ts`)**:
   - Extend `analysisMethod` in `AnalysisResult` or track secondary provider usage:
     - `analysisMethod: "ai" | "fallback"`
     - `aiProviderUsed?: "unorouter" | "openrouter"`

---

## Step-by-Step File Implementation Instructions

### File 1: `src/lib/ai.ts`
- Abstract provider logic into a clean interface (`AIProvider`).
- Create `UnorouterProvider` and `OpenRouterProvider` classes implementing `AIProvider`.
- Update `AIClient` orchestration to handle provider selection:
  ```typescript
  async analyze(prompt: string, options?: AnalysisOptions): Promise<RawAIResponse> {
    // 1. Check Unorouter (Primary)
    if (!this.unorouterCircuit.isOpen()) {
      try {
        return await this.callUnorouter(prompt);
      } catch (error) {
        this.unorouterCircuit.recordFailure(error);
        if (isQuotaError(error)) throw error; // Fast-fail on total quota exhaustion
      }
    }

    // 2. Fallback to OpenRouter (Secondary)
    if (!this.openRouterCircuit.isOpen()) {
      try {
        return await this.callOpenRouter(prompt);
      } catch (error) {
        this.openRouterCircuit.recordFailure(error);
        if (isQuotaError(error)) throw error;
      }
    }

    // 3. Fallback Exception
    throw new AIFailureError("All AI providers unavailable or rate-limited.");
  }

```

### File 2: `src/app/actions/analyzeText.ts`

* Update the main action handler pipeline:
1. Input cleaning & enhancement.
2. Execute `aiClient.analyze()`.
3. Validate & repair response via `validateAnalysis()`.
4. If `AIFailureError` occurs, catch and seamlessly execute `ruleBasedAnalysis()`.
5. Populate `analysisMethod: "ai"` or `"fallback"` alongside telemetry diagnostics.



### File 3: `src/lib/validateAnalysis.ts`

* Ensure Zod coercion handles minor variations from OpenRouter models (e.g., ensuring arrays are correctly parsed if returned as single string primitives, standardizing urgency casing).

---

## Verification & Acceptance Criteria

1. **Happy Path (Primary)**: When `Unorouter` is active and healthy, requests complete using the primary provider.
2. **OpenRouter Fallback**: Simulate a 500/503 error or offline state on `Unorouter`. The system must automatically switch to `OpenRouter`, successfully analyze the text, and pass validation without throwing an unhandled exception.
3. **Local Rule Fallback**: Simulate failure on both `Unorouter` and `OpenRouter`. The system should smoothly complete analysis using the rule-based fallback system with `analysisMethod: "fallback"`.
4. **Quota Propagation**: When receiving 429 quota exhaustion errors, ensure the UI receives the explicit quota error notice rather than falling back silently.
5. **Schema Validation**: Verify invalid or malformed JSON responses from either AI provider are caught, repaired, or cause a fallback attempt to the next tier.

```

```