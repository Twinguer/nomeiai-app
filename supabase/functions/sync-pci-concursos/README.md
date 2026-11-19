# sync-pci-concursos

Sincroniza [PCI /concursos/](https://www.pciconcursos.com.br/concursos/) → `pci_concurso_feed`.

Invocação: **painel admin** (JWT de usuário com role `admin`) ou `supabase.functions.invoke` com sessão autenticada.

## Deploy

```bash
npx supabase functions deploy sync-pci-concursos --project-ref ppsymqrdtjyaguftracc
```

`verify_jwt = true` em `supabase/config.toml`.
