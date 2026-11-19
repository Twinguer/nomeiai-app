import React from 'npm:react@18.3.1'
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0'
import { Resend } from 'npm:resend@4.0.0'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { ConfirmationEmail } from './_templates/confirmation-email.tsx'

const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string)

// Extrair o secret corretamente
// Seguindo a documentação oficial do Supabase:
// O secret vem como "v1,whsec_<base64>" mas a biblioteca standardwebhooks
// espera apenas a parte base64 (sem "v1,whsec_")
const rawSecret = Deno.env.get('SEND_EMAIL_HOOK_SECRET') as string || ''
const hookSecret = rawSecret.replace('v1,whsec_', '')

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('not allowed', { status: 400 })
  }

  const payload = await req.text()
  const headers = Object.fromEntries(req.headers)
  const wh = new Webhook(hookSecret)
  
  try {
    const {
      user,
      email_data: { token, token_hash, redirect_to, email_action_type },
    } = wh.verify(payload, headers) as {
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

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const siteUrl = Deno.env.get('SITE_URL') ?? 'https://nomeiai.com.br'
    const redirectUrl = redirect_to || siteUrl
    const confirmationUrl = `${supabaseUrl}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirectUrl}`

    const html = await renderAsync(
      React.createElement(ConfirmationEmail, {
        confirmationUrl,
        token,
      })
    )

    const { error } = await resend.emails.send({
      from: 'Nomeia Aí <onboarding@resend.dev>',
      to: [user.email],
      subject: 'Confirme seu cadastro no Nomeia Aí',
      html,
    })

    if (error) {
      throw error
    }

    // Seguindo a documentação: retornar JSON vazio {} com status 200
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error sending confirmation email:', error)
    return new Response(
      JSON.stringify({
        error: {
          http_code: (error as any).code || 500,
          message: error.message || 'Erro desconhecido',
        },
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
})
