import React from 'npm:react@18.3.1'
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0'
import { Resend } from 'npm:resend@4.0.0'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { PasswordResetEmail } from './_templates/password-reset-email.tsx'

// Verificar RESEND_API_KEY antes de criar instância
// Não criar instância se não houver chave para evitar erros
let resend: Resend | null = null
const resendApiKey = Deno.env.get('RESEND_API_KEY')
if (resendApiKey) {
  try {
    resend = new Resend(resendApiKey)
  } catch (error) {
    console.error('Erro ao criar instância do Resend:', error)
  }
} else {
  console.error('RESEND_API_KEY não está configurada na inicialização')
}

// Função para extrair o secret corretamente
// Seguindo a documentação oficial do Supabase:
// O secret vem como "v1,whsec_<base64>" mas a biblioteca standardwebhooks
// espera apenas a parte base64 (sem "v1,whsec_")
function getHookSecret(): string {
  const rawSecret = Deno.env.get('SEND_EMAIL_HOOK_SECRET') as string || ''
  
  if (!rawSecret) {
    console.error('SEND_EMAIL_HOOK_SECRET não está configurado')
    return ''
  }
  
  // Seguindo exatamente a documentação: remover "v1,whsec_" completamente
  // Isso deixa apenas a parte base64 que a biblioteca precisa
  let hookSecret = rawSecret
  
  // Se tiver o prefixo v1,whsec_, remover
  if (hookSecret.startsWith('v1,whsec_')) {
    hookSecret = hookSecret.replace('v1,whsec_', '')
  }
  // Se tiver apenas whsec_, remover também (caso já tenha sido processado)
  else if (hookSecret.startsWith('whsec_')) {
    hookSecret = hookSecret.replace('whsec_', '')
  }
  
  return hookSecret
}

