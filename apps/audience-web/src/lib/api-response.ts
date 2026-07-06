type ApiEnvelope<T> = {
  data?: T;
  meta?: unknown;
  success?: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function unwrapApiData<T>(payload: unknown): T {
  if (isRecord(payload) && 'data' in payload) {
    return (payload as ApiEnvelope<T>).data as T;
  }

  return payload as T;
}

export function unwrapApiList<T>(payload: unknown): T[] {
  const unwrapped = unwrapApiData<unknown>(payload);

  if (Array.isArray(unwrapped)) {
    return unwrapped as T[];
  }

  if (isRecord(unwrapped)) {
    if (Array.isArray(unwrapped.data)) {
      return unwrapped.data as T[];
    }

    if (Array.isArray(unwrapped.items)) {
      return unwrapped.items as T[];
    }

    if (Array.isArray(unwrapped.results)) {
      return unwrapped.results as T[];
    }
  }

  return [];
}
