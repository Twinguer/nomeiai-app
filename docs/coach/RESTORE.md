# Restauração — refatoração Coach

Tags Git criadas após cada fase validada (build + testes + smoke).

| Tag | Fase | Conteúdo |
|-----|------|----------|
| `restore/refactor-coach-modular-c1` | C1 | Domínio + tipos (pendente tag) |
| `restore/refactor-coach-modular-c2` | C2 | Services facade (pendente tag) |
| `restore/refactor-coach-modular-c3` | C3 | Hooks (pendente tag) |
| `restore/refactor-coach-modular-c4` | C4 | Componentes UI |
| `restore/refactor-coach-modular-c5` | C5 | Pages core |
| `restore/refactor-coach-modular-c6` | C6 | Pages aluno/convites |
| `restore/refactor-coach-modular-c7` | C7 | Wrappers Study + shell |
| `restore/refactor-coach-modular-c8` | C8 | API cross-module |
| `restore/refactor-coach-modular-complete` | C9 | Módulo fechado |

## Restaurar código

```powershell
git tag -l "restore/refactor-coach-*"
git checkout -b recovery/coach-cX restore/refactor-coach-modular-cX
```

## Smoke test completo (pós C9)

### Assinatura e acesso

- [ ] `/coach/landing` — CTA e redirect se já coach
- [ ] `/coach/subscription` — plano ativo, limites max_students
- [ ] Menu mostra Coach só com assinatura ativa

### Equipe

- [ ] `/coach/dashboard` — lista alunos, stats, remover aluno
- [ ] `/coach/invite` — convite respeita limite de vagas
- [ ] Aluno aceita convite (`/coach/invitations/:id` ou notificação + modal)
- [ ] Broadcast mensagem para todos alunos

### Aluno (Study via coach)

- [ ] `/coach/student/:token` — detalhe carrega
- [ ] Token inválido → redirect dashboard + toast
- [ ] Sem acesso RPC → mensagem deny
- [ ] Criar ciclo para aluno
- [ ] Cronograma coachMode — editar e salvar tarefa
- [ ] Disciplinas do ciclo — visualizar edital

### Cross-module

- [ ] Study Pro access reconhece coach ativo
- [ ] Planos destaca plano coach correto

## Criar novo ponto de restauração

```powershell
.\scripts\refactor\create-restore-point.ps1 -Name "coach-modular-cX" -Message "Coach fase CX"
```

## Referências

- [ROADMAP.md](./ROADMAP.md)
- [MODULE.md](./MODULE.md)
- [../refactor-estudos/RESTORE.md](../refactor-estudos/RESTORE.md) — modelo de tags
