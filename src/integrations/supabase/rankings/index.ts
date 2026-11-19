
// Export all ranking-related functions
export * from './examStructure';
export * from './rankingQueries';
// Use named import/export para evitar ambiguidade
import { recalculateUserScore, getUserRankingPosition } from './rankingMutations';
export { recalculateUserScore, getUserRankingPosition };
export * from './sectionUtils';
// Usar named exports para answerManagement
import * as answerManagement from './answerManagement';
export { answerManagement };
export * from './batchOperations';
