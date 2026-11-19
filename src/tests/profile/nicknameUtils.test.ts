import { describe, expect, it } from 'vitest';
import {
  formatPublicNicknameHandle,
  normalizeNicknameInput,
  stripNicknamePrefix,
} from '@/utils/nicknameUtils';

describe('nicknameUtils', () => {
  it('remove @ e normaliza "Nataly Lima" para natalylima', () => {
    expect(normalizeNicknameInput('@Nataly Lima')).toBe('natalylima');
  });

  it('translitera acentos em vez de omitir letras', () => {
    expect(normalizeNicknameInput('Natály Lima')).toBe('natalylima');
    expect(normalizeNicknameInput('João Silva')).toBe('joaosilva');
  });

  it('preserva underscore e ponto', () => {
    expect(normalizeNicknameInput('ana.silva_01')).toBe('ana.silva_01');
  });

  it('formata handle público', () => {
    expect(formatPublicNicknameHandle('natalylima')).toBe('@natalylima');
    expect(stripNicknamePrefix('@natalylima')).toBe('natalylima');
  });
});
