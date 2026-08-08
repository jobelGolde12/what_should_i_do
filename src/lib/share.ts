import type { SharePayload } from "./types";

const PREFIX = "enc:";

function encodePayload(payload: SharePayload): string {
  const json = JSON.stringify(payload);
  const encoded = btoa(unescape(encodeURIComponent(json)));
  return PREFIX + encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodePayload(token: string): SharePayload | null {
  try {
    let encoded = token.startsWith(PREFIX) ? token.slice(PREFIX.length) : token;
    encoded = encoded.replace(/-/g, "+").replace(/_/g, "/");
    while (encoded.length % 4) encoded += "=";
    const json = decodeURIComponent(escape(atob(encoded)));
    const parsed = JSON.parse(json) as SharePayload;
    if (!parsed || !parsed.output) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function buildShareLink(record: {
  input: string;
  output: SharePayload["output"];
  timestamp: number;
}): string {
  const payload: SharePayload = {
    input: record.input,
    output: record.output,
    timestamp: record.timestamp,
  };
  const base =
    typeof window !== "undefined" ? window.location.origin : "";
  return `${base}/share/${PREFIX}${encodePayload(payload).slice(PREFIX.length)}`;
}

export function parseShareToken(token: string): SharePayload | null {
  return decodePayload(PREFIX + token);
}

export async function copyShareLink(record: {
  input: string;
  output: SharePayload["output"];
  timestamp: number;
}): Promise<boolean> {
  const link = buildShareLink(record);
  try {
    await navigator.clipboard.writeText(link);
    return true;
  } catch {
    return false;
  }
}
