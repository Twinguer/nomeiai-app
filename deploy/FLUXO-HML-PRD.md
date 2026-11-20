# Fluxo de código: PRD → Git → HML e futuros releases

O código-fonte deste repositório foi reconstruído a partir da versão que estava publicada em PRD em 14/11/2026. Com a URL, a chave pública do backend e a site key de PRD, o build isolado produziu os mesmos 23 assets ativos da VPS, byte a byte. O commit é a referência de código; cada ambiente fornece seus próprios valores de build.

## Ambientes

- HML: frontend no servidor local, porta 8081; API e banco HML separados, gateway em 192.168.0.241:8010.
- PRD: frontend na VPS em nomeiai.com.br; API por api.nomeiai.com.br até o Supabase/PostgreSQL local pela VPN.
- Edge Functions e migrações devem ser versionadas aqui antes de serem aplicadas. Dados e credenciais ficam fora do Git.
- O código do pagamento existe nos dois ambientes. Em HML, a ausência de URL pública de retorno e webhook impede o fluxo externo completo; não copiar as credenciais ou URLs de PRD para HML.

## Sequência para mudanças futuras

1. Criar commit no Git com código, Edge Functions e migrações. Registrar o SHA completo.
2. Fazer checkout limpo desse SHA no servidor local e compilar HML com `deploy/build-image.sh hml SHA /home/razum/supabase-nomeia-test/.env.hml-app`.
3. Publicar a imagem HML, testar login, rotas, funções e esquema. Para pagamento, validar apenas as partes que não exigem retorno externo.
4. Fazer checkout do mesmo SHA na VPS e compilar PRD com `deploy/build-image.sh prd SHA /opt/nomeiai/.env.build`.
5. Conferir o artefato, guardar o release anterior, publicar e validar HTTPS, API e fluxos principais. Registrar o SHA implantado e o rollback.

O script exige checkout limpo, SHA exato e URL de API compatível com o ambiente. Ele compila uma imagem identificada pelo commit; a troca do container é uma etapa separada, controlada pelo Compose do ambiente. Não usar `scripts/deploy-production.sh` para esta arquitetura: o script antigo pressupõe um `.env` e um deploy que não correspondem à VPS atual.
