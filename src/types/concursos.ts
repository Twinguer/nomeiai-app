
// Nova estrutura JSONB completa
export interface DisciplinesStructure {
  minimum_total_score: number;
  minimum_total_score_cotas: number;
  wrong_answer_penalty?: number; // Penalidade para respostas erradas (provas C/E)
  blocks: DisciplineBlockStructure[];
}

export interface DisciplineBlockStructure {
  blockId: string;
  blockName: string;
  blockMinimumScore: number;
  blockMinimumCotas: number;
  disciplines: NestedDisciplineStructure[];
}

export interface NestedDisciplineStructure {
  id: string;
  name: string;
  type: string;
  weight: number;
  isEnabled: boolean;
  minimum_score: number;
  minimum_score_cotas: number;
  questionCount: number;
}

// Interfaces de compatibilidade (estruturas antigas)
export interface NestedDiscipline {
  id?: string;
  type: string;
  name: string;
  isEnabled: boolean;
  questionCount?: number;
  weight?: number;
  minimum_score?: number;
  minimum_score_cotas?: number;
  // Campos adicionais para compatibilidade
  blockName?: string;
  blockId?: string;
  blockWeight?: number;
  blockMinimumScore?: number;
  blockMinimumCotas?: number;
}

export interface DisciplineBlock {
  id: string;
  name: string;
  weight?: number;
  minimum_score?: number;
  minimum_score_cotas?: number;
  disciplines: NestedDiscipline[]; 
  isEnabled?: boolean;  // Para compatibilidade com código que verifica isEnabled em qualquer item
  type?: string;       // Para compatibilidade com código que verifica type em qualquer item
  questionCount?: number; // Para compatibilidade com código que verifica questionCount em qualquer item
}

export interface HasCota {
  ppp: boolean;
  pcd: boolean;
  ind: boolean;
  hip: boolean;
  tra: boolean;
  min_cota: number;
}

export interface Subjects {
  discr: boolean;
  case1: boolean;
  case2: boolean;
  case3: boolean;
  other: boolean;
  name_other: string | null;
  discr_min_score: number;
  case1_min_score: number;
  case2_min_score: number;
  case3_min_score: number;
  other_min_score: number;
  discr_min_score_cotas: number;
  case1_min_score_cotas: number;
  case2_min_score_cotas: number;
  case3_min_score_cotas: number;
  other_min_score_cotas: number;
}

export interface Concurso {
  id: string;
  titulo: string;
  orgao: string;
  banca: string;
  created_at: string | null;
  status?: string;
  created_at: string;
  updated_at: string;
  link?: string | null;
  inscritos?: number | null;
  vagas?: number | null;
  knowledgeAreas?: string[] | null;
  localidades?: string[] | null;
  status: string;
  custom_banca?: string | null;
  is_admin_created?: boolean;
  created_by_user_id?: string | null;

  // Estrutura de conhecimentos customizados (agora único modo)
  has_custom_knowledge?: boolean; // Mantemos por compatibilidade, mas sempre será true

  // Configuração de exame
  exam_type?: string;
  alternatives_count?: number;

  // Informações de trabalho
  predefined_job_title?: string | null;
  custom_job_title?: string | null;

  // Hierarquia de rankings (card geral vs card de cargo)
  parent_concurso_id?: string | null;
  is_general_card?: boolean;
  cargo?: string | null;
  is_unified?: boolean;
  state_uf?: string | null;

  // Flag de administrador
  is_admin_update?: boolean;

  // Modo vitrine (showcase) - permite visualização pública mas bloqueia novos cadastros
  is_showcase?: boolean;

  // Gabarito e ranking provisório
  gabarito_status?: 'consensus' | 'preliminary' | 'final';
  provisional_version?: number;
  recalc_pending_at?: string | null;

  // Estrutura JSONB de disciplinas (suporte a nova e antiga estrutura)
  disciplines?: DisciplinesStructure | (DisciplineBlock | NestedDiscipline)[]; // Nova estrutura ou compatibilidade
  
  // Estrutura JSONB para cotas
  has_cota?: HasCota;
  
  // Estrutura JSONB para disciplinas subjetivas
  subjects?: Subjects;

