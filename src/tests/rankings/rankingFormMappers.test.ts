import { describe, it, expect } from 'vitest';
import {
  createHasCotaStructure,
  createSubjectsStructure,
  ensureNumeric,
  normalizeRankingIdentity,
  resolveHasCotaStructure,
} from '@/modules/rankings/domain/rankingFormMappers';

describe('rankingFormMappers', () => {
  it('ensureNumeric converte strings e trata inválidos', () => {
    expect(ensureNumeric('12.5')).toBe(12.5);
    expect(ensureNumeric(null)).toBe(0);
    expect(ensureNumeric('abc')).toBe(0);
  });

  it('normalizeRankingIdentity colapsa espaços e maiúsculas', () => {
    expect(normalizeRankingIdentity('  tcu  ')).toBe('TCU');
  });

  it('createSubjectsStructure reflete flags do formulário', () => {
    const subjects = createSubjectsStructure({
      has_discursive: true,
      discursive_minimum_score: 5,
      has_case_study_1: false,
    });
    expect(subjects.discr).toBe(true);
    expect(subjects.discr_min_score).toBe(5);
    expect(subjects.case1).toBe(false);
  });

  it('createHasCotaStructure mapeia cotas', () => {
    const cota = createHasCotaStructure({ has_ppp: true, has_pcd: false });
    expect(cota.ppp).toBe(true);
    expect(cota.pcd).toBe(false);
  });

  it('resolveHasCotaStructure preserva cotas existentes quando form está vazio', () => {
    const resolved = resolveHasCotaStructure({
      formValues: { has_ppp: false, has_pcd: false },
      existingHasCota: { ppp: true, pcd: false, ind: false, hip: false, tra: false },
    });
    expect(resolved.ppp).toBe(true);
    expect(resolved.pcd).toBe(false);
  });

  it('resolveHasCotaStructure herda cotas do parent quando form e registro estão vazios', () => {
    const resolved = resolveHasCotaStructure({
      formValues: {},
      existingHasCota: { ppp: false, pcd: false },
      parentHasCota: { pcd: true, ppp: false, ind: false, hip: false, tra: false },
    });
    expect(resolved.pcd).toBe(true);
  });
});
