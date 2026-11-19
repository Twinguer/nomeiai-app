import { describe, expect, it } from 'vitest';
import {
  EMPTY_DISCIPLINE_STATS,
  hasDisciplineStudyStats,
  isDisciplineCompletedForProgress,
  isDisciplineEmAndamentoEffective,
  isDisciplineInReview,
  isDisciplineNotStarted,
  shouldAutoSetEmAndamento,
  syncDisciplineProgressFromStats,
} from '@/modules/study/domain/disciplineStudyStats';

describe('discipline progress status', () => {
  it('isDisciplineInReview reconhece em_revisao e em-revisao', () => {
    expect(isDisciplineInReview({ status: 'em_revisao' })).toBe(true);
    expect(isDisciplineInReview({ status: 'em-revisao' })).toBe(true);
    expect(isDisciplineInReview({ status: 'em_andamento' })).toBe(false);
    expect(isDisciplineInReview({ status: null })).toBe(false);
  });

  it('isDisciplineCompletedForProgress não conta em revisão', () => {
    expect(isDisciplineCompletedForProgress({ status: 'em_revisao' })).toBe(false);
    expect(isDisciplineCompletedForProgress({ isCompleted: true, status: 'em_revisao' })).toBe(true);
    expect(isDisciplineCompletedForProgress({ isCompleted: true })).toBe(true);
    expect(isDisciplineCompletedForProgress({ status: 'finalizada' })).toBe(true);
  });

  it('isDisciplineNotStarted identifica disciplina sem checks e sem estatísticas', () => {
    expect(isDisciplineNotStarted({ status: null }, EMPTY_DISCIPLINE_STATS)).toBe(true);
    expect(isDisciplineNotStarted({ status: 'em_andamento' }, EMPTY_DISCIPLINE_STATS)).toBe(false);
    expect(isDisciplineNotStarted({ status: 'em_revisao' }, EMPTY_DISCIPLINE_STATS)).toBe(false);
    expect(
      isDisciplineNotStarted({ status: null }, { ...EMPTY_DISCIPLINE_STATS, totalMinutes: 30 })
    ).toBe(false);
  });

  it('shouldAutoSetEmAndamento quando há estatísticas e disciplina sem status', () => {
    const stats = { ...EMPTY_DISCIPLINE_STATS, sessionCount: 1, totalMinutes: 45 };
    expect(shouldAutoSetEmAndamento({ status: null }, stats)).toBe(true);
    expect(shouldAutoSetEmAndamento({ status: 'em_andamento' }, stats)).toBe(false);
    expect(shouldAutoSetEmAndamento({ status: 'em_revisao' }, stats)).toBe(false);
    expect(shouldAutoSetEmAndamento({ isCompleted: true }, stats)).toBe(false);
  });

  it('isDisciplineEmAndamentoEffective considera estatísticas como em andamento', () => {
    const stats = { ...EMPTY_DISCIPLINE_STATS, totalQuestions: 10 };
    expect(isDisciplineEmAndamentoEffective({ status: null }, stats)).toBe(true);
    expect(hasDisciplineStudyStats(stats)).toBe(true);
  });

  it('syncDisciplineProgressFromStats atualiza disciplinas com estatísticas', () => {
    const blocks = [
      {
        id: 'block-1',
        name: 'Bloco A',
        disciplines: [
          { id: 'd1', name: 'Direito', status: null },
          { id: 'd2', name: 'Português', status: 'em_revisao' },
        ],
      },
    ];
    const stats = {
      direito: { ...EMPTY_DISCIPLINE_STATS, totalMinutes: 60, sessionCount: 1 },
    };

    const { blocks: synced, changed } = syncDisciplineProgressFromStats(blocks, stats);

    expect(changed).toBe(true);
    expect(synced[0].disciplines[0].status).toBe('em_andamento');
    expect(synced[0].disciplines[1].status).toBe('em_revisao');
  });
});
