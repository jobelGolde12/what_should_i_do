"use client";

/**
 * Minimal module-level toast store. Components call `toast(...)` for transient
 * confirmations; a single <Toaster /> renders them. Kept tiny and framework-free
 * so it can be used from any client component without prop drilling.
 */

export type ToastKind = "info" | "success" | "error";

export type ToastItem = {
  id: number;
  message: string;
  kind: ToastKind;
};

type Listener = (toasts: ToastItem[]) => void;

let toasts: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<Listener>();

function emit() {
  const snapshot = toasts;
  for (const listener of listeners) listener(snapshot);
}

export function subscribeToast(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getToasts(): ToastItem[] {
  return toasts;
}

export function toast(
  message: string,
  kind: ToastKind = "info",
  ttl = 3000
): void {
  const id = nextId++;
  toasts = [...toasts, { id, message, kind }];
  emit();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  }, ttl);
}
