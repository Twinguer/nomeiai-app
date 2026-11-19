import { describe, it, expect } from 'vitest';
import {
  canViewClassification,
  canOpenClassificationFromList,
  isParticipatingInConcurso,
} from '@/modules/rankings/domain/rankingAccess';

describe('rankingAccess', () => {
  const user = { id: 'user-1' };

  describe('canViewClassification', () => {
    it('permite visitante anônimo', () => {
      expect(
        canViewClassification({
          user: null,
          isPro: false,
          isShowcase: false,
          isParticipating: false,
        }),
      ).toBe(true);
    });

    it('permite vitrine para Free', () => {
      expect(
        canViewClassification({
          user,
          isPro: false,
          isShowcase: true,
          isParticipating: false,
        }),
      ).toBe(true);
    });

    it('permite Pro', () => {
      expect(
        canViewClassification({
          user,
          isPro: true,
          isShowcase: false,
          isParticipating: false,
        }),
      ).toBe(true);
    });

    it('permite criador Free', () => {
      expect(
        canViewClassification({
          user,
          isPro: false,
          isShowcase: false,
          isParticipating: false,
          createdByUserId: 'user-1',
        }),
      ).toBe(true);
    });

    it('permite participante Free', () => {
      expect(
        canViewClassification({
          user,
          isPro: false,
          isShowcase: false,
          isParticipating: true,
        }),
      ).toBe(true);
    });

    it('bloqueia Free sem participação', () => {
      expect(
        canViewClassification({
          user,
          isPro: false,
          isShowcase: false,
          isParticipating: false,
          createdByUserId: 'other',
        }),
      ).toBe(false);
    });
  });

  describe('canOpenClassificationFromList', () => {
    it('exige login quando não é vitrine', () => {
      expect(
        canOpenClassificationFromList({
          user: null,
          isPro: false,
          isShowcase: false,
          isCreator: false,
          isParticipating: false,
        }),
      ).toBe(false);
    });
  });

  describe('isParticipatingInConcurso', () => {
    it('detecta participação pelo concurso_id', () => {
      expect(
        isParticipatingInConcurso(
          {
            rankings: {
              r1: { concurso_id: 'c1' },
            },
          },
          'c1',
        ),
      ).toBe(true);
    });
  });
});