  // Manteremos por retrocompatibilidade, mas não serão mais usados ativamente
  has_basic_knowledge?: boolean;
  has_specific_knowledge_1?: boolean;
  has_specific_knowledge_2?: boolean;
  has_specific_knowledge_3?: boolean;

  basic_knowledge_questions?: number;
  specific_knowledge_1_questions?: number;
  specific_knowledge_2_questions?: number;
  specific_knowledge_3_questions?: number;

  basic_knowledge_weight?: number;
  specific_knowledge_1_weight?: number;
  specific_knowledge_2_weight?: number;
  specific_knowledge_3_weight?: number;
  custom_knowledge_questions?: number;
  custom_knowledge_weight?: number;

  
  
}

export interface ConcursoFilter {
  status?: string;
  orgao?: string;
  banca?: string;
}

export interface UserRankingDisplay {
  concursoId: string;
  concursoTitle: string;
  position: number;
  score: number;
  // Adicionar campos para scores por disciplina/bloco se a API retornar
  // Ex: customDisciplineScores: Record<string, number>;
  // Ex: blockScores: Record<string, number>;
  basic_knowledge_score?: number; // Manter por retrocompatibilidade?
  specific_knowledge_score?: number; // Manter por retrocompatibilidade?
  discursive_score?: number; // Manter
  rankingId?: string;

  // Campos para indicar se falhou algum mínimo
  belowMinimum?: boolean;
  belowBlockMinimums?: string[]; // Array de IDs de blocos que falharam o mínimo
  belowDisciplineMinimums?: string[]; // Array de tipos de disciplina que falharam o mínimo
  belowTotalMinimum?: boolean; // Para o mínimo total da prova
}

export interface RankingTableColumn {
  id: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  width?: string;
}

// SectionType mantém compatibilidade mas agora pode ser qualquer string
export type SectionType =
  | 'basic'
  | 'specific1'
  | 'specific2'
  | 'specific3'
  | 'discursive'
  | 'case_study1'
  | 'case_study2'
  | 'case_study3'
  | string;

// Função auxiliar para determinar quais seções estão habilitadas
export const getEnabledKnowledgeSections = (concurso: Concurso) => {
  const enabledSections: Record<string, boolean> = {
    useCustomKnowledge: true
  };

  if (concurso && Array.isArray(concurso)) {
    for (const item of concurso) {
      // Verificar se é um bloco (tem propriedade disciplines)
      if ('disciplines' in item && Array.isArray(item)) {
        // É um bloco
        for (const discipline of item) {
          if (discipline.isEnabled && discipline.type) {
            enabledSections[discipline.type] = true;
          }
        }
      } 
      // Verificar se é uma disciplina direta 
      else if ('isEnabled' in item && item.isEnabled && item.type) {
        enabledSections[item.type] = true;
      }
    }
  }

  // Legacy sections
  if (concurso.has_basic_knowledge) {
    enabledSections.basic = true;
  }
  if (concurso.has_specific_knowledge_1) {
    enabledSections.specific1 = true;
  }
  if (concurso.has_specific_knowledge_2) {
    enabledSections.specific2 = true;
  }
  if (concurso.has_specific_knowledge_3) {
    enabledSections.specific3 = true;
  }
  if (concurso.has_discursive) {
    enabledSections.discursive = true;
  }
  if (concurso.has_case_study_1) {
    enabledSections.case_study1 = true;
  }
  if (concurso.has_case_study_2) {
    enabledSections.case_study2 = true;
  }
  if (concurso.has_case_study_3) {
    enabledSections.case_study3 = true;
  }

  return enabledSections;
};

// Função auxiliar para verificar se um item é um bloco de disciplinas
export const isDisciplineBlock = (item: DisciplineBlock | NestedDiscipline): item is DisciplineBlock => {
  return 'disciplines' in item && Array.isArray(item.disciplines);
};

// Função auxiliar para verificar se um item é uma disciplina
export const isNestedDiscipline = (item: DisciplineBlock | NestedDiscipline): item is NestedDiscipline => {
  return 'isEnabled' in item && 'type' in item && !('disciplines' in item);
};