import { useRef, useState } from 'react';
import { ApiError } from './platformHttp';
interface Parser<T> {
  safeParse: (value: unknown) => { success: true; data: T } | { success: false };
}
export function usePendingOperation<T extends { operationId: string }, R>({
  storageKey,
  schema,
  allowed,
  request,
  onStart,
  onSuccess,
  onError,
  onFinally,
}: {
  storageKey: string;
  schema: Parser<T>;
  allowed: boolean;
  request: (input: T, signal: AbortSignal) => Promise<R>;
  onStart: () => void;
  onSuccess: (result: R) => void;
  onError: (error: Error) => void;
  onFinally: () => void;
}) {
  const [pending, setPending] = useState<{ input: T; uncertain: boolean } | undefined>(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return;
      const result = schema.safeParse(JSON.parse(raw));
      return result.success ? { input: result.data, uncertain: true } : undefined;
    } catch {
      return undefined;
    }
  });
  const lock = useRef(false);
  async function execute(input: T, retrying = false) {
    if (lock.current || !allowed) return;
    lock.current = true;
    onStart();
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 15000);
    try {
      const existing = sessionStorage.getItem(storageKey);
      if (existing) {
        const parsed = schema.safeParse(JSON.parse(existing));
        if (parsed.success && parsed.data.operationId !== input.operationId) {
          setPending({ input: parsed.data, uncertain: true });
          onError(
            new Error(
              'Hay otra operación pendiente en esta pestaña. Confírmala antes de registrar una nueva.',
            ),
          );
          return;
        }
      }
      sessionStorage.setItem(storageKey, JSON.stringify(input));
      setPending({ input, uncertain: retrying });
      const result = await request(input, controller.signal);
      sessionStorage.removeItem(storageKey);
      setPending(undefined);
      onSuccess(result);
    } catch (error) {
      onError(error as Error);
      if (error instanceof ApiError && error.status >= 400 && error.status < 500 && !retrying) {
        sessionStorage.removeItem(storageKey);
        setPending(undefined);
      } else setPending({ input, uncertain: true });
    } finally {
      clearTimeout(timer);
      lock.current = false;
      onFinally();
    }
  }
  return { pending, execute };
}
