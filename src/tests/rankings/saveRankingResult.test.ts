import { describe, it, expect } from 'vitest';
import {
  isSaveRankingSuccess,
  resolveSaveRankingOutcome,
} from '@/modules/rankings/domain/saveRankingResult';

describe('saveRankingResult', () => {
  it('identifica sucesso com id', () => {
    const result = { id: 'abc-123', duplicated: false as const };
    expect(isSaveRankingSuccess(result)).toBe(true);
    expect(resolveSaveRankingOutcome(result)).toEqual({ ok: true, id: 'abc-123' });
  });

  it('propaga duplicata sem retornar id', () => {
    const result = {
      duplicated: true as const,
      message: 'Já existe um ranking com mesmo título, órgão e banca.',
    };
    expect(isSaveRankingSuccess(result)).toBe(false);
    expect(resolveSaveRankingOutcome(result)).toEqual({
      ok: false,
      message: result.message,
    });
  });

  it('propaga erro sem retornar id', () => {
    const result = {
      error: true as const,
      message: 'Erro ao salvar ranking: timeout',
    };
    expect(isSaveRankingSuccess(result)).toBe(false);
    expect(resolveSaveRankingOutcome(result)).toEqual({
      ok: false,
      message: result.message,
    });
  });

  it('trata resultado indefinido como falha', () => {
    expect(resolveSaveRankingOutcome(undefined)).toEqual({
      ok: false,
      message: 'Não foi possível salvar o ranking.',
    });
  });
});
