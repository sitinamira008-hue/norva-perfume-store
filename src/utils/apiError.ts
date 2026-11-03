/**
 * Extracts a clean, human-readable error string from any backend or gateway error payload.
 * Guarantees "[object Object]" or raw HTML pages are never displayed to customers.
 */
export function extractApiErrorMessage(data: unknown, fallback: string): string {
  if (!data) return fallback;

  if (typeof data === 'string') {
    const trimmed = data.trim();
    if (
      trimmed &&
      trimmed !== '[object Object]' &&
      !trimmed.startsWith('<!DOCTYPE') &&
      !trimmed.startsWith('<html')
    ) {
      return trimmed.slice(0, 320);
    }
    return fallback;
  }

  if (typeof data === 'object') {
    const record = data as Record<string, unknown>;
    const rawErr = record.error ?? record.message ?? record.detail;

    if (typeof rawErr === 'string') {
      const trimmed = rawErr.trim();
      if (trimmed && trimmed !== '[object Object]') {
        return trimmed;
      }
    }

    if (rawErr && typeof rawErr === 'object') {
      const errObj = rawErr as Record<string, unknown>;
      if (
        typeof errObj.message === 'string' &&
        errObj.message.trim() &&
        errObj.message.trim() !== '[object Object]'
      ) {
        return errObj.message.trim();
      }
      if (
        typeof errObj.error === 'string' &&
        errObj.error.trim() &&
        errObj.error.trim() !== '[object Object]'
      ) {
        return errObj.error.trim();
      }
      if (typeof errObj.code === 'string' && errObj.code.trim()) {
        return `${fallback} (${errObj.code.trim()})`;
      }
    }

    if (Array.isArray(record.errors) && record.errors.length > 0) {
      const first = record.errors[0];
      if (typeof first === 'string' && first.trim()) {
        return first.trim();
      }
      if (first && typeof first === 'object') {
        const msg = (first as Record<string, unknown>).message;
        if (typeof msg === 'string' && msg.trim()) {
          return msg.trim();
        }
      }
    }
  }

  return fallback;
}
