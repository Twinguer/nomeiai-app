# Restauração — refatoração estudos

Tags Git criadas após cada fase validada (build + testes).

| Tag / commit | Fase | Conteúdo |
|-----|------|----------|
| `restore/refactor-estudos-baseline` → `0ab4c568` | Pré-refatoração | Antes das fases 0–3 |
| `restore/refactor-estudos-complete` → `cd89bb06` | 0–3 | Higiene, testes, backfill, `studySessionService` |
| `restore/refactor-estudos-phase-4-5` → `586fc711` | 4–5 | Fatia Cronograma, redirect `/session`, botão voltar no timer |
| `restore/refactor-estudos-phase-6` → `f75b9066` | 6 | Testes `studySessionService`, espelhamento off por padrão |
| `restore/refactor-study-modular-s1` | S1 | Domínio study em `modules/study/domain/` |
| `restore/refactor-study-modular-s2` | S2 | `studySessionService` no módulo |
| `restore/refactor-study-modular-complete` → `0dd1f1f1` | S9 | Módulo study fechado; legado removido |

## Restaurar código

```powershell
# Ver tags
git tag -l "restore/refactor-estudos-*"
git tag -l "restore/refactor-study-*"

# Voltar para um ponto (cria branch de recuperação)
git checkout -b recovery/from-complete restore/refactor-estudos-complete

# Ou resetar main local (CUIDADO: descarta commits posteriores)
git reset --hard restore/refactor-estudos-baseline
```

## Restaurar dados (Fase 2)

Se o backfill causar problema:

1. Executar `supabase/scripts/rollback_study_schedule_backfill.sql` no SQL Editor (Supabase).
2. Usa a tabela `user_study_v2_migration_backup` criada pela migration.

## Smoke test pós-deploy

- [ ] Cronograma carrega tarefas
- [ ] Salvar registro manual (tempo + questões)
- [ ] Estatísticas batem com cronograma
- [ ] Excluir tarefa mantém histórico global
- [ ] Coach: cronograma e save no aluno
- [ ] Timer sugere minutos; não duplica ao salvar

## Criar novo ponto de restauração

```powershell
.\scripts\refactor\create-restore-point.ps1 -Name "phase-X" -Message "Descrição"
```
