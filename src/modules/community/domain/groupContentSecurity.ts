import DOMPurify from 'dompurify';
import type { PostAttachment } from './types';

export const MAX_GROUP_CONTENT_LENGTH = 500;
export const MAX_GROUP_ATTACHMENTS = 5;
const SUPABASE_STORAGE_ATTACHMENT_PATTERN =
  /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\/profiles\/group-posts\//i;

export function sanitizeGroupContent(content: string): string {
  const withoutHtml = DOMPurify.sanitize(content, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
  return withoutHtml.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
}

export function validateGroupContent(
  content: string,
  options: { allowEmpty?: boolean } = {}
): { ok: true; value: string } | { ok: false; error: string } {
  const sanitized = sanitizeGroupContent(content);

  if (!options.allowEmpty && sanitized.length === 0) {
    return { ok: false, error: 'O conteúdo não pode ser vazio.' };
  }

  if (sanitized.length > MAX_GROUP_CONTENT_LENGTH) {
    return {
      ok: false,
      error: `O conteúdo excede ${MAX_GROUP_CONTENT_LENGTH} caracteres.`,
    };
  }

  return { ok: true, value: sanitized };
}

export function validateGroupPostAttachments(
  groupId: string,
  attachments?: PostAttachment[]
): { ok: true; value: PostAttachment[] } | { ok: false; error: string } {
  if (!attachments?.length) {
    return { ok: true, value: [] };
  }

  if (attachments.length > MAX_GROUP_ATTACHMENTS) {
    return { ok: false, error: `Máximo de ${MAX_GROUP_ATTACHMENTS} anexos por post.` };
  }

  const requiredPrefix = `/storage/v1/object/public/profiles/group-posts/${groupId}/`;
  const validated: PostAttachment[] = [];

  for (const attachment of attachments) {
    const url = attachment.url?.trim() ?? '';
    const type = attachment.type;
    const name = attachment.name?.trim() ?? '';

    if (!url || !name || (type !== 'image' && type !== 'pdf')) {
      return { ok: false, error: 'Anexo incompleto ou com tipo inválido.' };
    }

    if (name.length > 255 || /[\u0000-\u001F\u007F]/.test(name)) {
      return { ok: false, error: 'Nome de anexo inválido.' };
    }

    if (
      !SUPABASE_STORAGE_ATTACHMENT_PATTERN.test(url) ||
      /(javascript:|data:|file:|blob:|\.\.)/i.test(url)
    ) {
      return { ok: false, error: 'URL de anexo deve usar o storage autorizado.' };
    }

    let urlPath = '';
    try {
      urlPath = new URL(url).pathname;
    } catch {
      return { ok: false, error: 'URL de anexo inválida.' };
    }

    if (!urlPath.startsWith(requiredPrefix)) {
      return { ok: false, error: 'URL de anexo deve pertencer a este grupo.' };
    }

    const objectPath = urlPath.slice(requiredPrefix.length);
    if (!objectPath || objectPath.includes('/')) {
      return { ok: false, error: 'Caminho de anexo inválido para este grupo.' };
    }

    validated.push({ url, type, name });
  }

  return { ok: true, value: validated };
}
