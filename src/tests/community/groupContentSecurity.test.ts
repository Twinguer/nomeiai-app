import { describe, expect, it } from 'vitest';
import {
  MAX_GROUP_CONTENT_LENGTH,
  sanitizeGroupContent,
  validateGroupContent,
  validateGroupPostAttachments,
} from '@/modules/community/domain/groupContentSecurity';

describe('groupContentSecurity', () => {
  it('remove tags HTML e preserva texto útil', () => {
    expect(sanitizeGroupContent('Olá <b>mundo</b> <script>alert(1)</script>')).toBe('Olá mundo');
  });

  it('preserva blocos de código como texto', () => {
    const code = 'SELECT * FROM users;';
    expect(sanitizeGroupContent(code)).toBe(code);
  });

  it('rejeita conteúdo vazio', () => {
    expect(validateGroupContent('   <br>')).toEqual({
      ok: false,
      error: 'O conteúdo não pode ser vazio.',
    });
  });

  it('aceita conteúdo válido dentro do limite', () => {
    const text = 'Comentário com @usuario';
    expect(validateGroupContent(text)).toEqual({ ok: true, value: text });
  });

  it('rejeita conteúdo acima do limite', () => {
    const longText = 'a'.repeat(MAX_GROUP_CONTENT_LENGTH + 1);
    expect(validateGroupContent(longText).ok).toBe(false);
  });

  it('aceita anexo válido do storage do grupo', () => {
    const groupId = '11111111-1111-1111-1111-111111111111';
    expect(
      validateGroupPostAttachments(groupId, [
        {
          url: `https://projeto.supabase.co/storage/v1/object/public/profiles/group-posts/${groupId}/arquivo.pdf`,
          type: 'pdf',
          name: 'arquivo.pdf',
        },
      ])
    ).toEqual({
      ok: true,
      value: [
        {
          url: `https://projeto.supabase.co/storage/v1/object/public/profiles/group-posts/${groupId}/arquivo.pdf`,
          type: 'pdf',
          name: 'arquivo.pdf',
        },
      ],
    });
  });

  it('rejeita anexo de outro grupo ou domínio', () => {
    const groupId = '11111111-1111-1111-1111-111111111111';
    const otherGroupId = '22222222-2222-2222-2222-222222222222';

    expect(
      validateGroupPostAttachments(groupId, [
        {
          url: `https://evil.com/storage/v1/object/public/profiles/group-posts/${groupId}/x.pdf`,
          type: 'pdf',
          name: 'x.pdf',
        },
      ]).ok
    ).toBe(false);

    expect(
      validateGroupPostAttachments(groupId, [
        {
          url: `https://projeto.supabase.co/storage/v1/object/public/profiles/group-posts/${otherGroupId}/x.pdf`,
          type: 'pdf',
          name: 'x.pdf',
        },
      ]).ok
    ).toBe(false);
  });
});
