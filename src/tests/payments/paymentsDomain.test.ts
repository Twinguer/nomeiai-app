import { describe, expect, it } from 'vitest';
import { resolveIsPro, resolveIsProWithBackend } from '@/modules/payments/domain/subscriptionPlan';
import {
  calculateDiscountedPrice,
  formatDiscountLabel,
  formatPlanPrice,
  getPlanLevel,
  PLAN_LEVELS,
} from '@/modules/payments/domain/planCatalog';
import { hasLaunchPromoProAccess } from '@/modules/payments/domain/launchPromo';

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
});

describe('resolveIsProWithBackend', () => {
  it('prioriza RPC is_user_pro=true', () => {
    expect(resolveIsProWithBackend(null, true)).toBe(true);
  });
});

describe('planCatalog', () => {
  it('calcula desconto percentual e fixo', () => {
    expect(
      calculateDiscountedPrice(100, {
        code: 'OFF10',
        discountType: 'percentage',
        discountValue: 10,
      }),
    ).toBe(90);
    expect(
      calculateDiscountedPrice(100, {
        code: 'OFF5',
        discountType: 'fixed',
        discountValue: 5,
      }),
    ).toBe(95);
  });

  it('formata preço e label de desconto', () => {
    expect(formatPlanPrice(14.9)).toBe('14,90');
    expect(
      formatDiscountLabel({ code: 'X', discountType: 'percentage', discountValue: 20 }),
    ).toBe('20% OFF');
  });

  it('respeita hierarquia de planos', () => {
    expect(getPlanLevel('pro')).toBe(PLAN_LEVELS.pro);
    expect(getPlanLevel('coach_enterprise')).toBeGreaterThan(getPlanLevel('pro'));
  });
});

describe('hasLaunchPromoProAccess', () => {
  it('concede acesso Pro na UI durante promo para usuário autenticado', () => {
    expect(hasLaunchPromoProAccess('user-uuid')).toBe(true);
    expect(hasLaunchPromoProAccess(null)).toBe(false);
  });
});
