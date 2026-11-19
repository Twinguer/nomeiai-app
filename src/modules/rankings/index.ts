/**
 * Módulo Rankings — API pública.
 *
 * Domínio (sem React): acesso, navegação, posição, refresh, gabarito.
 * UI de classificação: components/ + hooks/ dentro do módulo.
 */

export {
  canViewClassification,
  canOpenClassificationFromList,
  isParticipatingInConcurso,
  type ClassificationAccessParams,
  type ConsolidatedRankingsData,
} from './domain/rankingAccess';

export {
  openRankingFromList,
  openRankingFromProfile,
  openRankingAfterCreate,
  openSecureRankingWithFallback,
  type RankingNavigationContext,
} from './domain/rankingNavigation';

export {
  getProfileRankingStatus,
  isRankingEliminated,
  type ProfileRankingStatus,
} from './domain/rankingProfilePosition';

export {
  fetchUserRankingSummaries,
  fetchPublicProfileRankingSummaries,
  type UserRankingSummary,
} from './domain/userRankingSummaries';

export {
  refreshClassificationData,
  type RefreshClassificationResult,
} from './domain/rankingRefresh';

export {
  validateOfficialAnswerKeyCompleteness,
  fetchAndValidateOfficialAnswerKey,
  type AnswerKeyValidationResult,
} from './domain/answerKeyValidation';

export {
  createSubjectsStructure,
  createHasCotaStructure,
  ensureNumeric,
  normalizeRankingIdentity,
} from './domain/rankingFormMappers';

export { useResultadosData, type ResultadosDataOptions } from './hooks/useResultadosData';
export { useClassificationAccess } from './hooks/useClassificationAccess';
export { useSaveRanking } from './hooks/useSaveRanking';
export { useSaveAnswers } from './hooks/useSaveAnswers';
export { useLeaveRanking } from './hooks/useLeaveRanking';

export {
  fetchUserRankings,
  fetchRankingData,
  fetchRankingDisciplines,
  getAvailableReservationTypes,
  fetchRankingStats,
  calculateRankingScore,
  type Ranking,
  type RankingData,
} from './services/rankingService';

export { rankingCache } from './services/rankingCache';

export { default as RankingsPage } from './pages/RankingsPage';
export { default as ResultadosPage } from './pages/ResultadosPage';
export { default as CriarRankingPage } from './pages/CriarRankingPage';
export { default as CargosPage } from './pages/CargosPage';
export { default as ConcursoParticipationPage } from './pages/ConcursoParticipationPage';
export { ParticipationForm } from './components/participation/ParticipationForm';
export { LoadingState } from './components/classification/LoadingState';
