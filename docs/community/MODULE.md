# Módulo Community

Modularização de **Comunidade + Grupos de estudo**: descoberta de concurseiros, feed de grupos, membros, posts e solicitações de entrada.

## Estado atual (pós COM9)

| Camada | Situação |
|--------|----------|
| **Pages** | `CommunityPage`, `GroupDetailsPage` |
| **Domain** | `communityProfileRules`, `communityUserSort`, `groupVisibilityRules`, `types` |
| **Services** | `communityProfileService`, `studyGroupService`, `studyGroupMembersService`, `studyGroupPostsService` |
| **Hooks** | 5 hooks (+ derivados: `useStudyGroup`, `useCreateGroup`, etc.) |
| **Components** | `users/`, `groups/`, `shared/` |
| **index.ts** | API pública completa |

**Status:** **Fechado** — COM1–COM9 concluídas. Tag alvo: `restore/refactor-community-modular-complete`.

## API pública (`@/modules/community`)

### Pages
- `CommunityPage` — `/comunidade`
- `GroupDetailsPage` — `/grupos/:groupId`

### Hooks
- `useCommunityUsers`, `useStudyGroups`, `useStudyGroup`, `useCreateGroup`
- `useGroupMembers`, `useIsGroupMember`, `useRequestToJoin`, `useLeaveGroup`, `useUserGroups`
- `useGroupFeed`, `useCreatePost`, `useAddComment`
- `usePendingRequests`, `useRespondToRequest`, `useInviteUser`

### Components
- Users: `UserGrid`, `UserCard`, states compartilhados
- Groups: `GroupsTab`, `CoachGroupsTab`, `GroupCard`, modals, feed

### Cross-module
- Coach consome `CoachGroupsTab` e `useUserGroups` via `@/modules/community`

## Testes

```powershell
npm run test:community
```

## Referências

- [ROADMAP.md](./ROADMAP.md)
- [RESTORE.md](./RESTORE.md)
