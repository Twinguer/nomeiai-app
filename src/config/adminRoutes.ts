export const ADMIN_BASE_PATH = '/internal/console' as const;
export const ADMIN_LOGIN_PATH = `${ADMIN_BASE_PATH}/login` as const;

export type AdminResource = 'dashboard' | 'concursos' | 'usuarios' | 'vouchers';

export const ADMIN_RESOURCES: AdminResource[] = [
  'dashboard',
  'concursos',
  'usuarios',
  'vouchers',
];

const LEGACY_ADMIN_PREFIX = '/project/admin/man';

export function adminResourcePath(resource: AdminResource, token?: string): string {
  if (token) {
    return `${ADMIN_BASE_PATH}/${resource}/${token}`;
  }
  return `${ADMIN_BASE_PATH}/${resource}`;
}

/** Converte paths legados para o novo console (preserva recurso e token). */
export function mapLegacyAdminPath(pathname: string): string | null {
  if (!pathname.startsWith(LEGACY_ADMIN_PREFIX)) {
    return null;
  }

  const rest = pathname.slice(LEGACY_ADMIN_PREFIX.length);

  if (rest === '' || rest === '/') {
    return adminResourcePath('dashboard');
  }

  if (rest === '/login') {
    return ADMIN_LOGIN_PATH;
  }

  return `${ADMIN_BASE_PATH}${rest}`;
}

export function isAdminConsolePath(pathname: string): boolean {
  return pathname.startsWith(ADMIN_BASE_PATH) || pathname.startsWith(LEGACY_ADMIN_PREFIX);
}
