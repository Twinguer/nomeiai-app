import { describe, expect, it } from 'vitest';
import { resolveIsPro, resolveIsProWithBackend } from '@/modules/payments';

describe('resolveIsPro', () => {
  it('retorna false sem assinatura', () => {
    expect(resolveIsPro(null)).toBe(false);
    expect(resolveIsPro(undefined)).toBe(false);
  });

  it('retorna true para Pro ativo com validade futura', () => {
    expect(
      resolveIsPro({
        id: '1',
        user_id: 'u1',
        plan: 'pro',
        is_active: true,
        expires_at: '2099-01-01T00:00:00.000Z',
        voucher_code: 'launch_promo',
      }),
    ).toBe(true);
  });

  it('retorna false para Pro expirado', () => {
    expect(
      resolveIsPro({
        id: '1',
        user_id: 'u1',
        plan: 'pro',
        is_active: true,
        expires_at: '2020-01-01T00:00:00.000Z',
        voucher_code: null,
      }),
    ).toBe(false);
  });

  it('retorna false para plano free', () => {
    expect(
      resolveIsPro({
        id: '1',
        user_id: 'u1',
        plan: 'free',
        is_active: true,
        expires_at: null,
        voucher_code: null,
      }),
    ).toBe(false);
  });

  it('retorna false quando is_active é false', () => {
    expect(
      resolveIsPro({
        id: '1',
        user_id: 'u1',
        plan: 'pro',
        is_active: false,
        expires_at: '2099-01-01T00:00:00.000Z',
        voucher_code: null,
      }),
    ).toBe(false);
  });
});

describe('resolveIsProWithBackend', () => {
  it('prioriza RPC is_user_pro=true', () => {
    expect(resolveIsProWithBackend(null, true)).toBe(true);
    expect(
      resolveIsProWithBackend(
        {
          id: '1',
          user_id: 'u1',
          plan: 'free',
          is_active: true,
          expires_at: null,
          voucher_code: null,
        },
        true,
      ),
    ).toBe(true);
  });

  it('usa assinatura local quando RPC não confirma', () => {
    expect(
      resolveIsProWithBackend(
        {
          id: '1',
          user_id: 'u1',
          plan: 'pro',
          is_active: true,
          expires_at: '2099-01-01T00:00:00.000Z',
          voucher_code: 'launch_promo',
        },
        false,
      ),
    ).toBe(true);
  });
});

describe('hasLaunchPromoProAccess', () => {
  it('concede acesso Pro na UI durante promo para usuário autenticado', async () => {
    const { hasLaunchPromoProAccess } = await import('@/modules/payments');
    expect(hasLaunchPromoProAccess('user-uuid')).toBe(true);
    expect(hasLaunchPromoProAccess(null)).toBe(false);
  });
});
