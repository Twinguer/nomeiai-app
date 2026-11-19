import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
  Section,
  Hr,
} from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'

interface ConfirmationEmailProps {
  confirmationUrl: string
  token: string
}

export const ConfirmationEmail = ({
  confirmationUrl,
  token,
}: ConfirmationEmailProps) => (
  <Html>
    <Head />
    <Preview>Confirme seu cadastro no Nomeia Aí - Rankings de Concursos</Preview>
    <Body style={main}>
      <Container style={container}>
        {/* Header com gradiente verde */}
        <Section style={header}>
          <Text style={{ margin: 0 }}>
            <span style={logoIcon}>✓</span>
            <Heading as="h1" style={h1}>Nomeia Aí</Heading>
          </Text>
          <Text style={tagline}>Rankings de Concursos Públicos</Text>
        </Section>

        {/* Card de conteúdo principal */}
        <Section style={contentCard}>
          <Heading as="h2" style={h2}>Bem-vindo! 🎉</Heading>
          <Text style={text}>
            Estamos muito felizes em ter você conosco! O Nomeia Aí é a plataforma perfeita para acompanhar sua classificação em rankings de concursos.
          </Text>

          <Section style={featureBox}>
            <Text style={featureText}>✓ Crie e participe de rankings</Text>
            <Text style={featureText}>✓ Compare seu desempenho</Text>
            <Text style={featureText}>✓ Acompanhe sua evolução</Text>
          </Section>

          <Text style={textMuted}>
            Para ativar sua conta e começar a usar todas as funcionalidades, confirme seu e-mail:
          </Text>

          {/* Botão de confirmação */}
          <Section style={buttonContainer}>
            <Link href={confirmationUrl} style={button}>
              Confirmar meu e-mail ✓
            </Link>
          </Section>

          <Text style={textMuted}>Ou copie e cole este código de confirmação:</Text>
          <code style={code}>{token}</code>

          <Hr style={divider} />

          <Text style={disclaimerText}>
            Se você não criou uma conta no Nomeia Aí, ignore este e-mail.
          </Text>
        </Section>

        {/* Footer */}
        <Section style={footer}>
          <Link href="https://www.nomeiaai.com.br" style={footerLink}>
            www.nomeiaai.com.br
          </Link>
          <Text style={footerText}>Nomeia Aí - Sua classificação em rankings de concursos</Text>
          <Text style={footerTextSmall}>© 2025 Nomeia Aí. Todos os direitos reservados.</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default ConfirmationEmail

const main = {
  backgroundColor: 'hsl(152, 81%, 96%)',
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  padding: '40px 20px',
}

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '0',
  maxWidth: '600px',
  borderRadius: '12px',
  overflow: 'hidden',
  boxShadow: '0 10px 30px rgba(15, 118, 110, 0.15)',
}

const header = {
  background: 'linear-gradient(135deg, hsl(160, 84%, 39%) 0%, hsl(161, 94%, 30%) 100%)',
  padding: '48px 40px 40px',
  textAlign: 'center' as const,
}

const logoIcon = {
  display: 'inline-block',
  backgroundColor: 'rgba(255, 255, 255, 0.2)',
  borderRadius: '50%',
  width: '40px',
  height: '40px',
  lineHeight: '40px',
  marginRight: '12px',
  fontSize: '24px',
  verticalAlign: 'middle',
}

const h1 = {
  color: '#ffffff',
  fontSize: '36px',
  fontWeight: '700',
  margin: '0 0 8px',
  lineHeight: '1.2',
  textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
  display: 'inline',
}

const tagline = {
  color: 'rgba(255, 255, 255, 0.95)',
  fontSize: '16px',
  margin: '0',
  fontWeight: '500',
  letterSpacing: '0.5px',
}

const contentCard = {
  padding: '48px 40px',
  backgroundColor: '#ffffff',
}

const h2 = {
  color: 'hsl(160, 84%, 39%)',
  fontSize: '28px',
  fontWeight: '700',
  margin: '0 0 24px',
  textAlign: 'center' as const,
}

const text = {
  color: 'hsl(222.2, 84%, 4.9%)',
  fontSize: '16px',
  lineHeight: '1.8',
  margin: '0 0 20px',
}

const featureBox = {
  backgroundColor: 'hsl(152, 81%, 96%)',
  borderLeft: '4px solid hsl(160, 84%, 39%)',
  padding: '24px 28px',
  margin: '24px 0',
  borderRadius: '8px',
}

const featureText = {
  color: 'hsl(166, 84%, 21%)',
  fontSize: '15px',
  lineHeight: '2',
  margin: '0',
  fontWeight: '500',
}

const textMuted = {
  color: 'hsl(215.4, 16.3%, 46.9%)',
  fontSize: '14px',
  lineHeight: '1.6',
  margin: '24px 0 12px',
  textAlign: 'center' as const,
}

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '36px 0',
}

const button = {
  background: 'linear-gradient(135deg, hsl(160, 84%, 39%) 0%, hsl(161, 94%, 30%) 100%)',
  color: '#ffffff',
  fontSize: '18px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '16px 48px',
  borderRadius: '8px',
  boxShadow: '0 4px 12px rgba(15, 118, 110, 0.3)',
}

const code = {
  display: 'inline-block',
  padding: '20px 24px',
  width: 'calc(100% - 48px)',
  backgroundColor: 'hsl(210, 40%, 98%)',
  borderRadius: '8px',
  border: '2px dashed hsl(160, 84%, 39%)',
  color: 'hsl(160, 84%, 39%)',
  fontSize: '20px',
  fontFamily: 'Monaco, Consolas, monospace',
  textAlign: 'center' as const,
  letterSpacing: '3px',
  fontWeight: '700',
}

const divider = {
  border: 'none',
  borderTop: '1px solid hsl(214.3, 31.8%, 91.4%)',
  margin: '32px 0',
}

const disclaimerText = {
  color: 'hsl(215.4, 16.3%, 46.9%)',
  fontSize: '13px',
  lineHeight: '1.5',
  margin: '32px 0 0',
  textAlign: 'center' as const,
  fontStyle: 'italic',
}

const footer = {
  backgroundColor: 'hsl(152, 81%, 96%)',
  padding: '32px 40px',
  textAlign: 'center' as const,
  borderTop: '1px solid hsl(214.3, 31.8%, 91.4%)',
}

const footerText = {
  color: 'hsl(166, 84%, 21%)',
  fontSize: '15px',
  lineHeight: '1.8',
  margin: '8px 0',
  fontWeight: '600',
}

const footerTextSmall = {
  color: 'hsl(215.4, 16.3%, 46.9%)',
  fontSize: '13px',
  lineHeight: '1.6',
  margin: '4px 0',
}

const footerLink = {
  color: 'hsl(160, 84%, 39%)',
  textDecoration: 'none',
  fontWeight: '600',
  borderBottom: '2px solid hsl(160, 84%, 39%)',
  paddingBottom: '2px',
}
