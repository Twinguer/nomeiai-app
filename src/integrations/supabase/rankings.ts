
// This file is kept for backward compatibility
// All functionality has been moved to dedicated modules
export * from './rankings/examStructure';
export * from './rankings/rankingQueries';
// Use named import/export para evitar ambiguidade
import { recalculateUserScore, getUserRankingPosition } from './rankings/rankingMutations';
export { recalculateUserScore, getUserRankingPosition };
export * from './rankings/sectionUtils';
// Export the answerManagement as a namespace
import * as answerManagement from './rankings/answerManagement';
export { answerManagement };
export * from './rankings/batchOperations';
