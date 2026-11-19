/**
 * ESTRUTURA JSONB OTIMIZADA PARA USER_RANKINGS
 * 
 * Esta estrutura foi projetada para atender perfeitamente às necessidades
 * do sistema de rankings de concursos públicos, considerando:
 * 
 * 1. Múltiplos concursos por usuário
 * 2. Diferentes tipos de prova (objetiva, subjetiva, mista)
 * 3. Sistema de cotas e reservas
 * 4. Cálculo de pontuação com pesos
 * 5. Histórico de edições e auditoria
 * 6. Performance e escalabilidade
 */

// ============================================================================
// TIPOS BASE
// ============================================================================

export type QuotaType = 'Ampla Concorrência' | 'PPP' | 'PCD' | 'Hipossuficientes' | 'Indígenas' | 'Pessoas Trans';

export type ExamType = 'Alternativas' | 'Certo ou Errado' | 'Discursiva' | 'Mista';

export type RankingStatus = 'participando' | 'classificado' | 'eliminado' | 'desclassificado';

// ============================================================================
// ESTRUTURA DE PONTUAÇÕES
// ============================================================================

export interface SubjectiveScores {
  /** Pontuação na prova discursiva */
  discursive_score: number;
  /** Pontuação no estudo de caso 1 */
  case_study_1_score: number;
  /** Pontuação no estudo de caso 2 */
  case_study_2_score: number;
  /** Pontuação no estudo de caso 3 */
  case_study_3_score: number;
  /** Pontuação em outras subjetivas */
  other_subjective_score: number;
}

export interface WeightedSubjectiveScores {
  /** Pontuação discursiva com peso aplicado */
  weighted_discursive_score: number;
  /** Pontuação estudo de caso 1 com peso */
  weighted_case_study_1_score: number;
  /** Pontuação estudo de caso 2 com peso */
  weighted_case_study_2_score: number;
  /** Pontuação estudo de caso 3 com peso */
  weighted_case_study_3_score: number;
  /** Pontuação outras subjetivas com peso */
  weighted_other_subjective_score: number;
}

export interface DisciplineScores {
  /** Pontuações por disciplina customizada */
  [disciplineType: string]: number;
}

export interface WeightedDisciplineScores {
  /** Pontuações com peso por disciplina customizada */
  [disciplineType: string]: number;
}

// ============================================================================
// ESTRUTURA DE RESPOSTAS
// ============================================================================

export interface UserAnswers {
  /** Respostas do usuário: questionNumber -> answer */
  [questionNumber: string]: string;
}

export interface AnswerMetadata {
  /** Timestamp da resposta */
  answered_at: string;
  /** Tempo gasto na questão (em segundos) */
  time_spent?: number;
  /** Se a questão foi marcada para revisão */
  flagged?: boolean;
  /** Se a questão foi pulada */
  skipped?: boolean;
}

export interface DetailedAnswers {
  /** Respostas com metadados detalhados */
  [questionNumber: string]: {
    answer: string;
    metadata: AnswerMetadata;
  };
}

// ============================================================================
// ESTRUTURA DE AUDITORIA E CONTROLE
// ============================================================================

export interface EditHistory {
  /** Timestamp da edição */
  timestamp: string;
  /** Tipo de edição */
  type: 'answer_change' | 'subjective_score' | 'booklet_change' | 'quota_change';
  /** Campo alterado */
  field: string;
  /** Valor anterior */
  previous_value: any;
  /** Novo valor */
  new_value: any;
  /** IP do usuário */
  user_ip?: string;
  /** User agent */
  user_agent?: string;
}

export interface ControlMetadata {
  /** Se a pontuação foi recalculada */
  is_score_recalculated: boolean;
  /** Histórico de edições */
  edit_history: EditHistory[];
  /** Última atualização */
  last_updated: string;
  /** Data de criação */
  created_at: string;
  /** Versão da estrutura */
  version: string;
  /** Hash de integridade dos dados */
  data_hash?: string;
}

// ============================================================================
// ESTRUTURA DE DADOS DO USUÁRIO
// ============================================================================