Deno.serve(async (req) => {
  // Wrapper para capturar TODOS os erros, incluindo erros de inicialização
  try {
    if (req.method !== 'POST') {
      return new Response('not allowed', { status: 400 })
    }

    // IMPORTANTE: Send Email Hooks podem usar webhook signatures (standardwebhooks) E/OU Bearer tokens
    // Vamos validar ambos para garantir compatibilidade
    
    // Verificar Bearer token se presente (algumas configurações do Supabase podem exigir)
    const authHeader = req.headers.get('authorization')
    const hookAuthSecret = Deno.env.get('SEND_EMAIL_HOOK_SECRET')
    
    // Se houver header de autorização, validar Bearer token
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '')
      console.log('Bearer token recebido, validando...')
      
      // O token pode ser o secret completo (v1,whsec_...) ou apenas a parte base64
      const isValidToken = token === hookAuthSecret || 
                          token === hookAuthSecret?.replace('v1,whsec_', '') ||
                          token === hookAuthSecret?.replace('v1,whsec_', 'whsec_')
      
      if (!isValidToken && hookAuthSecret) {
        console.error('Bearer token inválido')
        console.error('Token recebido (primeiros 20 chars):', token.substring(0, 20))
        console.error('Secret esperado (primeiros 20 chars):', hookAuthSecret.substring(0, 20))
        return new Response(
          JSON.stringify({
            error: {
              http_code: 401,
              message: 'Token de autorização inválido',
            },
          }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }
      console.log('Bearer token válido')
    }

    try {
    const payload = await req.text()
    const headers = Object.fromEntries(req.headers)
    
    // Logs para debug
    console.log('Headers recebidos:', Object.keys(headers))
    console.log('Tem authorization?', !!authHeader)
    console.log('Tem svix-signature?', !!headers['svix-signature'] || !!headers['svix_id'] || !!headers['svix_timestamp'])
    console.log('Payload length:', payload.length)
    
    // Extrair o secret corretamente
    const hookSecret = getHookSecret()
    
    // Verificar se o secret está configurado
    if (!hookSecret) {
      console.error('SEND_EMAIL_HOOK_SECRET não está configurado')
      return new Response(
        JSON.stringify({ 
          error: {
            http_code: 401,
            message: 'SEND_EMAIL_HOOK_SECRET não configurado'
          }
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }
    
    console.log('Secret processado - length:', hookSecret.length)
    
    // Criar instância do Webhook conforme documentação
    let wh
    try {
      wh = new Webhook(hookSecret)
      console.log('Instância do Webhook criada com sucesso')
    } catch (webhookError) {
      console.error('Erro ao criar instância do Webhook:', webhookError)
      console.error('Secret length:', hookSecret.length)
      console.error('Secret starts with:', hookSecret.substring(0, 10))
      return new Response(
        JSON.stringify({ 
          error: {
            http_code: 401,
            message: `Erro ao criar Webhook: ${webhookError.message || 'Secret inválido'}`
          }
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }
    
    // Verificar webhook signature
    let verifiedData
    try {
      console.log('Verificando webhook signature...')
      verifiedData = wh.verify(payload, headers) as {
        user: {
          email: string
        }
        email_data: {
          token: string
          token_hash: string
          redirect_to: string
          email_action_type: string
        }
      }
      console.log('Webhook signature verificada com sucesso')
      console.log('Email action type:', verifiedData.email_data.email_action_type)
    } catch (verifyError) {
      console.error('Erro ao verificar webhook signature:', verifyError)
      console.error('Error message:', verifyError.message)
      console.error('Headers disponíveis:', Object.keys(headers))
      console.error('Payload preview:', payload.substring(0, 200))
      return new Response(
        JSON.stringify({ 
          error: {
            http_code: 401,
            message: verifyError.message || 'Falha na verificação do webhook'
          }
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }
    
    const {
      user,
      email_data: { token, token_hash, redirect_to, email_action_type },
    } = verifiedData

    // Verificar se é realmente um email de reset de senha
    if (email_action_type !== 'recovery') {
      console.log(`Ignoring email action type: ${email_action_type}`)
      // Retornar JSON vazio conforme documentação
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const siteUrl = Deno.env.get('SITE_URL') ?? 'https://www.nomeiai.com.br'
    
    console.log('Email action type:', email_action_type)
    console.log('User email:', user.email)
    console.log('Redirect to:', redirect_to)
    
    // Garantir que redirect_to seja uma URL completa válida
    let redirectUrl = redirect_to || `${siteUrl}/auth/reset-password`
    
    // Se redirect_to não começar com http:// ou https://, adicionar o protocolo
    if (redirectUrl && !redirectUrl.startsWith('http://') && !redirectUrl.startsWith('https://')) {
      // Se começar com www., adicionar https://
      if (redirectUrl.startsWith('www.')) {
        redirectUrl = `https://${redirectUrl}`
      } else {
        // Caso contrário, usar siteUrl como base
        redirectUrl = `${siteUrl}${redirectUrl.startsWith('/') ? '' : '/'}${redirectUrl}`
      }
    }
    
    // Garantir que tenha o caminho completo
    if (!redirectUrl.includes('/auth/reset-password')) {
      redirectUrl = `${siteUrl}/auth/reset-password`
    }
    
    console.log('Password reset redirect URL:', redirectUrl)
    
    // Construir URL de reset - o Supabase processa o token e redireciona
    const resetUrl = `${supabaseUrl}/auth/v1/verify?token_hash=${token_hash}&type=recovery&redirect_to=${encodeURIComponent(redirectUrl)}`

    // Renderizar template HTML
    let html: string
    try {
      html = await renderAsync(
        React.createElement(PasswordResetEmail, {
          resetUrl,
          token,
        })
      )
      console.log('Template HTML renderizado com sucesso')
    } catch (renderError) {
      console.error('Erro ao renderizar template:', renderError)
      return new Response(
        JSON.stringify({
          error: {
            http_code: 401,
            message: `Erro ao renderizar template: ${renderError.message || 'Erro desconhecido'}`,
          },
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Verificar se RESEND_API_KEY está configurada e instância criada
    if (!resendApiKey || !resend) {
      console.error('RESEND_API_KEY não está configurada ou instância não foi criada')
      return new Response(
        JSON.stringify({
          error: {
            http_code: 401,
            message: 'RESEND_API_KEY não configurada',
          },
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    console.log('Enviando email via Resend...')
    try {
      const { error } = await resend.emails.send({
        from: 'Nomeia Aí <onboarding@resend.dev>',
        to: [user.email],
        subject: 'Redefina sua senha no Nomeia Aí',
        html,
      })

      if (error) {
        console.error('Erro ao enviar email via Resend:', error)
        return new Response(
          JSON.stringify({
            error: {
              http_code: 401,
              message: `Erro ao enviar email: ${error.message || 'Erro desconhecido'}`,
            },
          }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }
      
      console.log('Email enviado com sucesso para:', user.email)

      // Seguindo a documentação: retornar JSON vazio {} com status 200
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (resendError) {
      console.error('Exceção ao enviar email via Resend:', resendError)
      return new Response(
        JSON.stringify({
          error: {
            http_code: 401,
            message: `Exceção ao enviar email: ${resendError.message || 'Erro desconhecido'}`,
          },
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }
    } catch (error) {
      console.error('Error sending password reset email:', error)
      console.error('Error stack:', error.stack)
      console.error('Error name:', error.name)
      console.error('Error message:', error.message)
      
      // Seguindo a documentação: retornar status 401 em caso de erro
      // O Supabase espera 200 para sucesso, 401 para erro de autenticação/validação
      // IMPORTANTE: http_code também deve ser 401, não 500
      return new Response(
        JSON.stringify({
          error: {
            http_code: 401,
            message: error.message || 'Erro desconhecido ao processar reset de senha',
          },
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }
  } catch (outerError) {
    // Capturar erros que ocorrem fora do try-catch principal
    console.error('Erro crítico na Edge Function:', outerError)
    console.error('Error stack:', outerError.stack)
    console.error('Error name:', outerError.name)
    console.error('Error message:', outerError.message)
    
    return new Response(
      JSON.stringify({
        error: {
          http_code: 401,
          message: `Erro crítico: ${outerError.message || 'Erro desconhecido'}`,
        },
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
})

