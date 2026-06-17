type ApiErrorShape = {
  response?: {
    data?: {
      message?: string | string[];
    };
  };
};

export function extractApiMessages(error: unknown, fallback: string): string[] {
  if (typeof error !== 'object' || error === null || !('response' in error)) {
    return [fallback];
  }

  const message = (error as ApiErrorShape).response?.data?.message;
  if (Array.isArray(message)) {
    return message.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  }

  if (typeof message === 'string' && message.trim().length > 0) {
    return [message];
  }

  return [fallback];
}

