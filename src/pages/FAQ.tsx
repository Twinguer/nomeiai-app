import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const FAQ = () => {
  return (
    <div className="min-h-screen bg-page-background">
      <div className="container mx-auto px-4 py-8">
        <Link to="/">
          <Button variant="ghost" className="mb-6 border-0">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </Link>

        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Perguntas Frequentes (FAQ)
          </h1>
          <p className="text-muted-foreground mb-8">
            Encontre respostas para as dúvidas mais comuns sobre o Nomeia Aí
          </p>

          <Accordion type="single" collapsible className="space-y-2">
            <AccordionItem value="item-1" className="bg-card rounded-lg border px-6">
              <AccordionTrigger className="text-left">
                O que é o Nomeia Aí?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                O Nomeia Aí é uma plataforma completa para candidatos de concursos públicos que permite criar e participar de rankings simulados, acompanhar seu desempenho, conectar-se com outros concurseiros e gerenciar seus estudos de forma organizada.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2" className="bg-card rounded-lg border px-6">
              <AccordionTrigger className="text-left">
                Como criar um ranking?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Para criar um ranking, faça login na plataforma, acesse &quot;Criar Ranking&quot; e preencha as
                informações do concurso (banca, cargo, cadernos, vagas, mínimos do edital etc.). O gabarito da
                banca é opcional: se ainda não houver gabarito oficial, o ranking funciona por consenso entre os
                participantes. Quando a banca publicar o gabarito, você pode cadastrá-lo e indicar se é provisório
                ou definitivo.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3" className="bg-card rounded-lg border px-6">
              <AccordionTrigger className="text-left">
                Como participar de um ranking?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Navegue pelos rankings em &quot;Pré-Classificação&quot;, escolha o desejado e clique em &quot;Ver
                Ranking&quot;. Informe seu caderno e preencha as respostas que você marcou na prova. Mesmo sem
                gabarito da banca, você pode participar: nesse período a pontuação é calculada por consenso (a
                alternativa mais marcada pelos participantes vale como gabarito provisório).
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4" className="bg-card rounded-lg border px-6">
              <AccordionTrigger className="text-left">
                Como funciona o cálculo de pontuação?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Antes do gabarito da banca, a pontuação usa o consenso entre os participantes. Depois que o
                criador cadastra o gabarito oficial (provisório ou definitivo), o cálculo passa a usar esse
                gabarito. O sistema considera questões objetivas, pesos das disciplinas, mínimos do edital e,
                quando aplicável, notas discursivas. Em rankings com provas Cebraspe (certo ou errado), também
                aplicamos as regras específicas da banca. Quando o edital informa vagas, exibimos uma projeção
                de nota de corte na ampla concorrência (estimativa, não resultado oficial).
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-5" className="bg-card rounded-lg border px-6">
              <AccordionTrigger className="text-left">
                O que são cotas de reserva?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Cotas de reserva são vagas destinadas a grupos específicos conforme a legislação brasileira (PcD, negros, etc.). Ao participar de um ranking, você pode indicar se concorre a alguma cota, e o sistema calculará sua posição tanto na ampla concorrência quanto na cota específica.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-6" className="bg-card rounded-lg border px-6">
              <AccordionTrigger className="text-left">
                Posso editar minhas respostas depois de enviadas?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Sim, você pode editar suas respostas enquanto o ranking estiver ativo. Basta acessar o ranking novamente e atualizar suas respostas. O sistema recalculará automaticamente sua pontuação.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-7" className="bg-card rounded-lg border px-6">
              <AccordionTrigger className="text-left">
                Como funciona a área de estudos?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                A área de estudos permite criar cronogramas personalizados, registrar sessões de estudo com temporizador, acompanhar estatísticas de desempenho por matéria e organizar ciclos de estudos. É uma ferramenta completa para gerenciar sua preparação.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-8" className="bg-card rounded-lg border px-6">
              <AccordionTrigger className="text-left">
                O que é a comunidade do Nomeia Aí?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                A comunidade é um espaço para conectar-se com outros concurseiros. Você pode seguir candidatos, visualizar perfis públicos, acompanhar o progresso de outros usuários e trocar experiências sobre concursos e estudos.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-9" className="bg-card rounded-lg border px-6">
              <AccordionTrigger className="text-left">
                Meus dados estão seguros?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Sim. Utilizamos criptografia avançada e seguimos rigorosamente a Lei Geral de Proteção de Dados (LGPD). Seus dados pessoais são armazenados de forma segura e nunca são compartilhados com terceiros sem seu consentimento. Consulte nossa Política de Privacidade para mais detalhes.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-10" className="bg-card rounded-lg border px-6">
              <AccordionTrigger className="text-left">
                Como alterar configurações de privacidade?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Acesse seu perfil e vá até a aba "Informações Pessoais". Lá você pode controlar quem visualiza seu perfil, seus rankings e seu status de estudo. Você também pode configurar se deseja aparecer na comunidade ou não.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-11" className="bg-card rounded-lg border px-6">
              <AccordionTrigger className="text-left">
                Existe um aplicativo mobile?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Atualmente o Nomeia Aí é uma plataforma web responsiva, funcionando perfeitamente em navegadores mobile. Você pode adicionar o site à tela inicial do seu smartphone para acesso rápido, funcionando como um aplicativo.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-12" className="bg-card rounded-lg border px-6">
              <AccordionTrigger className="text-left">
                Como excluir minha conta?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Você pode excluir sua conta permanentemente nas configurações do seu perfil, na aba "Informações Pessoais". Atenção: essa ação é irreversível e todos os seus dados serão permanentemente apagados.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-13" className="bg-card rounded-lg border px-6">
              <AccordionTrigger className="text-left">
                Como entrar em contato com o suporte?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Você pode entrar em contato através do email contato@nomeiai.com.br, WhatsApp (11) 95350-1988 ou pelo Instagram @nomeia.ai. Nossa equipe responde em até 24 horas úteis.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-14" className="bg-card rounded-lg border px-6">
              <AccordionTrigger className="text-left">
                Os rankings são oficiais?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Não. Os rankings no Nomeia Aí são simulações criadas pela comunidade para fins de estudo e comparação. O resultado oficial do concurso sempre será divulgado pela banca organizadora. Nossa plataforma serve como ferramenta de apoio para estimar sua classificação.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-15" className="bg-card rounded-lg border px-6">
              <AccordionTrigger className="text-left">
                Qual a diferença entre planos gratuito e premium?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                O plano gratuito permite participar de rankings e usar funcionalidades básicas de estudo. O plano premium oferece recursos avançados como criação ilimitada de rankings, estatísticas detalhadas, prioridade no suporte e funcionalidades exclusivas de organização de estudos.
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <div className="mt-8 p-6 bg-card rounded-lg border">
            <h3 className="text-xl font-semibold text-foreground mb-2">
              Não encontrou sua resposta?
            </h3>
            <p className="text-muted-foreground mb-4">
              Entre em contato conosco e teremos prazer em ajudar!
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="default" className="border-0" asChild>
                <a href="mailto:contato@nomeiai.com.br">Enviar Email</a>
              </Button>
              <Button variant="outline" className="border-0" asChild>
                <a href="https://instagram.com/nomeia.ai" target="_blank" rel="noopener noreferrer">
                  Falar no Instagram
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FAQ;
