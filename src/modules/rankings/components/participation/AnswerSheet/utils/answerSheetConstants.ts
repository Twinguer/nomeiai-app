import { SectionType } from '@/types/concursos';

// Constantes do AnswerSheet
export const ANSWER_SHEET_CONSTANTS = {
  // Limites e validações
  MAX_EDIT_COUNT: 3,
  MIN_SCORE: 0,
  MAX_SCORE: 100,
  
  // Configurações de loading
  STALE_TIME: 1000,
  NULLIFIED_STALE_TIME: 300000, // 5 minutos
  
  // Configurações de progresso
  PROGRESS_UPDATE_INTERVAL: 1000,
  
  // Configurações de toast
  TOAST_DURATION: {
    SUCCESS: 3000,
    ERROR: 5000,
    WARNING: 8000,
    INFO: 4000
  },
  
  // Configurações de grid
  MAX_TABS_PER_ROW: 5,
  
  // Configurações de validação
  VALIDATION_RULES: {
    REQUIRED_ANSWERS_FOR_MULTIPLE_CHOICE: true,
    ALLOW_BLANK_FOR_CERTO_ERRADO: true,
    MIN_ANSWERS_FOR_SAVE: 1
  }
} as const;

// Seções padrão
export const DEFAULT_SECTIONS: Record<string, string> = {
  basic: 'Básicas',
  specific: 'Específicas',
  discursive: 'Discursivas',
  case_study: 'Estudos de Caso'
};

// Tipos de seção válidos
export const VALID_SECTION_TYPES: SectionType[] = [
  'basic',
  'specific', 
  'discursive',
  'case_study'
];

// Configurações de exames
export const EXAM_TYPE_CONFIG = {
  'Alternativas': {
    allowBlank: false,
    requiredAnswers: true,
    options: ['A', 'B', 'C', 'D', 'E']
  },
  'Certo ou Errado': {
    allowBlank: true,
    requiredAnswers: false,
    options: ['C', 'E']
  }
} as const;

// Mensagens padrão
export const ANSWER_SHEET_MESSAGES = {
  LOADING: 'Carregando cartão de respostas...',
  SAVING: 'Salvando respostas...',
  SAVED_SUCCESS: 'Respostas salvas com sucesso! Calculando pontuação...',
  SAVE_ERROR: 'Erro ao salvar respostas',
  NO_BOOKLET: 'É necessário selecionar um caderno de prova antes de preencher o cartão de respostas.',
  NO_CONCURSO: 'ID do concurso não encontrado',
  EDIT_LIMIT_REACHED: 'Você atingiu o limite de edições permitidas',
  INCOMPLETE_ANSWERS: 'Existem questões que precisam ser respondidas',
  OFFICIAL_ANSWERS_INCOMPLETE: 'O gabarito oficial deste concurso parece estar incompleto ou não foi configurado.',
  NULLIFIED_QUESTIONS: 'Este concurso possui questões anuladas.',
  BOOKLET_CHANGED: 'Caderno alterado para {bookletName}. Respostas carregadas.',
  SCORE_VALIDATION: 'A nota deve estar entre 0 e 100.'
} as const;

// Configurações de UI
export const UI_CONFIG = {
  CARD_CLASSES: 'shadow-lg w-full h-full mx-auto p-4',
  HEADER_CLASSES: 'bg-muted/30 border-b border-border',
  CONTENT_CLASSES: 'space-y-6 pt-6',
  FOOTER_CLASSES: 'p-4 bg-muted/30 border-t border-border',
  PROGRESS_HEIGHT: 'h-2',
  BUTTON_SIZE: 'lg',
  ICON_SIZE: 'h-5 w-5',
  ALERT_ICON_SIZE: 'h-4 w-4'
} as const;

// Configurações de performance
export const PERFORMANCE_CONFIG = {
  DEBOUNCE_DELAY: 300,
  THROTTLE_DELAY: 100,
  MAX_RENDER_ITEMS: 100,
  VIRTUAL_SCROLL_THRESHOLD: 50
} as const;



