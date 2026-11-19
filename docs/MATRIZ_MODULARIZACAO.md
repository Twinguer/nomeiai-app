# Matriz de maturidade — módulos

Atualizado após **Payments P9** (modularização completa).

| Camada | Critério |
|--------|----------|
| **Pages** | Rotas implementadas dentro do módulo |
| **Domain** | Lógica de negócio pura em `domain/` |
| **Services** | Integração com API/Supabase em `services/` |
| **Hooks** | Estado e composição em `hooks/` |
| **Components** | UI específica do domínio em `components/` |
| **index.ts** | API pública exportada pelo módulo |

## Status atual

| Módulo | Pages | Domain | Services | Hooks | Components | index.ts | Status |
|--------|:-----:|:------:|:--------:|:-----:|:----------:|:--------:|--------|
| **rankings** | 5/5 | OK | OK | OK | OK | OK | **Fechado** |
| **study** | 7/7 | OK | Parcial* | OK (5) | OK | OK | **Fechado** |
| **coach** | 9/9 | OK | OK | OK (8) | OK | OK | **Fechado** |
| **community** | 2/2 | OK | OK | OK (5+) | OK | OK | **Fechado** |
| **statistics** | 1/1 | OK | OK | OK | OK | OK | **Fechado** |
| **payments** | 1/1 | OK | OK | OK | OK | OK | **Fechado** |

\* `userStudyService` (~3k linhas, JSONB compartilhado) permanece em `src/services/`.

## Resumo

| Métrica | Valor |
|---------|------:|
| Módulos | 6 |
| Fechados | **6** |
| Parciais | 0 |
| Shell | 0 |

## Tags de restore

| Módulo | Tag | Commit |
|--------|-----|--------|
| rankings | `restore/refactor-rankings-complete` | `72c8ed32` |
| study | `restore/refactor-study-modular-complete` | `0dd1f1f1` |
| coach | `restore/refactor-coach-modular-complete` | `2ac4fb19` |
| community | `restore/refactor-community-modular-complete` | `1512e25d` |
| statistics | `restore/refactor-statistics-modular-complete` | `32c43ad9` |
| payments | `restore/refactor-payments-modular-complete` | `6c29ab9a` |

## Documentação por módulo

| Módulo | MODULE | ROADMAP | RESTORE |
|--------|--------|---------|---------|
| Rankings | [MODULE.md](./rankings/MODULE.md) | [ROADMAP.md](./rankings/ROADMAP.md) | [RESTORE.md](./rankings/RESTORE.md) |
| Study | [MODULE.md](./study/MODULE.md) | [ROADMAP.md](./study/ROADMAP.md) | [refactor-estudos/RESTORE.md](./refactor-estudos/RESTORE.md) |
| Coach | [MODULE.md](./coach/MODULE.md) | [ROADMAP.md](./coach/ROADMAP.md) | [RESTORE.md](./coach/RESTORE.md) |
| Community | [MODULE.md](./community/MODULE.md) | [ROADMAP.md](./community/ROADMAP.md) | [RESTORE.md](./community/RESTORE.md) |
| Statistics | [MODULE.md](./statistics/MODULE.md) | [ROADMAP.md](./statistics/ROADMAP.md) | [RESTORE.md](./statistics/RESTORE.md) |
| Payments | [MODULE.md](./payments/MODULE.md) | [ROADMAP.md](./payments/ROADMAP.md) | [RESTORE.md](./payments/RESTORE.md) |

**Modularização completa:** todos os 6 módulos fechados.
