import React from 'react';
import { Instagram, Mail, Phone, MapPin } from 'lucide-react';

const Footer = () => {
  return (
    <>
      {/* Instagram Banner */}
      <section className="bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-center md:justify-between text-white">
            <div className="mb-4 md:mb-0">
              <h3 className="text-2xl font-bold">Siga a gente no Instagram</h3>
              <p className="text-white/90">Dicas exclusivas, novidades e interações com a comunidade</p>
            </div>
            <a
              href="https://instagram.com/nomeia.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center bg-white text-pink-600 font-semibold py-2 px-6 rounded-full hover:bg-pink-100 transition duration-300"
            >
              <Instagram className="mr-2 h-5 w-5" />
              @nomeia.ai
            </a>
          </div>
        </div>
      </section>

      <footer className="bg-background text-muted-foreground">
      <div className="container mx-auto px-4 py-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Column 1: Logo */}
          <div>
            <div>
              <img 
                alt="Nomeia Aí Logo" 
                className="h-30 w-auto object-contain" 
                src="/images/footer-logo.png"
              />
            </div>
          </div>
          
          {/* Column 2: Contatos */}
          <div>
            <h3 className="text-xl font-bold text-foreground mb-4">Contatos</h3>
            <ul className="space-y-2">
              <li className="flex items-center">
                <Mail className="h-5 w-5 mr-2" />
                <span>contato@nomeiai.com.br</span>
              </li>
              
              <li className="flex items-center mt-2">
                <MapPin className="h-5 w-5 mr-2" />
                <span>São Paulo</span>
              </li>
              <li className="flex items-center mt-2">
                <Instagram className="h-5 w-5 mr-2" />
                <a href="https://instagram.com/nomeia.ai" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
                  @nomeia.ai
                </a>
              </li>
            </ul>
          </div>
          
          {/* Column 3: Suporte */}
          <div>
            <h3 className="text-xl font-bold text-foreground mb-4">Suporte</h3>
            <ul className="space-y-2">
              <li>
                <a href="/faq" className="hover:text-foreground transition-colors">FAQ</a>
              </li>
              <li>
                <a href="mailto:contato@nomeiai.com.br" className="hover:text-foreground transition-colors">Contato</a>
              </li>
              <li>
                <a href="/termos-de-uso" className="hover:text-foreground transition-colors">Termos de Uso</a>
              </li>
              <li>
                <a href="/politica-de-privacidade" className="hover:text-foreground transition-colors">Política de Privacidade</a>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="mt-6 pt-4 text-center">
          <p className="text-xs">&copy; {new Date().getFullYear()} Nomeia Aí. Todos os direitos reservados.</p>
        </div>
      </div>
      </footer>
    </>
  );
};
export default Footer;