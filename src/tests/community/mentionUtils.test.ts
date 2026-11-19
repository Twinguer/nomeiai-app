import { describe, expect, it } from 'vitest';
import { extractMentionNicknames } from '@/modules/community/domain/mentionUtils';

describe('extractMentionNicknames', () => {
  it('extrai nicknames únicos em minúsculas', () => {
    expect(extractMentionNicknames('Oi @Ricardo e @maria, chama @ricardo de novo')).toEqual([
      'ricardo',
      'maria',
    ]);
  });

  it('ignora menções com formato inválido', () => {
    expect(extractMentionNicknames('Oi @ab e @usuario_valido')).toEqual(['usuario_valido']);
  });

  it('retorna vazio quando não há menções', () => {
    expect(extractMentionNicknames('Comentário sem menção')).toEqual([]);
  });
});
