# Roadmap — modularização Payments (P1–P9)

Tag final: `restore/refactor-payments-modular-complete`

---

## Resumo das fases

| Fase | Escopo | Status |
|------|--------|--------|
| P1 | Domínio + tipos + launchPromo + planCatalog | ✅ |
| P2 | `paymentService` (Stripe checkout/verify) | ✅ |
| P3 | Hooks `useSubscription`, `usePlanLimits` | ✅ |
| P4 | Components (`LaunchPromoBanner`, `DiscountCouponSection`) | ✅ |
| P5 | `PlanosPage` no módulo | ✅ |
| P6 | `CoachSubscriptionPage` via `@/modules/payments` | ✅ |
| P7 | Cross-module (rankings, study, community, profile) | ✅ |
| P8 | Re-exports `@deprecated` em paths legados | ✅ |
| P9 | Testes, docs, matriz | ✅ |

---

## Próximo passo

Arquitetura modular completa (6 módulos). Manutenção: remover re-exports `@deprecated` em release futuro.
