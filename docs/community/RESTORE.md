# Restauração — refatoração Community

Tags Git criadas após cada fase validada (build + testes + smoke).

| Tag | Fase | Conteúdo |
|-----|------|----------|
| `restore/refactor-community-modular-com1` | COM1 | Domínio + tipos |
| `restore/refactor-community-modular-com2` | COM2 | Services |
| `restore/refactor-community-modular-com3` | COM3 | Hooks |
| `restore/refactor-community-modular-com4` | COM4 | UI usuários |
| `restore/refactor-community-modular-com5` | COM5 | UI grupos |
| `restore/refactor-community-modular-com6` | COM6 | GroupDetailsPage |
| `restore/refactor-community-modular-com7` | COM7 | CommunityPage refatorada |
| `restore/refactor-community-modular-com8` | COM8 | CoachGroupsTab |
| `restore/refactor-community-modular-complete` | COM9 | Módulo fechado |

## Restaurar código

```powershell
git tag -l "restore/refactor-community-*"
git checkout -b recovery/community-comX restore/refactor-community-modular-comX
```

## Smoke test completo (pós COM9)

### Comunidade — usuários

- [ ] `/comunidade` — tab Concurseiros carrega cards
- [ ] Busca debounced filtra resultados
- [ ] Ordem: coach online > coach offline > pro > free
- [ ] Card coach com tema lilás (se aplicável)
- [ ] Clique abre perfil com URL segura (sem UUID exposto em prod)
- [ ] “Carregar mais” pagina resultados

### Comunidade — grupos

- [ ] Tab Grupos — listagem
- [ ] Criar grupo (respeita limite plano Free/Pro)
- [ ] Entrar em grupo público
- [ ] Pedir entrada em grupo privado
- [ ] Owner aprova/rejeita pedido

### Detalhe do grupo

- [ ] `/comunidade/grupo/:id` — feed e membros
- [ ] Criar post + comentário
- [ ] Upload capa (owner)
- [ ] Configurações do grupo
- [ ] Sair do grupo

### Integração Coach

- [ ] Dashboard coach — tab grupos (`CoachGroupsTab`)
- [ ] Coach com plano ativo cria/gerencia grupo se permitido

### Presença

- [ ] Contador “Online” reflete PresenceContext
- [ ] Badge “Estudando” quando aplicável

## Criar novo ponto de restauração

```powershell
.\scripts\refactor\create-restore-point.ps1 -Name "community-modular-comX" -Message "Community fase COMX"
```

## Referências

- [ROADMAP.md](./ROADMAP.md)
- [MODULE.md](./MODULE.md)
- [../coach/RESTORE.md](../coach/RESTORE.md)
