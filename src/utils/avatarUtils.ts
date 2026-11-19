/**
 * URL do avatar padrão do sistema (imagem "NOMEIA Aí" do usuário @nomeiai)
 */
const getSupabaseBaseUrl = (): string =>
  import.meta.env.VITE_SUPABASE_URL.replace(/\/+$/, '');

export const getPublicProfileImageUrl = (objectKey: string): string =>
  `${getSupabaseBaseUrl()}/storage/v1/object/public/profiles/${encodeURIComponent(objectKey)}`;

export const DEFAULT_AVATAR_URL = getPublicProfileImageUrl(
  'ee17d498-b633-419f-90bd-0cad82166804-1762810011516.png',
);

/**
 * Obtém a URL do avatar do usuário, usando o padrão se não existir
 * @param avatarUrl - URL do avatar existente (pode ser null ou undefined)
 * @returns URL do avatar (existente ou padrão)
 */
export const getAvatarUrl = (avatarUrl: string | null | undefined): string => {
  if (!avatarUrl) return DEFAULT_AVATAR_URL;

  try {
    const parsedUrl = new URL(avatarUrl);
    const isManagedSupabaseProfileImage =
      parsedUrl.hostname.endsWith('.supabase.co') &&
      parsedUrl.pathname.startsWith('/storage/v1/object/public/profiles/');

    if (isManagedSupabaseProfileImage) {
      return `${getSupabaseBaseUrl()}${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
    }
  } catch {
    // Preserve relative or otherwise non-URL avatar values as provided.
  }

  return avatarUrl;
};

