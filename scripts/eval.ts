/**
 * Accuracy evaluation harness.
 *
 * Runs the analyzer over the labeled dataset in `evaluation/cases/*.json` and
 * reports precision / recall / exact-match / accuracy.
 *
 * Usage:
 *   npm run eval            # rule-based fallback (offline, no key needed)
 *   npm run eval -- live    # live AI provider (requires TOKENROUTER_API_KEY + credits)
 *
 * A case file looks like:
 *   { "id": string, "input": string, "expected": { actions: string[], deadlines: string[], urgency: "Urgent"|"Important"|"Informational", summary: string } }
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { analyzeWithRules } from "@/lib/analyzeRules";
import { aiClient } from "@/lib/ai";
import type { AnalysisResult } from "@/app/actions/analyzeText";

type Expected = {
  actions?: string[];
  deadlines?: string[];
  urgency?: string;
  summary?: string;
};

type Case = {
  id: string;
  input: string;
  expected: Expected;
};

type SetMetrics = {
  precision: number; // matched / predicted
  recall: number; // matched / gold
  exactMatch: boolean;
};

const CASES_DIR = path.resolve(__dirname, "../evaluation/cases");

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(text: string): Set<string> {
  return new Set(normalize(text).split(" ").filter(Boolean));
}

/** True when one string is contained in the other, or token overlap is high. */
function matches(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  if (na.includes(nb) || nb.includes(na)) return true;
  const ta = tokens(a);
  const tb = tokens(b);
  const inter = [...ta].filter((t) => tb.has(t)).length;
  const union = new Set([...ta, ...tb]).size;
  return union > 0 && inter / union > 0.5;
}

function bestMatch(predicted: string[], gold: string[]): boolean[] {
  const used = new Set<number>();
  return gold.map((g) => {
    const idx = predicted.findIndex((p, i) => !used.has(i) && matches(p, g));
    if (idx !== -1) {
      used.add(idx);
      return true;
    }
    return false;
  });
}

function setMetrics(predicted: string[], gold: string[]): SetMetrics {
  const matchesArr = bestMatch(predicted, gold);
  const matched = matchesArr.filter(Boolean).length;
  const precision = predicted.length ? matched / predicted.length : 0;
  const recall = gold.length ? matched / gold.length : 1;
  const exactMatch =
    predicted.length === gold.length && matched === gold.length;
  return { precision, recall, exactMatch };
}

function summarize(name: string, metrics: SetMetrics[]) {
  const avg = (fn: (m: SetMetrics) => number) =>
    metrics.length ? metrics.reduce((s, m) => s + fn(m), 0) / metrics.length : 0;
  const exact = metrics.filter((m) => m.exactMatch).length;
  return {
    field: name,
    precision: avg((m) => m.precision).toFixed(3),
    recall: avg((m) => m.recall).toFixed(3),
    exactMatch: `${exact}/${metrics.length}`,
  };
}

function printRow(row: Record<string, string>) {
  console.log(
    [row.id, row.field, row.precision, row.recall, row.exactMatch]
      .map((c) => c.padEnd(24))
      .join("")
  );
}

async function run() {
  const live = process.argv.includes("live") || process.env.EVAL_LIVE === "1";
  const files = readdirSync(CASES_DIR).filter((f) => f.endsWith(".json"));
  if (files.length === 0) {
    console.error("No cases found in evaluation/cases/");
    process.exit(1);
  }

  const cases: Case[] = files.map((f) =>
    JSON.parse(readFileSync(path.join(CASES_DIR, f), "utf8"))
  );

  console.log(
    `Running evaluation over ${cases.length} cases (mode: ${live ? "LIVE AI" : "rules"})`
  );

  const actionMetrics: SetMetrics[] = [];
  const deadlineMetrics: SetMetrics[] = [];
  const urgencyHits = [];
  const summaryHits = [];

  for (const c of cases) {
    let result: AnalysisResult;
    if (live) {
      if (!aiClient.configured) {
        console.error(
          "LIVE mode requires TOKENROUTER_API_KEY. Run `npm run eval` for the offline rules harness."
        );
        process.exit(1);
      }
      try {
        const { result: r } = await aiClient.analyzeStructured(c.input);
        result = r;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[${c.id}] AI provider error: ${message}`);
        process.exitCode = 1;
        continue;
      }
    } else {
      result = analyzeWithRules(c.input);
    }

    const expected = c.expected;
    const am = setMetrics(result.actions, expected.actions ?? []);
    const dm = setMetrics(result.deadlines, expected.deadlines ?? []);
    actionMetrics.push(am);
    deadlineMetrics.push(dm);
    urgencyHits.push(result.urgency === expected.urgency);
    summaryHits.push(expected.summary ? matches(result.summary, expected.summary) : true);

    printRow({
      id: c.id,
      field: "actions",
      precision: am.precision.toFixed(3),
      recall: am.recall.toFixed(3),
      exactMatch: am.exactMatch ? "yes" : "no",
    });
    printRow({
      id: c.id,
      field: "deadlines",
      precision: dm.precision.toFixed(3),
      recall: dm.recall.toFixed(3),
      exactMatch: dm.exactMatch ? "yes" : "no",
    });
    printRow({
      id: c.id,
      field: "urgency",
      precision: result.urgency === expected.urgency ? "1.000" : "0.000",
      recall: "-",
      exactMatch: result.urgency === expected.urgency ? "yes" : "no",
    });
  }

  console.log("\n— Averages —");
  const a = summarize("actions", actionMetrics);
  const d = summarize("deadlines", deadlineMetrics);
  const urgencyAcc = urgencyHits.length
    ? (urgencyHits.filter(Boolean).length / urgencyHits.length).toFixed(3)
    : "n/a";
  const summaryAcc = summaryHits.length
    ? (summaryHits.filter(Boolean).length / summaryHits.length).toFixed(3)
    : "n/a";

  console.table({
    actions: a,
    deadlines: d,
    urgency: { field: "urgency", precision: urgencyAcc, recall: "-", exactMatch: `${urgencyHits.filter(Boolean).length}/${urgencyHits.length}` },
    summary: { field: "summary", precision: summaryAcc, recall: "-", exactMatch: `${summaryHits.filter(Boolean).length}/${summaryHits.length}` },
  });
}

run().catch((error) => {
  console.error("Evaluation failed:", error);
  process.exit(1);
});
