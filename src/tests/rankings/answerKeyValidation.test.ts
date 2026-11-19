import { describe, it, expect } from 'vitest';
import { validateOfficialAnswerKeyCompleteness } from '@/modules/rankings/domain/answerKeyValidation';

describe('validateOfficialAnswerKeyCompleteness', () => {
  const completeConcurso = {
    exam_type: 'Múltipla Escolha',
    disciplines: [{ name: 'Português', isEnabled: true, questionCount: 2 }],
    exam_booklets: [{ id: 'booklet-1', name: 'Caderno A' }],
    official_answers: {
      'booklet-1': { questions: { '1': 'A', '2': 'B' } },
    },
  };

  it('aceita gabarito completo', () => {
    expect(validateOfficialAnswerKeyCompleteness(completeConcurso)).toEqual({ ok: true });
  });

  it('rejeita sem cadernos', () => {
    const result = validateOfficialAnswerKeyCompleteness({
      ...completeConcurso,
      exam_booklets: [],
    });
    expect(result).toEqual({ ok: false, message: 'Nenhum caderno configurado' });
  });

  it('rejeita sem gabarito oficial', () => {
    const result = validateOfficialAnswerKeyCompleteness({
      ...completeConcurso,
      official_answers: {},
    });
    expect(result).toEqual({ ok: false, message: 'Gabarito oficial não encontrado' });
  });

  it('rejeita caderno sem questões suficientes', () => {
    const result = validateOfficialAnswerKeyCompleteness({
      ...completeConcurso,
      official_answers: {
        'booklet-1': { questions: { '1': 'A' } },
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('Caderno "Caderno A"');
      expect(result.message).toContain('1 de 2');
    }
  });
});
