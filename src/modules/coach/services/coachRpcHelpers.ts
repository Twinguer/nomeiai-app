/** Helpers compartilhados para respostas JSON das RPCs coach. */
export function parseCoachRpcJson<T>(data: unknown): T | null {
  if (data == null) return null;
  if (typeof data === 'string') {
    try {
      return JSON.parse(data) as T;
    } catch {
      return null;
    }
  }
  return data as T;
}

export function normalizeCoachAccessAllowed(value: unknown): boolean {
  return value === true || value === 'true';
}

export function normalizeCoachAccessResult(data: unknown): {
  allowed: boolean;
  reason?: string;
  message?: string;
} {
  const row = parseCoachRpcJson<{
    allowed?: unknown;
    reason?: string;
    message?: string;
  }>(data);

  return {
    allowed: normalizeCoachAccessAllowed(row?.allowed),
    reason: row?.reason,
    message: row?.message,
  };
}
