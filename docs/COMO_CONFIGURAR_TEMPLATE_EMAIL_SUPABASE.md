# 📧 Como Configurar Template de Email Personalizado no Supabase

## 🎯 Objetivo

Personalizar o template de email de reset de senha no Supabase para usar a logo do Nomeia Aí e ter um design profissional.

## 📋 Passo a Passo

### 1. Acessar Email Templates no Supabase

1. Acesse o **Supabase Dashboard**: https://supabase.com/dashboard/project/ppsymqrdtjyaguftracc
2. No menu lateral, vá para **Authentication** > **Email Templates**
3. Você verá uma lista de templates disponíveis

### 2. Editar o Template "Reset Password"

1. Procure pelo template **"Reset Password"** ou **"Password Recovery"**
2. Clique para editar o template

### 3. Copiar o Template HTML

1. Abra o arquivo `docs/TEMPLATE_EMAIL_RESET_SENHA_SUPABASE.html` neste projeto
2. **Copie TODO o conteúdo** do arquivo HTML
3. No Supabase Dashboard, **cole o conteúdo** no campo de template

### 4. Variáveis do Supabase

O template usa a variável `{{ .ConfirmationURL }}` que o Supabase substitui automaticamente pelo link de reset de senha.

**Importante:** Não altere `{{ .ConfirmationURL }}` - ela é obrigatória e será substituída pelo Supabase.

### 5. Salvar o Template

1. Clique em **"Save"** ou **"Update"** para salvar o template
2. O Supabase validará o template antes de salvar

## ✅ Verificações

### Logo
- A logo está configurada para carregar de: `https://www.nomeiai.com.br/images/footer-logo.png`
- Certifique-se de que a logo está acessível publicamente nesta URL

### Teste o Email

1. Solicite um reset de senha através da aplicação
2. Verifique se o email recebido tem:
   - ✅ Logo do Nomeia Aí no topo
   - ✅ Design verde com gradiente
   - ✅ Botão de reset funcional
   - ✅ Link alternativo copiável

## 🎨 Características do Template

- **Design moderno** com gradiente verde (#10b981)
- **Logo do Nomeia Aí** no header
- **Botão destacado** para reset de senha
- **Link alternativo** caso o botão não funcione
- **Responsivo** para dispositivos móveis
- **Acessível** com cores contrastantes

## 🔧 Personalização

Se quiser personalizar ainda mais:

1. **Cores**: Edite os valores hexadecimais no template (ex: `#10b981` para verde)
2. **Texto**: Modifique as mensagens conforme necessário
3. **Logo**: Altere a URL da logo se necessário

## 📝 Notas Importantes

- O template usa **HTML inline** (estilos dentro das tags) para compatibilidade com clientes de email
- A variável `{{ .ConfirmationURL }}` é **obrigatória** e será substituída pelo Supabase
- Teste sempre após fazer alterações para garantir que o email está sendo enviado corretamente

