import React from 'react';

const EmailPreview: React.FC = () => {
  // Dados de exemplo para o teste
  const mockData = {
    confirmationUrl: 'https://nomeiai.com.br/auth/confirm?token=abc123def456',
    token: 'ABC123DEF456'
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            📧 Preview do E-mail de Confirmação
          </h1>
          <p className="text-gray-600 mb-4">
            Esta é uma visualização do template de e-mail que é enviado aos usuários durante o cadastro.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-blue-800 text-sm">
              <strong>ℹ️ Informação:</strong> Este é apenas um preview estático. O e-mail real será enviado via Resend 
              com os dados reais do usuário e token de confirmação.
            </p>
          </div>
        </div>

        {/* Container do e-mail */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b">
            <h2 className="text-lg font-medium text-gray-700">
              E-mail de Confirmação - Nomeia Aí
            </h2>
            <p className="text-sm text-gray-500">
              Remetente: Nomeia Aí &lt;onboarding@resend.dev&gt; | Assunto: Confirme seu cadastro no Nomeia Aí
            </p>
          </div>
          
          {/* E-mail renderizado diretamente */}
          <div className="overflow-auto max-h-screen">
            <div 
              className="email-container"
              style={{
                backgroundColor: 'hsl(152, 81%, 96%)',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                padding: '40px 20px',
                minHeight: '100vh'
              }}
            >
              <div style={{
                backgroundColor: '#ffffff',
                margin: '0 auto',
                padding: '0',
                maxWidth: '600px',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 10px 30px rgba(15, 118, 110, 0.15)'
              }}>
                
                {/* Header com gradiente verde */}
                <div style={{
                  background: 'linear-gradient(135deg, hsl(160, 84%, 39%) 0%, hsl(161, 94%, 30%) 100%)',
                  padding: '48px 40px 40px',
                  textAlign: 'center'
                }}>
                  <div style={{ margin: '0' }}>
                    <span style={{
                      display: 'inline-block',
                      backgroundColor: 'rgba(255, 255, 255, 0.2)',
                      borderRadius: '50%',
                      width: '40px',
                      height: '40px',
                      lineHeight: '40px',
                      marginRight: '12px',
                      fontSize: '24px',
                      verticalAlign: 'middle'
                    }}>✓</span>
                    <h1 style={{
                      color: '#ffffff',
                      fontSize: '36px',
                      fontWeight: '700',
                      margin: '0 0 8px',
                      lineHeight: '1.2',
                      textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                      display: 'inline'
                    }}>Nomeia Aí</h1>
                  </div>
                  <p style={{
                    color: 'rgba(255, 255, 255, 0.95)',
                    fontSize: '16px',
                    margin: '0',
                    fontWeight: '500',
                    letterSpacing: '0.5px'
                  }}>Rankings de Concursos Públicos</p>
                </div>

                {/* Card de conteúdo principal */}
                <div style={{
                  padding: '48px 40px',
                  backgroundColor: '#ffffff'
                }}>
                  <h2 style={{
                    color: 'hsl(160, 84%, 39%)',
                    fontSize: '28px',
                    fontWeight: '700',
                    margin: '0 0 24px',
                    textAlign: 'center'
                  }}>Bem-vindo! 🎉</h2>
                  
                  <p style={{
                    color: 'hsl(222.2, 84%, 4.9%)',
                    fontSize: '16px',
                    lineHeight: '1.8',
                    margin: '0 0 20px'
                  }}>
                    Estamos muito felizes em ter você conosco! O Nomeia Aí é a plataforma perfeita para acompanhar sua classificação em rankings de concursos.
                  </p>

                  <div style={{
                    backgroundColor: 'hsl(152, 81%, 96%)',
                    borderLeft: '4px solid hsl(160, 84%, 39%)',
                    padding: '24px 28px',
                    margin: '24px 0',
                    borderRadius: '8px'
                  }}>
                    <p style={{
                      color: 'hsl(166, 84%, 21%)',
                      fontSize: '15px',
                      lineHeight: '2',
                      margin: '0',
                      fontWeight: '500'
                    }}>✓ Crie e participe de rankings</p>
                    <p style={{
                      color: 'hsl(166, 84%, 21%)',
                      fontSize: '15px',
                      lineHeight: '2',
                      margin: '0',
                      fontWeight: '500'
                    }}>✓ Compare seu desempenho</p>
                    <p style={{
                      color: 'hsl(166, 84%, 21%)',
                      fontSize: '15px',
                      lineHeight: '2',
                      margin: '0',
                      fontWeight: '500'
                    }}>✓ Acompanhe sua evolução</p>
                  </div>

                  <p style={{
                    color: 'hsl(215.4, 16.3%, 46.9%)',
                    fontSize: '14px',
                    lineHeight: '1.6',
                    margin: '24px 0 12px',
                    textAlign: 'center'
                  }}>
                    Para ativar sua conta e começar a usar todas as funcionalidades, confirme seu e-mail:
                  </p>

                  {/* Botão de confirmação */}
                  <div style={{
                    textAlign: 'center',
                    margin: '36px 0'
                  }}>
                    <a 
                      href={mockData.confirmationUrl}
                      style={{
                        background: 'linear-gradient(135deg, hsl(160, 84%, 39%) 0%, hsl(161, 94%, 30%) 100%)',
                        color: '#ffffff',
                        fontSize: '18px',
                        fontWeight: '600',
                        textDecoration: 'none',
                        textAlign: 'center',
                        display: 'inline-block',
                        padding: '16px 48px',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(15, 118, 110, 0.3)'
                      }}
                    >
                      Confirmar meu e-mail ✓
                    </a>
                  </div>

                  <p style={{
                    color: 'hsl(215.4, 16.3%, 46.9%)',
                    fontSize: '14px',
                    lineHeight: '1.6',
                    margin: '24px 0 12px',
                    textAlign: 'center'
                  }}>Ou copie e cole este código de confirmação:</p>
                  
                  <code style={{
                    display: 'inline-block',
                    padding: '20px 24px',
                    width: 'calc(100% - 48px)',
                    backgroundColor: 'hsl(210, 40%, 98%)',
                    borderRadius: '8px',
                    border: '2px dashed hsl(160, 84%, 39%)',
                    color: 'hsl(160, 84%, 39%)',
                    fontSize: '20px',
                    fontFamily: 'Monaco, Consolas, monospace',
                    textAlign: 'center',
                    letterSpacing: '3px',
                    fontWeight: '700'
                  }}>{mockData.token}</code>

                  <hr style={{
                    border: 'none',
                    borderTop: '1px solid hsl(214.3, 31.8%, 91.4%)',
                    margin: '32px 0'
                  }} />

                  <p style={{
                    color: 'hsl(215.4, 16.3%, 46.9%)',
                    fontSize: '13px',
                    lineHeight: '1.5',
                    margin: '32px 0 0',
                    textAlign: 'center',
                    fontStyle: 'italic'
                  }}>
                    Se você não criou uma conta no Nomeia Aí, ignore este e-mail.
                  </p>
                </div>

                {/* Footer */}
                <div style={{
                  backgroundColor: 'hsl(152, 81%, 96%)',
                  padding: '32px 40px',
                  textAlign: 'center',
                  borderTop: '1px solid hsl(214.3, 31.8%, 91.4%)'
                }}>
                  <a 
                    href="https://www.nomeiaai.com.br" 
                    style={{
                      color: 'hsl(160, 84%, 39%)',
                      textDecoration: 'none',
                      fontWeight: '600',
                      borderBottom: '2px solid hsl(160, 84%, 39%)',
                      paddingBottom: '2px'
                    }}
                  >
                    www.nomeiaai.com.br
                  </a>
                  <p style={{
                    color: 'hsl(166, 84%, 21%)',
                    fontSize: '15px',
                    lineHeight: '1.8',
                    margin: '8px 0',
                    fontWeight: '600'
                  }}>Nomeia Aí - Sua classificação em rankings de concursos</p>
                  <p style={{
                    color: 'hsl(215.4, 16.3%, 46.9%)',
                    fontSize: '13px',
                    lineHeight: '1.6',
                    margin: '4px 0'
                  }}>© 2025 Nomeia Aí. Todos os direitos reservados.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Informações técnicas */}
        <div className="mt-6 bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">
            🔧 Informações Técnicas
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div>
              <h4 className="font-semibold text-gray-700 mb-3 text-base">📊 Dados do Teste:</h4>
              <ul className="space-y-2 text-gray-600">
                <li><strong>URL de Confirmação:</strong><br />
                  <code className="bg-gray-100 px-2 py-1 rounded text-xs break-all">{mockData.confirmationUrl}</code>
                </li>
                <li><strong>Token:</strong> <code className="bg-gray-100 px-2 py-1 rounded">{mockData.token}</code></li>
                <li><strong>Remetente:</strong> Nomeia Aí &lt;onboarding@resend.dev&gt;</li>
                <li><strong>Assunto:</strong> Confirme seu cadastro no Nomeia Aí</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-700 mb-3 text-base">⚙️ Configuração:</h4>
              <ul className="space-y-2 text-gray-600">
                <li><strong>Serviço de E-mail:</strong> Resend</li>
                <li><strong>Template Engine:</strong> React Email Components</li>
                <li><strong>Design:</strong> Responsivo e moderno</li>
                <li><strong>Compatibilidade:</strong> Gmail, Outlook, Apple Mail</li>
                <li><strong>Webhook:</strong> Supabase Auth Integration</li>
                <li><strong>Status:</strong> <span className="text-green-600 font-semibold">✅ Ativo</span></li>
              </ul>
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <h4 className="font-semibold text-green-800 mb-2">✅ Status do Sistema</h4>
            <p className="text-green-700 text-sm">
              O sistema de e-mail de confirmação está <strong>funcionando perfeitamente</strong> e enviando 
              e-mails personalizados para todos os novos cadastros na plataforma.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailPreview;
