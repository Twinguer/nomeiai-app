# Módulo Payments

Modularização de **pagamentos e assinaturas**: checkout Stripe, estado Pro/Free, limites de plano, promo de lançamento e vouchers.

## Estado atual (pós P9)

| Camada | Situação |
|--------|----------|
| **Pages** | `PlanosPage` (`/planos`) |
| **Domain** | `subscriptionPlan`, `launchPromo`, `planCatalog`, `types` |
| **Services** | `paymentService` (Stripe checkout + verify) |
| **Hooks** | `useSubscription`, `usePlanLimits`, `useDiscountVoucherValidation` |
| **Components** | `LaunchPromoBanner`, `DiscountCouponSection` |
| **index.ts** | API pública completa |

**Status:** **Fechado** — P1–P9 concluídas. Tag alvo: `restore/refactor-payments-modular-complete`.

## API pública (`@/modules/payments`)

### Pages
- `PlanosPage` — `/planos`

### Hooks
- `useSubscription` — estado Pro, vouchers, promo
- `usePlanLimits` — limites via RPC `get_user_plan_limits`
- `useDiscountVoucherValidation` — cupom de desconto reutilizável

### Services
- `paymentService.createCheckout`, `paymentService.verifySubscription`

### Domain
- `resolveIsPro`, `PLAN_LEVELS`, `PRO_PLAN_CATALOG`, `LAUNCH_PROMO_COPY`

### Cross-module
- Coach usa `paymentService` + `DiscountCouponSection` em `CoachSubscriptionPage`
- Rankings, Study, Community, Profile consomem `useSubscription` / `usePlanLimits`

## Testes

```powershell
npm run test:payments
```

## Referências

- [ROADMAP.md](./ROADMAP.md)
- [RESTORE.md](./RESTORE.md)
- [PAYMENT_SYSTEM.md](../PAYMENT_SYSTEM.md)
