# Restauração — refatoração rankings

Tags Git após cada fase validada (build + `npm run test:rankings`).

| Tag | Fase | Conteúdo |
|-----|------|----------|
| `restore/refactor-rankings-baseline` | Pré-modular | Antes da Fase R1 (navegação + fixes de rota) |
| `restore/refactor-rankings-phase-r1` | R1 | Domínio modular, remoção de código morto, testes de acesso |
| `restore/refactor-rankings-phase-r2` | R2 | useResultadosData, rankingRefresh, componentes Resultados |
| `restore/refactor-rankings-phase-r3` | R3 | answerKeyValidation + CriarRanking |
| `restore/refactor-rankings-phase-r4` | R4 | Testes rankingService (RPC) |
| `restore/refactor-rankings-phase-r5` | R5 | ResultadosPage + UI classificação no módulo |
| `restore/refactor-rankings-phase-r6` | R6 | rankingService + rankingCache no módulo |
| `restore/refactor-rankings-phase-r7` | R7 | CriarRankingPage + useSaveRanking + form mappers |
| `restore/refactor-rankings-phase-r8a` | R8a | CargosPage no módulo |
| `restore/refactor-rankings-phase-r8b` | R8b | ConcursoParticipationPage + ParticipationForm |
| `restore/refactor-rankings-phase-r8c` | R8c | AnswerSheet + useSaveAnswers + useLeaveRanking |
| `restore/refactor-rankings-complete` | R9 | Módulo fechado: re-exports legados e `components/resultados/` removidos |

## Restaurar código

```powershell
git tag -l "restore/refactor-rankings-*"

# Branch de recuperação
git checkout -b recovery/rankings-phase-r1 restore/refactor-rankings-phase-r1

# Reset local (CUIDADO)
git reset --hard restore/refactor-rankings-baseline
```

## Smoke test pós-deploy

- [ ] `/pre-classificacao` → card → cargos → classificação
- [ ] Perfil → Ranking (URL segura)
- [ ] Free participante vê tabela; Free externo → participar ou Pro
- [ ] Vitrine visível para todos
- [ ] Botão atualizar classificação (recálculo)
- [ ] Participar + gabarito + tipos de prova (Alternativas / Certo ou Errado)

## Criar novo ponto de restauração

```powershell
.\scripts\refactor\create-rankings-restore-point.ps1 -Name "phase-r2" -Message "Descrição"
```

## Invariantes

Ver [MODULE.md](./MODULE.md). Não misturar PR de rankings com estudos ou admin.