export interface UserRankingData {
  /** ID do concurso */
  concurso_id: string;
  /** ID do caderno selecionado */
  selected_booklet_id: string;
  /** Pontuação total */
  score: number;
  /** Contador de edições */
  edit_count: number;
  /** Se todas as questões foram respondidas */
  all_questions_answered: boolean;
  /** Tipo de reserva/cota */
  reservation_type: QuotaType;
  /** Pontuações por disciplina */
  object_scores: DisciplineScores;
  /** Pontuações subjetivas */
  subjective_scores: SubjectiveScores;
  /** Pontuações subjetivas com peso */
  weighted_subjective_scores: WeightedSubjectiveScores;
  /** Pontuações de disciplinas customizadas */
  custom_discipline_scores: DisciplineScores;
  /** Pontuações customizadas com peso */
  weighted_custom_discipline_scores: WeightedDisciplineScores;
  /** Respostas do usuário */
  answers: UserAnswers;
  /** Respostas detalhadas (opcional) */
  detailed_answers?: DetailedAnswers;
  /** Status do ranking */
  status: RankingStatus;
  /** Se está abaixo da pontuação mínima */
  below_minimum: boolean;
  /** Disciplinas com pontuação abaixo do mínimo */
  below_discipline_minimums: string[];
  /** Blocos com pontuação abaixo do mínimo */
  below_block_minimums: string[];
  /** Posição na classificação geral */
  general_position?: number;
  /** Posição na cota específica */
  quota_position?: number;
  /** Percentual de acertos */
  accuracy_percentage?: number;
  /** Tempo total gasto na prova (em segundos) */
  total_time_spent?: number;
}

// ============================================================================
// ESTRUTURA PRINCIPAL DO CONSOLIDATED_DATA
// ============================================================================

export interface ConsolidatedUserRankings {
  /** Rankings por concurso */
  rankings: {
    [rankingId: string]: UserRankingData;
  };
  /** Metadados globais */
  metadata: {
    /** Última atualização global */
    last_updated: string;
    /** Versão da estrutura */
    version: string;
    /** Total de rankings */
    total_rankings: number;
    /** Usuário proprietário */
    user_id: string;
  };
  /** Configurações do usuário */
  user_preferences?: {
    /** Notificações habilitadas */
    notifications_enabled: boolean;
    /** Tema preferido */
    preferred_theme?: string;
    /** Idioma preferido */
    preferred_language?: string;
  };
  /** Estatísticas do usuário */
  user_stats?: {
    /** Total de concursos participados */
    total_concursos: number;
    /** Total de questões respondidas */
    total_questions_answered: number;
    /** Média de acertos */
    average_accuracy: number;
    /** Melhor pontuação */
    best_score: number;
    /** Data da melhor pontuação */
    best_score_date: string;
  };
}

// ============================================================================
// ESTRUTURA DA TABELA USER_RANKINGS
// ============================================================================

export interface UserRankingsTable {
  /** ID do usuário (chave primária) */
  user_id: string;
  /** Dados consolidados em JSONB */
  consolidated_data: ConsolidatedUserRankings;
  /** Timestamp de criação */
  created_at: string;
  /** Timestamp de atualização */
  updated_at: string;
}

// ============================================================================
// UTILITÁRIOS E HELPERS
// ============================================================================

export interface RankingSummary {
  /** ID do ranking */
  ranking_id: string;
  /** ID do concurso */
  concurso_id: string;
  /** Título do concurso */
  concurso_titulo: string;
  /** Pontuação */
  score: number;
  /** Posição geral */
  position: number;
  /** Posição na cota */
  quota_position?: number;
  /** Status */
  status: RankingStatus;
  /** Tipo de reserva */
  reservation_type: QuotaType;
  /** Data da última atualização */
  last_updated: string;
}

export interface QuotaRanking {
  /** Tipo de cota */
  quota_type: QuotaType;
  /** Posição na cota */
  position: number;
  /** Total de participantes na cota */
  total_participants: number;
  /** Pontuação mínima na cota */
  min_score: number;
  /** Pontuação máxima na cota */
  max_score: number;
}

// ============================================================================
// CONSTANTES E CONFIGURAÇÕES
// ============================================================================

export const QUOTA_TYPES: QuotaType[] = [
  'Ampla Concorrência',
  'PPP',
  'PCD',
  'Hipossuficientes',
  'Indígenas',
  'Pessoas Trans'
];

export const EXAM_TYPES: ExamType[] = [
  'Alternativas',
  'Certo ou Errado',
  'Discursiva',
  'Mista'
];

export const RANKING_STATUSES: RankingStatus[] = [
  'participando',
  'classificado',
  'eliminado',
  'desclassificado'
];

// ============================================================================
// VALIDAÇÕES E SCHEMAS
// ============================================================================

export const validateQuotaType = (quota: string): quota is QuotaType => {
  return QUOTA_TYPES.includes(quota as QuotaType);
};

export const validateExamType = (examType: string): examType is ExamType => {
  return EXAM_TYPES.includes(examType as ExamType);
};

export const validateRankingStatus = (status: string): status is RankingStatus => {
  return RANKING_STATUSES.includes(status as RankingStatus);
};








