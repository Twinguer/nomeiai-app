import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PoliticaDePrivacidade = () => {
  return (
    <div className="min-h-screen bg-page-background">
      <div className="container mx-auto px-4 py-8">
        <Link to="/">
          <Button variant="ghost" className="mb-6 border-0">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </Link>

        <div className="max-w-4xl mx-auto bg-card rounded-lg border p-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Política de Privacidade
          </h1>
          <p className="text-muted-foreground mb-8">
            Última atualização: {new Date().toLocaleDateString('pt-BR')}
          </p>

          <div className="space-y-6 text-foreground">
            <section>
              <h2 className="text-2xl font-semibold mb-3">1. Introdução</h2>
              <p className="text-muted-foreground leading-relaxed mb-2">
                A privacidade dos nossos usuários é fundamental para o Nomeia Aí. Esta Política de Privacidade descreve como coletamos, usamos, armazenamos e protegemos seus dados pessoais em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Ao usar nossa plataforma, você concorda com as práticas descritas nesta política.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">2. Responsável pelo Tratamento de Dados</h2>
              <p className="text-muted-foreground leading-relaxed mb-2">
                <strong>Controlador:</strong> Nomeia Aí
              </p>
              <p className="text-muted-foreground leading-relaxed mb-2">
                <strong>Email para Privacidade:</strong> contato@nomeiai.com.br
              </p>
              <p className="text-muted-foreground leading-relaxed mb-2">
                <strong>Telefone:</strong> (11) 95350-1988
              </p>
              <p className="text-muted-foreground leading-relaxed">
                <strong>Localização:</strong> São Paulo, SP - Brasil
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">3. Dados Pessoais Coletados</h2>
              <p className="text-muted-foreground leading-relaxed mb-2">
                Coletamos os seguintes tipos de dados pessoais:
              </p>
              
              <h3 className="text-xl font-semibold mt-4 mb-2">3.1. Dados de Cadastro</h3>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>Nome completo</li>
                <li>Email</li>
                <li>Senha (armazenada de forma criptografada)</li>
                <li>Apelido/nickname (opcional)</li>
                <li>Foto de perfil (opcional)</li>
              </ul>

              <h3 className="text-xl font-semibold mt-4 mb-2">3.2. Dados de Uso da Plataforma</h3>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>Rankings criados e participações</li>
                <li>Respostas e pontuações em simulados</li>
                <li>Estatísticas de estudo e desempenho</li>
                <li>Cronogramas e sessões de estudo</li>
                <li>Interações na comunidade (seguidores, seguindo)</li>
                <li>Configurações de privacidade e preferências</li>
              </ul>

              <h3 className="text-xl font-semibold mt-4 mb-2">3.3. Dados Técnicos</h3>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>Endereço IP</li>
                <li>Tipo de navegador e dispositivo</li>
                <li>Sistema operacional</li>
                <li>Páginas visitadas e tempo de permanência</li>
                <li>Cookies e tecnologias similares</li>
              </ul>

              <h3 className="text-xl font-semibold mt-4 mb-2">3.4. Dados de Pagamento</h3>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>Informações de cobrança (processadas por terceiros - Stripe)</li>
                <li>Histórico de transações</li>
                <li>Status de assinatura</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-2 text-sm">
                <em>Nota: Não armazenamos dados completos de cartão de crédito. O processamento é feito por plataformas de pagamento certificadas.</em>
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">4. Finalidade do Tratamento de Dados</h2>
              <p className="text-muted-foreground leading-relaxed mb-2">
                Utilizamos seus dados pessoais para:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>Criar e gerenciar sua conta de usuário</li>
                <li>Fornecer acesso às funcionalidades da plataforma</li>
                <li>Processar e exibir rankings e classificações</li>
                <li>Calcular estatísticas de desempenho</li>
                <li>Facilitar interações na comunidade</li>
                <li>Processar pagamentos e gerenciar assinaturas</li>
                <li>Enviar notificações e comunicações importantes</li>
                <li>Melhorar e personalizar sua experiência</li>
                <li>Prevenir fraudes e garantir segurança</li>
                <li>Cumprir obrigações legais e regulatórias</li>
                <li>Realizar análises estatísticas agregadas</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">5. Base Legal para o Tratamento</h2>
              <p className="text-muted-foreground leading-relaxed mb-2">
                Processamos seus dados pessoais com base nas seguintes bases legais previstas na LGPD:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li><strong>Consentimento:</strong> Para funcionalidades opcionais e marketing</li>
                <li><strong>Execução de contrato:</strong> Para fornecer os serviços solicitados</li>
                <li><strong>Cumprimento de obrigação legal:</strong> Quando exigido por lei</li>
                <li><strong>Legítimo interesse:</strong> Para melhorias da plataforma e segurança</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">6. Compartilhamento de Dados</h2>
              <p className="text-muted-foreground leading-relaxed mb-2">
                Seus dados pessoais podem ser compartilhados nas seguintes situações:
              </p>
              
              <h3 className="text-xl font-semibold mt-4 mb-2">6.1. Com Outros Usuários</h3>
              <p className="text-muted-foreground leading-relaxed mb-2">
                Informações de perfil público (nome, apelido, foto, estatísticas) são visíveis para outros usuários conforme suas configurações de privacidade.
              </p>

              <h3 className="text-xl font-semibold mt-4 mb-2">6.2. Com Prestadores de Serviços</h3>
              <p className="text-muted-foreground leading-relaxed mb-2">
                Compartilhamos dados com terceiros que nos auxiliam a operar a plataforma:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li><strong>Supabase:</strong> Hospedagem de banco de dados e autenticação</li>
                <li><strong>Stripe:</strong> Processamento de pagamentos</li>
                <li><strong>Serviços de infraestrutura:</strong> Hospedagem e CDN</li>
              </ul>

              <h3 className="text-xl font-semibold mt-4 mb-2">6.3. Por Exigência Legal</h3>
              <p className="text-muted-foreground leading-relaxed">
                Podemos divulgar dados quando exigido por lei, ordem judicial ou autoridades competentes.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">7. Armazenamento e Segurança</h2>
              <p className="text-muted-foreground leading-relaxed mb-2">
                <strong>7.1. Localização:</strong> Seus dados são armazenados em servidores seguros, podendo estar localizados no Brasil ou no exterior (em países com nível adequado de proteção de dados).
              </p>
              <p className="text-muted-foreground leading-relaxed mb-2">
                <strong>7.2. Período de retenção:</strong> Mantemos seus dados enquanto sua conta estiver ativa ou conforme necessário para cumprir obrigações legais. Após a exclusão da conta, dados são removidos dentro de 90 dias, exceto aqueles que devem ser mantidos por exigência legal.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-2">
                <strong>7.3. Medidas de segurança implementadas:</strong>
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>Criptografia de dados em trânsito (HTTPS/TLS)</li>
                <li>Criptografia de dados sensíveis em repouso</li>
                <li>Autenticação segura e controle de acesso</li>
                <li>Monitoramento de segurança e detecção de intrusões</li>
                <li>Backups regulares e recuperação de desastres</li>
                <li>Auditorias de segurança periódicas</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">8. Direitos do Titular dos Dados (LGPD)</h2>
              <p className="text-muted-foreground leading-relaxed mb-2">
                Você tem os seguintes direitos garantidos pela LGPD:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li><strong>Confirmação e acesso:</strong> Saber se processamos seus dados e acessá-los</li>
                <li><strong>Correção:</strong> Corrigir dados incompletos, inexatos ou desatualizados</li>
                <li><strong>Anonimização, bloqueio ou eliminação:</strong> De dados desnecessários, excessivos ou tratados em desconformidade</li>
                <li><strong>Portabilidade:</strong> Receber seus dados em formato estruturado</li>
                <li><strong>Revogação do consentimento:</strong> Retirar consentimento a qualquer momento</li>
                <li><strong>Informação sobre compartilhamento:</strong> Saber com quem compartilhamos seus dados</li>
                <li><strong>Oposição:</strong> Se opor ao tratamento em certas circunstâncias</li>
                <li><strong>Revisão de decisões automatizadas:</strong> Quando aplicável</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-3">
                Para exercer seus direitos, entre em contato através do email <strong>contato@nomeiai.com.br</strong>. Responderemos sua solicitação em até 15 dias.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">9. Cookies e Tecnologias Similares</h2>
              <p className="text-muted-foreground leading-relaxed mb-2">
                Utilizamos cookies e tecnologias similares para:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>Manter você conectado à sua conta</li>
                <li>Lembrar suas preferências e configurações</li>
                <li>Analisar o uso da plataforma</li>
                <li>Personalizar conteúdo e funcionalidades</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-3">
                Você pode gerenciar cookies através das configurações do seu navegador, mas isso pode afetar algumas funcionalidades da plataforma.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">10. Privacidade de Menores</h2>
              <p className="text-muted-foreground leading-relaxed mb-2">
                Nossa plataforma é destinada a usuários com 16 anos ou mais. Menores de 16 anos devem ter autorização expressa dos responsáveis legais para criar uma conta.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Não coletamos intencionalmente dados de menores de 16 anos sem consentimento dos responsáveis. Se identificarmos tal coleta, os dados serão prontamente excluídos.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">11. Transferência Internacional de Dados</h2>
              <p className="text-muted-foreground leading-relaxed mb-2">
                Alguns de nossos prestadores de serviços podem estar localizados fora do Brasil. Nesses casos, garantimos que:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>A transferência está em conformidade com a LGPD</li>
                <li>Existem salvaguardas adequadas (cláusulas contratuais padrão)</li>
                <li>O país de destino oferece nível adequado de proteção de dados</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">12. Alterações nesta Política</h2>
              <p className="text-muted-foreground leading-relaxed mb-2">
                Podemos atualizar esta Política de Privacidade periodicamente. Quando fizermos alterações significativas:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>Atualizaremos a data de "Última atualização" no topo desta página</li>
                <li>Notificaremos você por email ou através da plataforma</li>
                <li>Em alguns casos, solicitaremos novo consentimento</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-3">
                Recomendamos revisar esta política periodicamente.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">13. Incidentes de Segurança</h2>
              <p className="text-muted-foreground leading-relaxed">
                Em caso de incidente de segurança que possa causar risco aos seus direitos e liberdades, notificaremos você e, quando aplicável, a Autoridade Nacional de Proteção de Dados (ANPD), conforme exigido pela LGPD.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">14. Contato e Dúvidas</h2>
              <p className="text-muted-foreground leading-relaxed mb-2">
                Para dúvidas sobre esta Política de Privacidade ou para exercer seus direitos:
              </p>
              <ul className="list-none text-muted-foreground space-y-1 ml-4">
                <li><strong>Email:</strong> contato@nomeiai.com.br</li>
                <li><strong>Telefone:</strong> (11) 95350-1988</li>
                <li><strong>Instagram:</strong> @nomeia.ai</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-3">
                Você também pode registrar reclamações junto à Autoridade Nacional de Proteção de Dados (ANPD) através do site <a href="https://www.gov.br/anpd" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">www.gov.br/anpd</a>.
              </p>
            </section>

            <section className="border-t pt-6 mt-8">
              <p className="text-muted-foreground text-sm leading-relaxed">
                Esta Política de Privacidade foi elaborada em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018) e com o Marco Civil da Internet (Lei nº 12.965/2014).
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PoliticaDePrivacidade;
