import React, { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/config/queryClient";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Menu from "./components/Menu";
import { TimerProvider } from "./contexts/TimerContext";
import { useTimer } from "./contexts/TimerContext";
import Index from "./pages/Index";
import CargosPage from "./modules/rankings/pages/CargosPage";
import Resultado from "./pages/Resultado";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth/Auth";
import ConfirmacaoSucesso from "./pages/Auth/ConfirmacaoSucesso";
import ForgotPassword from "./pages/Auth/ForgotPassword";
import ResetPassword from "./pages/Auth/ResetPassword";
import AuthCallback from "./pages/Auth/AuthCallback";
import Notifications from "./pages/Notifications";
import { AuthProvider } from "./hooks/useAuth";
import { PresenceProvider } from "./contexts/PresenceContext";
import { ProtectedRoute } from "./components/Security/ProtectedRoute";
import { SecureConcursoRoute } from "./components/Security/SecureConcursoRoute";
import { SecureUserRoute } from "./components/Security/SecureUserRoute";
import CriarRankingPage from "./modules/rankings/pages/CriarRankingPage";
import EstudosDashboard from "./modules/study/pages/StudyDashboard";
import Cronograma from "./modules/study/pages/Cronograma";
import Timer from "./modules/study/pages/Timer";
import { StatisticsPage } from '@/modules/statistics';
import CriarCiclo from "./modules/study/pages/CriarCiclo";
import EditarCiclo from "./modules/study/pages/EditarCiclo";
import SessaoEstudos from "./modules/study/pages/SessaoEstudos";
import CicloDetalhes from "./modules/study/pages/CicloDetalhes";
import { PlanosPage } from '@/modules/payments';
import { CommunityPage, GroupDetailsPage } from '@/modules/community';
import ConcursosPage from "./pages/ConcursosPage";
import RankingsPage from "./modules/rankings/pages/RankingsPage";
import SecureStudyCycleRoute from "./components/Security/SecureStudyCycleRoute";
import CoachDashboard from "./modules/coach/pages/CoachDashboard";
import InviteStudentPage from "./modules/coach/pages/InviteStudentPage";
import CoachSubscriptionPage from "./modules/coach/pages/CoachSubscriptionPage";
import CoachLandingPage from "./modules/coach/pages/CoachLandingPage";
import AcceptInvitationPage from "./modules/coach/pages/AcceptInvitationPage";
import StudentDetailsPage from "./modules/coach/pages/StudentDetailsPage";
import CreateCycleForStudent from "./modules/coach/pages/CreateCycleForStudent";
import StudentSchedulePage from "./modules/coach/pages/StudentSchedulePage";
import StudentCycleDisciplinesPage from "./modules/coach/pages/StudentCycleDisciplinesPage";
import { useTokenCleanup } from './hooks/useTokenCleanup';
import { GoogleAdsRouteTracker } from '@/components/analytics/GoogleAdsRouteTracker';
import { ADMIN_BASE_PATH, ADMIN_LOGIN_PATH } from '@/config/adminRoutes';
// Páginas de teste removidas após migração completa
// import TestRankingsV2 from "./pages/TestRankingsV2";
// import DebugRanking from "./pages/DebugRanking";
// import TestSupabaseConnection from "./pages/TestSupabaseConnection";
import FAQ from "./pages/FAQ";
import TermosDeUso from "./pages/TermosDeUso";
import PoliticaDePrivacidade from "./pages/PoliticaDePrivacidade";
import EmailPreview from "./pages/EmailPreview";
import RecalculateScores from "./pages/RecalculateScores";
import { AdminPlatformRoute } from "./components/Security/AdminPlatformRoute";

const SecureAdminLogin = lazy(() =>
  import("./components/Admin/SecureLogin").then((m) => ({ default: m.SecureAdminLogin }))
);
const AdminLayout = lazy(() => import("./components/Admin/AdminLayout"));
const AdminProtectedRoute = lazy(() => import("./components/Admin/ProtectedRoute"));
const AdminDashboard = lazy(() => import("./pages/Admin/Dashboard"));
const ListarConcursos = lazy(() => import("./pages/Admin/ListarConcursos"));
const ListarUsuarios = lazy(() => import("./pages/Admin/ListarUsuarios"));
const VouchersManager = lazy(() => import("./pages/Admin/VouchersManager"));
const AdminTokenGate = lazy(() => import("./components/Admin/AdminTokenGate"));
const SecureAdminRoute = lazy(() => import("./components/Admin/SecureAdminRoute"));
const LegacyAdminRedirect = lazy(() => import("./components/Admin/LegacyAdminRedirect"));

const ResultadosPage = lazy(() => import("./modules/rankings/pages/ResultadosPage"));
const ConcursoParticipationPage = lazy(() => import("./modules/rankings/pages/ConcursoParticipationPage"));
const UserProfile = lazy(() => import("./pages/UserProfile"));
const PublicUserProfile = lazy(() => import("./pages/PublicUserProfile"));

function RouteChunkLoader() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}

