import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronRight, Users, FileText, Trophy, Briefcase, Instagram, Mail, Phone, MapPin } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import Footer from "@/components/Footer";
const Index = () => {
  const {
    user
  } = useAuth();
  return <div className="min-h-screen bg-gradient-to-b from-background to-secondary">
      {/* Hero Section with Image */}
      <section className="relative py-20 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-primary/5 z-0"></div>
        <div style={{
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.2'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")"
      }} className="absolute inset-0 z-0 opacity-10 bg-primary"></div>

        <div className="container mx-auto relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="animate-fade-in">
              {/* Logo added above the main heading */}
              <div className="flex justify-center md:justify-start mb-8">
                <img src="/images/footer-logo.png" alt="Nomeia Aí Logo" className="h-auto max-w-[350px] md:max-w-[437px]" // Increased by 25%: 280 * 1.25 = 350, and 350 * 1.25 = 437
              />
              </div>

              <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-primary/80 text-transparent bg-clip-text">O que realmente conta para todos nós, concurseiros, é o HBC</h1>
              <p className="text-xl mb-8 text-foreground text-justify">
                Compare seus resultados em rankings pós-prova com outros concurseiros como você. Crie ciclos de estudos com cronogramas e edital verticalizado. Tenha o acompanhamento de Coach independente de plataforma para montar seu ciclo. Tudo feito por aqui. Acompanhar estatísticas por aqui está incrível!
              </p>

              <div className="flex flex-col sm:flex-row gap-4 mb-12">
                <Link to="/editais"></Link>

                {!user && <Link to="/auth">
                    <Button variant="outline" className="rounded-md text-lg w-full sm:w-auto px-8 py-6 shadow-md hover:shadow-lg transition duration-300 transform hover:-translate-y-1">
                      Criar Conta
                      <Users className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>}
              </div>
            </div>

            <div className="relative animate-fade-in hidden md:block">
              <div className="absolute top-0 right-0 w-48 h-48 rounded-full mix-blend-multiply filter blur-xl opacity-90 animate-float"></div>
              <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full mix-blend-multiply filter blur-xl opacity-90 animate-float" style={{
              animationDelay: "1s"
            }}></div>

              <img alt="Estudante se preparando para concurso" className="w-full h-auto object-cover" src="/images/img-10.png" />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section with Carousel */}
      <section className="py-20 px-4 bg-secondary/50">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">Siga pessoas com o mesmo propósito que o seu.</h2>
          <p className="text-muted-foreground text-center max-w-2xl mx-auto mb-12">
            Uma plataforma para acompanhar seus resultados. Uma comunidade para quem é concurseiro. Sabemos das
            dificuldades que enfrentamos para conseguir a nomeação.
          </p>

          <Carousel className="w-full max-w-5xl mx-auto">
            <CarouselContent>
              <CarouselItem className="md:basis-1/2 lg:basis-1/3">
                <div className="">
                  <div className="relative overflow-hidden h-40 sm:h-52">
                    <img src="/images/img-03.png" alt="Tempo TBC" className="feature-card-image group-hover:scale-105 transition-transform duration-300" loading="eager" decoding="sync" style={{
                    imageRendering: "auto"
                  }} />
                    <div className="absolute inset-0 bg-gradient-to-t from-emerald-900/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  </div>
                  <div className="p-6">
                    <div className="bg-primary/10 p-4 rounded-full w-16 h-16 flex items-center justify-center mb-4">
                      <FileText className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold text-foreground mb-2">Mantenha o foco</h3>
                    <p className="text-muted-foreground">
                      É importante que tenhamos tudo por perto, inclusive como estão os meus resultados e o dos outros
                      candidatos.
                    </p>
                  </div>
                </div>
              </CarouselItem>

              <CarouselItem className="md:basis-1/2 lg:basis-1/3">
                <div className="">
                  <div className="relative overflow-hidden h-40 sm:h-52">
                    <img src="/images/img-04.png" alt="Dia da Prova" className="feature-card-image group-hover:scale-105 transition-transform duration-300" loading="eager" decoding="sync" style={{
                    imageRendering: "auto"
                  }} />
                    <div className="absolute inset-0 bg-gradient-to-t from-emerald-900/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  </div>
                  <div className="p-6">
                    <div className="bg-primary/10 p-4 rounded-full w-16 h-16 flex items-center justify-center mb-4">
                      <Trophy className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold text-foreground mb-2">Cabeça fria</h3>
                    <p className="text-muted-foreground">
                      Com o Nomeia Aí vamos para a prova sabendo quem são os nossos concorrentes e em que nível eles
                      estão.{" "}
                    </p>
                  </div>
                </div>
              </CarouselItem>

              <CarouselItem className="md:basis-1/2 lg:basis-1/3">
                <div className="">
                  <div className="relative overflow-hidden h-40 sm:h-52">
                    <img src="/images/img-05.png" alt="Resultado" className="feature-card-image group-hover:scale-105 transition-transform duration-300" loading="eager" decoding="sync" style={{
                    imageRendering: "auto"
                  }} />
                    <div className="absolute inset-0 bg-gradient-to-t from-emerald-900/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  </div>
                  <div className="p-6">
                    <div className="bg-primary/10 p-4 rounded-full w-16 h-16 flex items-center justify-center mb-4">
                      <Briefcase className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold text-foreground mb-2">Nomeações</h3>
                    <p className="text-muted-foreground">
                      Como estamos todos aqui, acompanhe as nomeações. Veja se quem está melhor colocado assumiu o
                      cargo.
                    </p>
                  </div>
                </div>
              </CarouselItem>
            </CarouselContent>
          </Carousel>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-primary text-primary-foreground py-16 px-4 mb-0">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">Pronto para conquistar sua aprovação?</h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto">
            Junte-se a nós e vamos juntos iniciar uma comunidade onde temos o mesmo propósito: A tão sonhada nomeação
            para o cargo dos sonhos!
          </p>
        </div>
      </section>

      <Footer />
    </div>;
};
export default Index;