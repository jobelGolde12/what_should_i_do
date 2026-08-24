"use client";

import { useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";

/**
 * Minimal, dependency-free markdown renderer for chat answers.
 *
 * Security model: output is built exclusively from React elements — plain
 * strings are rendered as text nodes (React escapes them) and links are only
 * created for http(s) URLs. No `dangerouslySetInnerHTML`, no HTML parsing,
 * so model output can never inject markup or scripts.
 *
 * Supported subset (models behind openrouter/free may emit markdown even
 * though the system prompt asks for plain text): fenced code blocks,
 * headings (#..###), unordered/ordered lists, blockquotes, inline code,
 * bold/italic, and links. Everything else renders as plain paragraphs.
 */

type Token =
  | { kind: "code"; lang: string; code: string }
  | { kind: "heading"; level: 1 | 2 | 3; text: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "quote"; lines: string[] }
  | { kind: "p"; text: string };

function tokenizeBlocks(src: string): Token[] {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const tokens: Token[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block (unclosed fences render to the end — safe while streaming).
    const fence = line.match(/^\s*```(\S*)\s*$/);
    if (fence) {
      const lang = fence[1] ?? "";
      const buf: string[] = [];
      i += 1;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) {
        buf.push(lines[i]);
        i += 1;
      }
      i += 1; // skip closing fence (or EOF)
      tokens.push({ kind: "code", lang, code: buf.join("\n") });
      continue;
    }

    if (!line.trim()) {
      i += 1;
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      tokens.push({
        kind: "heading",
        level: heading[1].length as 1 | 2 | 3,
        text: heading[2],
      });
      i += 1;
      continue;
    }

    const bullet = line.match(/^\s*[-*+]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (bullet || numbered) {
      const ordered = Boolean(numbered);
      const items: string[] = [];
      while (i < lines.length) {
        const m = lines[i].match(/^\s*(?:[-*+]|\d+[.)])\s+(.*)$/);
        if (!m) break;
        items.push(m[1]);
        i += 1;
      }
      tokens.push({ kind: "list", ordered, items });
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const quoteLines: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^\s*>\s?/, ""));
        i += 1;
      }
      tokens.push({ kind: "quote", lines: quoteLines });
      continue;
    }

    // Paragraph: consecutive non-empty, non-structural lines.
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^\s*```/.test(lines[i]) &&
      !/^(#{1,3})\s+/.test(lines[i]) &&
      !/^\s*(?:[-*+]|\d+[.)])\s+/.test(lines[i]) &&
      !/^\s*>\s?/.test(lines[i])
    ) {
      para.push(lines[i]);
      i += 1;
    }
    if (para.length > 0) tokens.push({ kind: "p", text: para.join("\n") });
  }

  return tokens;
}

/**
 * Inline formatting → React nodes. Operates on plain text with regex
 * splitting; every literal fragment stays a string (auto-escaped by React).
 */
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // Order matters: code spans first so their contents aren't formatted.
  const pattern =
    /(`[^`\n]+`)|(\*\*\*[^*\n]+\*\*\*)|(\*\*[^*\n]+\*\*)|(__[^_\n]+__)|(\*[^*\n]+\*)|(_[^_\n]+_)|(\[[^\]\n]*\]\(https?:\/\/[^\s)]+\))/g;

  let last = 0;
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const tokenText = match[0];
    const key = `${keyPrefix}-i${idx++}`;

    if (tokenText.startsWith("`")) {
      nodes.push(
        <code
          key={key}
          className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[0.85em]"
        >
          {tokenText.slice(1, -1)}
        </code>
      );
    } else if (tokenText.startsWith("***")) {
      nodes.push(
        <strong key={key}>
          <em>{tokenText.slice(3, -3)}</em>
        </strong>
      );
    } else if (tokenText.startsWith("**") || tokenText.startsWith("__")) {
      nodes.push(<strong key={key}>{tokenText.slice(2, -2)}</strong>);
    } else if (tokenText.startsWith("[")) {
      const linkMatch = tokenText.match(/\[([^\]\n]*)\]\((https?:\/\/[^\s)]+)\)/);
      if (linkMatch) {
        nodes.push(
          <a
            key={key}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:opacity-80"
          >
            {linkMatch[1] || linkMatch[2]}
          </a>
        );
      } else {
        nodes.push(tokenText);
      }
    } else {
      nodes.push(<em key={key}>{tokenText.slice(1, -1)}</em>);
    }
    last = match.index + tokenText.length;
  }

  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function CodeBlock({
  code,
  lang,
}: {
  code: string;
  lang?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable (permissions/insecure context) — ignore */
    }
  }

  return (
    <div className="my-2 overflow-hidden rounded-tm border border-line">
      <div className="flex items-center justify-between gap-2 border-b border-line bg-surface-2 px-2.5 py-1">
        <span className="font-mono text-xxs uppercase tracking-label text-muted">
          {lang || "code"}
        </span>
        <button
          type="button"
          onClick={() => void copy()}
          aria-label={copied ? "Code copied" : "Copy code"}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-xxs uppercase tracking-label text-muted transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1"
        >
          {copied ? (
            <Check className="h-3 w-3" aria-hidden="true" />
          ) : (
            <Copy className="h-3 w-3" aria-hidden="true" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="max-w-full overflow-x-auto p-2.5 text-xs leading-relaxed">
        <code className="font-mono">{code}</code>
      </pre>
    </div>
  );
}

export default function SafeMarkdown({ text }: { text: string }) {
  const tokens = tokenizeBlocks(text);

  return (
    <>
      {tokens.map((token, i) => {
        switch (token.kind) {
          case "code":
            return <CodeBlock key={i} code={token.code} lang={token.lang} />;
          case "heading": {
            const sizeCls =
              token.level === 1
                ? "text-base font-semibold"
                : token.level === 2
                  ? "text-sm font-semibold"
                  : "text-xs font-semibold";
            return (
              <p key={i} className={`mt-2 mb-1 ${sizeCls}`}>
                {renderInline(token.text, `h${i}`)}
              </p>
            );
          }
          case "list":
            return token.ordered ? (
              <ol key={i} className="my-1 ml-4 list-decimal space-y-0.5">
                {token.items.map((item, j) => (
                  <li key={j}>{renderInline(item, `ol${i}-${j}`)}</li>
                ))}
              </ol>
            ) : (
              <ul key={i} className="my-1 ml-4 list-disc space-y-0.5">
                {token.items.map((item, j) => (
                  <li key={j}>{renderInline(item, `ul${i}-${j}`)}</li>
                ))}
              </ul>
            );
          case "quote":
            return (
              <blockquote
                key={i}
                className="my-1 border-l-2 border-line pl-2 text-muted"
              >
                {token.lines.map((line, j) => (
                  <p key={j}>{renderInline(line, `q${i}-${j}`)}</p>
                ))}
              </blockquote>
            );
          default:
            return (
              <p key={i} className="whitespace-pre-line">
                {renderInline(token.text, `p${i}`)}
              </p>
            );
        }
      })}
    </>
  );
}
