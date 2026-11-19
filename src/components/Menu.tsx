import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import UserMenu from './UserMenu';
import { useAuth } from '@/hooks/useAuth';
import { AdminModeAccessButton } from '@/components/Admin/AdminModeAccessButton';
import { useIsActiveCoach } from '@/modules/coach';
import { NavigationMenu, NavigationMenuItem, NavigationMenuLink, NavigationMenuList, navigationMenuTriggerStyle } from "@/components/ui/navigation-menu";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Award, Medal, Users, Menu as MenuIcon, MessageSquare, Trophy, Home, BookOpen, CreditCard, TrendingUp, GraduationCap, User, ChevronDown, ChevronRight, Briefcase } from 'lucide-react';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetTrigger } from './ui/sheet';
const Menu = () => {
  const location = useLocation();
  const pathname = location.pathname;
  const navigate = useNavigate();
  const {
    user
  } = useAuth();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isPlansSubmenuOpen, setIsPlansSubmenuOpen] = useState(false);
  const isActive = (path: string) => {
    if (path === '/' && pathname === '/') return true;
    if (path !== '/' && pathname.startsWith(path)) return true;
    return false;
  };
  const handleLinkClick = () => {
    setIsSheetOpen(false);
    setIsPlansSubmenuOpen(false);
  };

  const { subscription: coachSubscription, isLoading: isLoadingSubscription } = useIsActiveCoach({
    enabled: !!user,
  });
  const isCoachSubscribed = !!coachSubscription;

  const handleCoachClick = () => {
    if (!user) {
      navigate('/auth');
      return;
    }
    
    // Se ainda está carregando, vai para landing (será redirecionado se tiver assinatura)
    // Se tiver assinatura, vai para dashboard, senão para landing
    if (isLoadingSubscription) {
      navigate('/coach');
    } else if (isCoachSubscribed) {
      navigate('/coach/dashboard');
    } else {
      navigate('/coach');
    }
  };
  return <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* User login button - Now on the left */}
        <div className="flex items-center gap-2">
          <UserMenu />
          <AdminModeAccessButton className="hidden sm:inline-flex" />
        </div>
        
        {/* Navigation - Now on the right */}
        <div className="flex items-center gap-2">
          <NavigationMenu className="hidden md:flex">
            <NavigationMenuList className="space-x-1">
              <NavigationMenuItem>
                <NavigationMenuLink 
                  className={navigationMenuTriggerStyle()}
                  onClick={() => navigate('/')}
                >
                  <Home className="mr-2 h-4 w-4" />
                  Home
                </NavigationMenuLink>
              </NavigationMenuItem>
              
              <NavigationMenuItem>
                <NavigationMenuLink 
                  className={navigationMenuTriggerStyle()}
                  onClick={() => navigate('/concursos')}
                >
                  <Briefcase className="mr-2 h-4 w-4" />
                  Concursos
                </NavigationMenuLink>
              </NavigationMenuItem>
              
              <NavigationMenuItem>
                <NavigationMenuLink 
                  className={navigationMenuTriggerStyle()}
                  onClick={() => navigate('/pre-classificacao')}
                >
                  <Trophy className="mr-2 h-4 w-4 text-primary" />
                  Ranking
                </NavigationMenuLink>
              </NavigationMenuItem>
              
              <NavigationMenuItem>
                <NavigationMenuLink 
                  className={navigationMenuTriggerStyle()}
                  onClick={() => navigate('/estudos')}
                >
                  <BookOpen className="mr-2 h-4 w-4" />
                  Estudar
                </NavigationMenuLink>
              </NavigationMenuItem>
              
              <NavigationMenuItem>
                <NavigationMenuLink 
                  className={navigationMenuTriggerStyle()}
                  onClick={() => navigate('/estatisticas')}
                >
                  <TrendingUp className="mr-2 h-4 w-4" />
                  Estatistica
                </NavigationMenuLink>
              </NavigationMenuItem>
              
              <NavigationMenuItem>
                <NavigationMenuLink 
                  className={navigationMenuTriggerStyle()}
                  onClick={() => navigate('/comunidade')}
                >
                  <Users className="mr-2 h-4 w-4" />
                  Comunidade
                </NavigationMenuLink>
              </NavigationMenuItem>
              
              <NavigationMenuItem>
                <NavigationMenuLink 
                  className={navigationMenuTriggerStyle()}
                  onClick={handleCoachClick}
                >
                  <GraduationCap className="mr-2 h-4 w-4" />
                  Modo Coach
                </NavigationMenuLink>
              </NavigationMenuItem>
              
              <NavigationMenuItem>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className={cn(navigationMenuTriggerStyle(), "flex items-center gap-2 cursor-pointer select-none")}>
                      <CreditCard className="h-4 w-4" />
                      Planos
                      <ChevronDown className="relative top-[1px] ml-1 h-3 w-3 transition duration-200" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[200px]">
                    <DropdownMenuItem
                      className={cn(
                        "flex items-center gap-2 cursor-pointer",
                        isActive('/planos') && !isActive('/coach/subscription') ? "bg-accent" : ""
                      )}
                      onClick={() => {
                        navigate('/planos');
                      }}
                    >
                      <User className="h-4 w-4" />
                      Aluno
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className={cn(
                        "flex items-center gap-2 cursor-pointer",
                        isActive('/coach/subscription') ? "bg-accent" : ""
                      )}
                      onClick={() => {
                        navigate('/coach/subscription');
                      }}
                    >
                      <GraduationCap className="h-4 w-4" />
                      Modo Coach
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>

          <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" className="inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 md:hidden">
                <MenuIcon className="w-6 h-6" />
                <span className="sr-only">Abrir Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="pr-0 max-w-[280px]">
              <nav className="flex flex-col gap-4 px-4 pt-8">
                <Link to="/" onClick={handleLinkClick} className={cn("flex items-center text-lg font-semibold cursor-pointer select-none", isActive('/') ? "text-primary" : "text-foreground/70")}>
                  <Home className="mr-2 h-4 w-4" />
                  Home
                </Link>
                <Link to="/concursos" onClick={handleLinkClick} className={cn("flex items-center text-lg font-semibold cursor-pointer select-none", isActive('/concursos') ? "text-primary" : "text-foreground/70")}>
                  <Briefcase className="mr-2 h-4 w-4" />
                  Concursos
                </Link>
                <Link to="/pre-classificacao" onClick={handleLinkClick} className={cn("flex items-center text-lg font-semibold cursor-pointer select-none", isActive('/pre-classificacao') ? "text-primary" : "text-foreground/70")}>
                  <Trophy className="mr-2 h-4 w-4 text-primary" />
                  Ranking
                </Link>
                <Link to="/estudos" onClick={handleLinkClick} className={cn("flex items-center text-lg font-semibold cursor-pointer select-none", isActive('/estudos') ? "text-primary" : "text-foreground/70")}>
                  <BookOpen className="mr-2 h-4 w-4" />
                  Estudar
                </Link>
                <Link to="/estatisticas" onClick={handleLinkClick} className={cn("flex items-center text-lg font-semibold cursor-pointer select-none", isActive('/estatisticas') ? "text-primary" : "text-foreground/70")}>
                  <TrendingUp className="mr-2 h-4 w-4" />
                  Estatistica
                </Link>
                <Link to="/comunidade" onClick={handleLinkClick} className={cn("flex items-center text-lg font-semibold cursor-pointer select-none", isActive('/comunidade') ? "text-primary" : "text-foreground/70")}>
                  <Users className="mr-2 h-4 w-4" />
                  Comunidade
                </Link>
                <button 
                  onClick={() => {
                    handleLinkClick();
                    handleCoachClick();
                  }}
                  className={cn("flex items-center text-lg font-semibold w-full text-left cursor-pointer select-none", isActive('/coach') ? "text-primary" : "text-foreground/70")}
                >
                  <GraduationCap className="mr-2 h-4 w-4" />
                  Modo Coach
                </button>
                
                <div className="mt-2">
                  <button
                    onClick={() => setIsPlansSubmenuOpen(!isPlansSubmenuOpen)}
                    className={cn(
                      "w-full flex items-center justify-between text-lg font-semibold py-2 rounded-md transition-colors cursor-pointer select-none",
                      isActive('/planos') || isActive('/coach/subscription')
                        ? "text-primary" 
                        : "text-foreground/70 hover:text-foreground"
                    )}
                  >
                    <div className="flex items-center">
                      <CreditCard className="mr-2 h-4 w-4" />
                      Planos
                    </div>
                    {isPlansSubmenuOpen ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>
                  {isPlansSubmenuOpen && (
                    <div className="ml-4 mt-2 flex flex-col gap-2">
                      <Link 
                        to="/planos" 
                        onClick={handleLinkClick} 
                        className={cn(
                          "flex items-center text-base font-medium pl-4 py-2 rounded-md transition-colors cursor-pointer select-none",
                          isActive('/planos') && !isActive('/coach/subscription') 
                            ? "text-primary bg-accent" 
                            : "text-foreground/70 hover:text-foreground hover:bg-accent/50"
                        )}
                      >
                        <User className="mr-2 h-4 w-4" />
                        Aluno
                      </Link>
                      <Link 
                        to="/coach/subscription" 
                        onClick={handleLinkClick} 
                        className={cn(
                          "flex items-center text-base font-medium pl-4 py-2 rounded-md transition-colors cursor-pointer select-none",
                          isActive('/coach/subscription') 
                            ? "text-primary bg-accent" 
                            : "text-foreground/70 hover:text-foreground hover:bg-accent/50"
                        )}
                      >
                        <GraduationCap className="mr-2 h-4 w-4" />
                        Modo Coach
                      </Link>
                    </div>
                  )}
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>;
};
export default Menu;