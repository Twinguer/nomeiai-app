# Restore — Payments

## Tags

| Fase | Tag |
|------|-----|
| Completo (alvo) | `restore/refactor-payments-modular-complete` |

## Smoke test

- [ ] `/planos` carrega planos Free e Pro
- [ ] Checkout Stripe redireciona (Pro)
- [ ] Retorno `?status=success` ativa assinatura
- [ ] `/coach/subscription` usa cupom de desconto
- [ ] Rankings respeita `usePlanLimits`
- [ ] `npm run test:payments` passa
- [ ] `npm run build` OK

## Rollback

```powershell
git checkout restore/refactor-payments-modular-complete -- src/modules/payments
```

(Após tag P9 criada.)
