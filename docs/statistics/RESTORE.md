# Restore — Statistics

## Tags

| Fase | Tag |
|------|-----|
| Completo (alvo) | `restore/refactor-statistics-modular-complete` |

## Smoke test

- [ ] `/estatisticas` carrega cards e gráficos
- [ ] Filtro 7d/30d altera gráficos
- [ ] Zerar estatísticas funciona
- [ ] Coach vê `PerformanceChart` no detalhe do aluno
- [ ] `npm run test:statistics` passa
- [ ] `npm run build` OK

## Rollback

```powershell
git checkout restore/refactor-statistics-modular-complete -- src/modules/statistics
```

(Após tag ST9 criada.)
