import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

const TermosDeUso = () => {
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
            Termos de Uso
          </h1>
          <p className="text-muted-foreground mb-8">
            Última atualização: {new Date().toLocaleDateString('pt-BR')}
          </p>

          <div className="space-y-6 text-foreground">
            <section>
              <h2 className="text-2xl font-semibold mb-3">1. Aceitação dos Termos</h2>
              <p className="text-muted-foreground leading-relaxed">
                Ao acessar e usar a plataforma Nomeia Aí, você concorda em cumprir e estar vinculado aos seguintes Termos de Uso. Se você não concordar com qualquer parte destes termos, não deverá usar nossos serviços.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">2. Descrição do Serviço</h2>
              <p className="text-muted-foreground leading-relaxed mb-2">
                O Nomeia Aí é uma plataforma online que oferece:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>Criação e participação em rankings simulados de concursos públicos</li>
                <li>Ferramentas de organização e acompanhamento de estudos</li>
                <li>Comunidade para conexão entre concurseiros</li>
                <li>Estatísticas e análises de desempenho</li>
                <li>Cronogramas e temporizadores de estudo</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">3. Cadastro e Conta de Usuário</h2>
              <p className="text-muted-foreground leading-relaxed mb-2">
                3.1. Para utilizar certas funcionalidades, você deve criar uma conta fornecendo informações verdadeiras, completas e atualizadas.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-2">
                3.2. Você é responsável por manter a confidencialidade de sua senha e por todas as atividades realizadas em sua conta.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-2">
                3.3. Você deve ter pelo menos 16 anos de idade para criar uma conta. Menores de 16 anos devem ter autorização dos responsáveis legais.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                3.4. Você concorda em notificar-nos imediatamente sobre qualquer uso não autorizado de sua conta.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">4. Uso Aceitável da Plataforma</h2>
              <p className="text-muted-foreground leading-relaxed mb-2">
                Você concorda em NÃO:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>Usar a plataforma para qualquer finalidade ilegal ou não autorizada</li>
                <li>Violar direitos de propriedade intelectual de terceiros</li>
                <li>Transmitir vírus, malware ou qualquer código malicioso</li>
                <li>Criar rankings com informações falsas ou enganosas</li>
                <li>Coletar dados de outros usuários sem consentimento</li>
                <li>Realizar engenharia reversa ou tentar acessar áreas restritas da plataforma</li>
                <li>Usar bots ou scripts automatizados sem autorização expressa</li>
                <li>Publicar conteúdo ofensivo, discriminatório ou que viole direitos de terceiros</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">5. Propriedade Intelectual</h2>
              <p className="text-muted-foreground leading-relaxed mb-2">
                5.1. Todo o conteúdo da plataforma, incluindo código, design, textos, gráficos e logos, é propriedade do Nomeia Aí ou de seus licenciadores e está protegido por leis de direitos autorais brasileiras e internacionais.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-2">
                5.2. Você mantém os direitos sobre o conteúdo que cria na plataforma (rankings, estatísticas pessoais), mas concede ao Nomeia Aí uma licença não exclusiva para usar, exibir e distribuir esse conteúdo dentro da plataforma.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                5.3. É proibida a reprodução, distribuição ou uso comercial de qualquer parte da plataforma sem autorização prévia e por escrito.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">6. Rankings e Classificações</h2>
              <p className="text-muted-foreground leading-relaxed mb-2">
                6.1. Os rankings criados na plataforma são simulações não oficiais destinadas exclusivamente para fins de estudo e comparação entre usuários.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-2">
                6.2. O Nomeia Aí não se responsabiliza pela precisão dos gabaritos inseridos por criadores de rankings ou pelas classificações resultantes.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-2">
                6.3. Os resultados oficiais dos concursos públicos são divulgados exclusivamente pelas bancas organizadoras competentes.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                6.4. Criadores de rankings são responsáveis pela veracidade e precisão das informações fornecidas.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">7. Planos e Pagamentos</h2>
              <p className="text-muted-foreground leading-relaxed mb-2">
                7.1. O Nomeia Aí oferece planos gratuitos e pagos (premium) com diferentes funcionalidades.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-2">
                7.2. Os valores dos planos pagos estão claramente indicados na página de assinatura.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-2">
                7.3. O pagamento é processado por plataformas terceiras seguras. O Nomeia Aí não armazena dados completos de cartão de crédito.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-2">
                7.4. Assinaturas são renovadas automaticamente, salvo cancelamento pelo usuário.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                7.5. Reembolsos seguem a política de 7 dias conforme o Código de Defesa do Consumidor brasileiro.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">8. Privacidade e Proteção de Dados</h2>
              <p className="text-muted-foreground leading-relaxed mb-2">
                8.1. A coleta, uso e proteção de seus dados pessoais são regidos pela nossa Política de Privacidade, em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).
              </p>
              <p className="text-muted-foreground leading-relaxed">
                8.2. Ao usar nossa plataforma, você concorda com nossa Política de Privacidade.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">9. Limitação de Responsabilidade</h2>
              <p className="text-muted-foreground leading-relaxed mb-2">
                9.1. O Nomeia Aí fornece a plataforma "como está" e "conforme disponível", sem garantias expressas ou implícitas.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-2">
                9.2. Não garantimos que a plataforma estará sempre disponível, livre de erros ou vírus.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-2">
                9.3. Não nos responsabilizamos por:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4 mb-2">
                <li>Danos decorrentes do uso ou impossibilidade de uso da plataforma</li>
                <li>Precisão de rankings e classificações criados por usuários</li>
                <li>Conteúdo gerado por terceiros na plataforma</li>
                <li>Interrupções temporárias no serviço para manutenção</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed">
                9.4. Nossa responsabilidade total está limitada ao valor pago pelo usuário nos últimos 12 meses.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">10. Suspensão e Encerramento</h2>
              <p className="text-muted-foreground leading-relaxed mb-2">
                10.1. Podemos suspender ou encerrar sua conta se você violar estes Termos de Uso.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-2">
                10.2. Você pode encerrar sua conta a qualquer momento através das configurações de perfil.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                10.3. Após o encerramento, certos dados podem ser mantidos conforme exigido por lei ou para fins legítimos de negócios.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">11. Modificações dos Termos</h2>
              <p className="text-muted-foreground leading-relaxed mb-2">
                11.1. Reservamos o direito de modificar estes Termos de Uso a qualquer momento.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-2">
                11.2. Notificaremos os usuários sobre mudanças significativas por email ou através da plataforma.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                11.3. O uso continuado da plataforma após as modificações constitui aceitação dos novos termos.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">12. Lei Aplicável e Foro</h2>
              <p className="text-muted-foreground leading-relaxed mb-2">
                12.1. Estes Termos de Uso são regidos pelas leis da República Federativa do Brasil.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-2">
                12.2. Qualquer disputa será resolvida no foro da comarca de São Paulo/SP, com exclusão de qualquer outro, por mais privilegiado que seja.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                12.3. Usuários têm direito a utilizar plataformas de resolução alternativa de conflitos, como o portal consumidor.gov.br.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">13. Contato</h2>
              <p className="text-muted-foreground leading-relaxed mb-2">
                Para questões sobre estes Termos de Uso, entre em contato:
              </p>
              <ul className="list-none text-muted-foreground space-y-1 ml-4">
                <li><strong>Email:</strong> contato@nomeiai.com.br</li>
                <li><strong>Telefone:</strong> (11) 95350-1988</li>
                <li><strong>Endereço:</strong> São Paulo, SP - Brasil</li>
              </ul>
            </section>

            <section className="border-t pt-6 mt-8">
              <p className="text-muted-foreground text-sm leading-relaxed">
                Ao utilizar o Nomeia Aí, você declara ter lido, compreendido e concordado com estes Termos de Uso.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermosDeUso;
