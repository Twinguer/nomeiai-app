import { describe, it, expect } from 'vitest';
import {
  normalizeCoachAccessAllowed,
  normalizeCoachAccessResult,
  parseCoachRpcJson,
} from '@/modules/coach/services/coachRpcHelpers';

describe('coachRpcHelpers', () => {
  it('parseCoachRpcJson parses JSON string', () => {
    expect(parseCoachRpcJson<{ allowed: boolean }>('{"allowed":true}')).toEqual({
      allowed: true,
    });
  });

  it('parseCoachRpcJson returns object as-is', () => {
    expect(parseCoachRpcJson({ allowed: true })).toEqual({ allowed: true });
  });

  it('parseCoachRpcJson returns null for invalid JSON', () => {
    expect(parseCoachRpcJson('not-json')).toBeNull();
  });

  it('normalizeCoachAccessAllowed accepts boolean and string true', () => {
    expect(normalizeCoachAccessAllowed(true)).toBe(true);
    expect(normalizeCoachAccessAllowed('true')).toBe(true);
    expect(normalizeCoachAccessAllowed(false)).toBe(false);
  });

  it('normalizeCoachAccessResult maps RPC payload', () => {
    expect(
      normalizeCoachAccessResult({ allowed: 'true', reason: 'ok', message: 'Acesso' })
    ).toEqual({
      allowed: true,
      reason: 'ok',
      message: 'Acesso',
    });
  });

  it('normalizeCoachAccessResult defaults allowed to false', () => {
    expect(normalizeCoachAccessResult(null)).toEqual({
      allowed: false,
      reason: undefined,
      message: undefined,
    });
  });
});
