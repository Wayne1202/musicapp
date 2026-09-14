/** Minimal toast pub-sub: `toast(...)` can be called from anywhere (hooks, lib code) without
 *  needing a React context; ToastHost (rendered once near the root) subscribes and renders. */

export type ToastVariant = "default" | "success" | "error";

export interface ToastMessage {
  id: string;
  text: string;
  variant: ToastVariant;
}

type Listener = (toast: ToastMessage) => void;

const listeners = new Set<Listener>();
let nextId = 0;

function emit(text: string, variant: ToastVariant) {
  const message: ToastMessage = { id: String(nextId++), text, variant };
  for (const listener of listeners) listener(message);
}

export function toast(text: string) {
  emit(text, "default");
}
toast.success = (text: string) => emit(text, "success");
toast.error = (text: string) => emit(text, "error");

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