const AppContent = () => {
  
  // Inicializar limpeza automática de tokens
  useTokenCleanup();
  
  return <>
      <div className="min-h-screen h-full w-full text-foreground bg-page-background">
      <Toaster />
      <Sonner />
      
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
                  <GoogleAdsRouteTracker />
                  <Routes>
                    <Route path={ADMIN_LOGIN_PATH} element={
                      <Suspense fallback={<RouteChunkLoader />}>
                        <SecureAdminLogin />
                      </Suspense>
                    } />
                    <Route path="/project/admin/man" element={
                      <Suspense fallback={<RouteChunkLoader />}>
                        <LegacyAdminRedirect />
                      </Suspense>
                    } />
                    <Route path="/project/admin/man/*" element={
                      <Suspense fallback={<RouteChunkLoader />}>
                        <LegacyAdminRedirect />
                      </Suspense>
                    } />
                    <Route path="/admin/*" element={<NotFound />} />
                    <Route path={ADMIN_BASE_PATH} element={
                      <Suspense fallback={<RouteChunkLoader />}>
                        <AdminProtectedRoute>
                          <AdminLayout />
                        </AdminProtectedRoute>
                      </Suspense>
                    }>
                      <Route index element={<Navigate to="dashboard" replace />} />
                      <Route path="dashboard" element={
                        <Suspense fallback={<RouteChunkLoader />}>
                          <AdminTokenGate resource="dashboard" />
                        </Suspense>
                      } />
                      <Route path="dashboard/:token" element={
                        <Suspense fallback={<RouteChunkLoader />}>
                          <SecureAdminRoute resource="dashboard">
                            <AdminDashboard />
                          </SecureAdminRoute>
                        </Suspense>
                      } />
                      <Route path="concursos" element={
                        <Suspense fallback={<RouteChunkLoader />}>
                          <AdminTokenGate resource="concursos" />
                        </Suspense>
                      } />
                      <Route path="concursos/:token" element={
                        <Suspense fallback={<RouteChunkLoader />}>
                          <SecureAdminRoute resource="concursos">
                            <ListarConcursos />
                          </SecureAdminRoute>
                        </Suspense>
                      } />
                      <Route path="usuarios" element={
                        <Suspense fallback={<RouteChunkLoader />}>
                          <AdminTokenGate resource="usuarios" />
                        </Suspense>
                      } />
                      <Route path="usuarios/:token" element={
                        <Suspense fallback={<RouteChunkLoader />}>
                          <SecureAdminRoute resource="usuarios">
                            <ListarUsuarios />
                          </SecureAdminRoute>
                        </Suspense>
                      } />
                      <Route path="vouchers" element={
                        <Suspense fallback={<RouteChunkLoader />}>
                          <AdminTokenGate resource="vouchers" />
                        </Suspense>
                      } />
                      <Route path="vouchers/:token" element={
                        <Suspense fallback={<RouteChunkLoader />}>
                          <SecureAdminRoute resource="vouchers">
                            <VouchersManager />
                          </SecureAdminRoute>
                        </Suspense>
                      } />
                    </Route>
          <Route path="/auth" element={<Auth />} />
          <Route path="/auth/confirmacao-sucesso" element={<ConfirmacaoSucesso />} />
          <Route path="/auth/forgot-password" element={<ForgotPassword />} />
          <Route path="/auth/reset-password" element={<ResetPassword />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
                    <Route path="/perfil" element={<>
                        <Menu />
                        <Suspense fallback={<RouteChunkLoader />}>
                          <UserProfile />
                        </Suspense>
                      </>} />
                     <Route path="/usuario/profile/:token" element={<>
                        <Menu />
                        <Suspense fallback={<RouteChunkLoader />}>
                          <SecureUserRoute action="profile">
                            <PublicUserProfile />
                          </SecureUserRoute>
                        </Suspense>
                      </>} />
                     {/* ✅ SEGURANÇA: Rota legada - redirecionar para versão segura */}
                     <Route path="/usuario/profile/:id" element={<Navigate to="/comunidade" replace />} />
                     {/* Rotas de followers removidas - redirecionar para comunidade */}
                     <Route path="/usuario/followers/:token" element={<Navigate to="/comunidade" replace />} />
                     <Route path="/usuario/following/:token" element={<Navigate to="/comunidade" replace />} />
                    {/* Rotas legadas - redirecionar para versão segura */}
                    <Route path="/usuario/:id" element={<Navigate to="/comunidade" replace />} />
                    <Route path="/usuario/:id/seguidores" element={<Navigate to="/comunidade" replace />} />
                    <Route path="/usuario/:id/seguindo" element={<Navigate to="/comunidade" replace />} />
                     {/* Rota de seguidores removida - redirecionar para comunidade */}
                     <Route path="/seguidores" element={<Navigate to="/comunidade" replace />} />
                     <Route path="/notificacoes" element={<>
                         <Menu />
                         <ProtectedRoute>
                           <Notifications />
                         </ProtectedRoute>
                       </>} />
                    <Route path="/" element={<>
                        <Menu />
                        <Index />
                      </>} />
                     <Route path="/comunidade" element={<>
                          <Menu />
                          <CommunityPage />
                        </>} />
                    <Route path="/concursos" element={<>
                        <Menu />
                        <ConcursosPage />
                      </>} />
                    <Route path="/grupos/:groupId" element={<>
                        <Menu />
                        <GroupDetailsPage />
                      </>} />
                    <Route path="/faq" element={<>
                        <Menu />
                        <FAQ />
                      </>} />
                    <Route path="/termos-de-uso" element={<>
                        <Menu />
                        <TermosDeUso />
                      </>} />
                    <Route path="/politica-de-privacidade" element={<>
                        <Menu />
                        <PoliticaDePrivacidade />
                      </>} />
                    <Route path="/email-preview" element={<>
                        <Menu />
                        <EmailPreview />
                      </>} />
                    <Route path="/criar-ranking" element={<>
                        <Menu />
                        <CriarRankingPage />
                      </>} />
                     <Route path="/estudos" element={<>
                         <Menu />
                         <ProtectedRoute>
                           <EstudosDashboard />
                         </ProtectedRoute>
                       </>} />
                     <Route path="/estudos/cronograma" element={<>
                         <Menu />
                         <ProtectedRoute>
                           <Cronograma />
                         </ProtectedRoute>
                       </>} />
                    <Route path="/estudos/timer" element={<>
                        <Menu />
                        <ProtectedRoute>
                          <Timer />
                        </ProtectedRoute>
                      </>} />
                     <Route path="/estatisticas" element={<>
                         <Menu />
                         <ProtectedRoute>
                           <StatisticsPage />
                         </ProtectedRoute>
                       </>} />
                     <Route path="/estudos/criar-ciclo" element={<>
                        <Menu />
                        <ProtectedRoute>
                          <CriarCiclo />
                        </ProtectedRoute>
                      </>} />
                     <Route path="/estudos/editar-ciclo/:id" element={<>
                        <Menu />
                        <ProtectedRoute>
                          <EditarCiclo />
                        </ProtectedRoute>
                      </>} />
                     {/* Rotas legadas - redirecionar para versão segura */}
                     <Route path="/estudos/ciclo/:id" element={<Navigate to="/estudos" replace />} />
                     <Route path="/estudos/sessao/:id" element={<Navigate to="/estudos" replace />} />
                     
                     {/* Rotas seguras para ciclos de estudo */}
                     <Route path="/estudos/edit/:token" element={<>
                        <Menu />
                        <ProtectedRoute>
                          <SecureStudyCycleRoute action="edit">
                            <EditarCiclo />
                          </SecureStudyCycleRoute>
                        </ProtectedRoute>
                      </>} />
                     <Route path="/estudos/view/:token" element={<>
                        <Menu />
                        <ProtectedRoute>
                          <SecureStudyCycleRoute action="view">
                            <CicloDetalhes />
                          </SecureStudyCycleRoute>
                        </ProtectedRoute>
                      </>} />
                     <Route path="/estudos/session/:token" element={<>
                        <Menu />
                        <ProtectedRoute>
                          <SecureStudyCycleRoute action="session">
                            <SessaoEstudos />
                          </SecureStudyCycleRoute>
                        </ProtectedRoute>
                      </>} />
                     <Route path="/estudos/cronograma/:token" element={<>
                        <Menu />
                        <ProtectedRoute>
                          <SecureStudyCycleRoute action="cronograma">
                            <Cronograma />
                          </SecureStudyCycleRoute>
                        </ProtectedRoute>
                      </>} />
                     <Route path="/estudos/timer/:token" element={<>
                        <Menu />
                        <ProtectedRoute>
                          <SecureStudyCycleRoute action="timer">
                            <Timer />
                          </SecureStudyCycleRoute>
                        </ProtectedRoute>
                      </>} />
                     <Route path="/estudos/estatisticas/:token" element={<>
                        <Menu />
                        <ProtectedRoute>
                          <SecureStudyCycleRoute action="estatisticas">
                            <StatisticsPage />
                          </SecureStudyCycleRoute>
                        </ProtectedRoute>
                      </>} />
                     <Route path="/pre-classificacao" element={<>
                          <Menu />
                          <RankingsPage />
                        </>} />
                     <Route path="/pre-classificacao/:id/cargos" element={<>
                          <Menu />
                          <CargosPage />
                        </>} />
                     <Route path="/planos" element={<>
                          <Menu />
                          <PlanosPage />
                        </>} />
                    {/* Rotas do Coach Mode */}
                    <Route path="/coach" element={<>
                        <Menu />
                        <CoachLandingPage />
                      </>} />
                    <Route path="/coach/landing" element={<>
                        <Menu />
                        <CoachLandingPage />
                      </>} />
                    <Route path="/coach/dashboard" element={<>
                        <Menu />
                        <ProtectedRoute>
                          <CoachDashboard />
                        </ProtectedRoute>
                      </>} />
                    <Route path="/coach/invite" element={<>
                        <Menu />
                        <ProtectedRoute>
                          <InviteStudentPage />
                        </ProtectedRoute>
                      </>} />
                    <Route path="/coach/subscription" element={<>
                        <Menu />
                        <ProtectedRoute>
                          <CoachSubscriptionPage />
                        </ProtectedRoute>
                      </>} />
                    <Route path="/coach/invitations/:invitationId" element={<>
                        <Menu />
                        <ProtectedRoute>
                          <AcceptInvitationPage />
                        </ProtectedRoute>
                      </>} />
                    <Route path="/coach/student/:studentId" element={<>
                        <Menu />
                        <ProtectedRoute>
                          <StudentDetailsPage />
                        </ProtectedRoute>
                      </>} />
                    <Route path="/coach/student/:studentId/create-cycle" element={<>
                        <Menu />
                        <ProtectedRoute>
                          <CreateCycleForStudent />
                        </ProtectedRoute>
                      </>} />
                    <Route path="/coach/student/:studentId/cycle/:cycleId/disciplinas" element={<>
                        <Menu />
                        <ProtectedRoute>
                          <StudentCycleDisciplinesPage />
                        </ProtectedRoute>
                      </>} />
                    <Route path="/coach/student/:studentId/cycle/:cycleId/schedule" element={<>
                        <Menu />
                        <ProtectedRoute>
                          <StudentSchedulePage />
                        </ProtectedRoute>
                      </>} />
                    <Route path="/resultado" element={<>
                        <Menu />
                        <Resultado />
                      </>} />
                    {/* Rotas seguras para concursos */}
                    <Route path="/concurso/resultados/:token" element={<>
                        <Menu />
                        <Suspense fallback={<RouteChunkLoader />}>
                          <SecureConcursoRoute action="resultados">
                            <ResultadosPage />
                          </SecureConcursoRoute>
                        </Suspense>
                      </>} />
                    <Route path="/concurso/participar/:token" element={<>
                        <Menu />
                        <Suspense fallback={<RouteChunkLoader />}>
                          <SecureConcursoRoute action="participar">
                            <ConcursoParticipationPage />
                          </SecureConcursoRoute>
                        </Suspense>
                      </>} />
                    <Route path="/concurso/ranking/:token" element={<>
                        <Menu />
                        <Suspense fallback={<RouteChunkLoader />}>
                          <SecureConcursoRoute action="ranking">
                            <ResultadosPage />
                          </SecureConcursoRoute>
                        </Suspense>
                      </>} />
                    <Route path="/concurso/estatisticas/:token" element={<>
                        <Menu />
                        <SecureConcursoRoute action="estatisticas">
                          <StatisticsPage />
                        </SecureConcursoRoute>
                      </>} />
                    <Route path="/concurso/historico/:token" element={<>
                        <Menu />
                        <Suspense fallback={<RouteChunkLoader />}>
                          <SecureConcursoRoute action="historico">
                            <ResultadosPage />
                          </SecureConcursoRoute>
                        </Suspense>
                      </>} />
                    {/* Rotas legadas - redirecionar para versão segura */}
                    <Route path="/ranking/:id" element={<Navigate to="/pre-classificacao" replace />} />
                    <Route path="/ranking/:id/participate" element={<Navigate to="/pre-classificacao" replace />} />
                    <Route path="/concurso/:id" element={<Navigate to="/pre-classificacao" replace />} />
                    <Route path="/concurso/:id/resultados" element={<Navigate to="/pre-classificacao" replace />} />
                    <Route path="/concurso/:id/participar" element={<Navigate to="/pre-classificacao" replace />} />
                    {/* Rotas de teste removidas após migração completa */}
                    {/* <Route path="/test-rankings-v2" element={<>
                        <Menu />
                        <TestRankingsV2 />
                      </>} /> */}
                    {/* Rota de debug removida por segurança */}
                    <Route path="/debug-ranking/:id" element={<Navigate to="/pre-classificacao" replace />} />
                    {/* <Route path="/test-supabase" element={<>
                        <Menu />
                        <TestSupabaseConnection />
                      </>} /> */}
                    <Route path="/recalculate" element={
                      <AdminPlatformRoute>
                        <Menu />
                        <RecalculateScores />
                      </AdminPlatformRoute>
                    } />
                    <Route path="*" element={<>
                        <Menu />
                        <NotFound />
                      </>} />
                  </Routes>
      </BrowserRouter>
      </div>
    </>;
};
const App = () => {
  return <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="system" storageKey="nomeia-ui-theme" attribute="class" enableSystem>
          <AuthProvider>
            <PresenceProvider>
              <TimerProvider>
                <TooltipProvider>
                  <AppContent />
                </TooltipProvider>
              </TimerProvider>
            </PresenceProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </React.StrictMode>;
};

export default App;