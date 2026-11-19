import { Concurso, DisciplineBlock, NestedDiscipline } from '@/types/concursos';
import { extractDisciplines, getGlobalMinimumScores, debugDisciplinesStructure } from '@/utils/disciplinesStructure';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';

// Mapa para exibição amigável dos nomes das seções
export let sectionDisplayNames: Record<string, string> = {
  'basic': 'Conhecimentos Básicos',
  'specific1': 'C. Específicos 1',
  'specific2': 'C. Específicos 2',
  'specific3': 'C. Específicos 3',
  'discursive': 'Discursiva',
  'case_study1': 'Estudo de Caso 1',
  'case_study2': 'Estudo de Caso 2',
  'case_study3': 'Estudo de Caso 3'
};

// Helper function to get display name for a section
export const getSectionDisplayName = (sectionType: string): string => {
  return sectionDisplayNames[sectionType] || sectionType;
};

// Função para garantir tipo de seção válido
export const sanitizeSectionType = (sectionType: string | undefined): string => {
  if (!sectionType) return 'basic';
  
  if (
    sectionType === 'basic' || 
    sectionType === 'specific1' || 
    sectionType === 'specific2' || 
    sectionType === 'specific3' ||
    sectionType === 'discursive' ||
    sectionType === 'case_study1' ||
    sectionType === 'case_study2' ||
    sectionType === 'case_study3'
  ) {
    return sectionType;
  }
  
  // Tipos customizados são permitidos (começam com custom_)
  if (sectionType.startsWith('custom_')) {
    return sectionType;
  }
  
  // Fallback para basic por padrão
  return 'basic';
};

// Wrapper function to safely convert string/number/any to numeric value
export const getNumericValue = (value: any): number => {
  // Debug logs removed for security
  
  if (typeof value === 'number') {
    // Debug logs removed for security
    return value;
  }
  
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    const result = isNaN(parsed) ? 0 : parsed;
    // Debug logs removed for security
    return result;
  }
  
  // Debug logs removed for security
  return 0;
};

// Determinar o tipo de seção para uma questão específica
export const getSectionTypeForQuestion = (concurso: Concurso, questionNumber: number): string => {
  if (!concurso) return 'basic';

  // ✅ NOVA ESTRUTURA JSONB: usar disciplines.blocks
  if (concurso.disciplines) {
    let blocksArray = [];
    
    // Nova estrutura: objeto com blocks no nível raiz
    if (typeof concurso.disciplines === 'object' && 'blocks' in concurso.disciplines && Array.isArray(concurso.disciplines.blocks)) {
      blocksArray = concurso.disciplines.blocks;
      // Debug logs removed for security
    } 
    // Estrutura antiga: array direto de blocos (fallback)
    else if (Array.isArray(concurso.disciplines)) {
      blocksArray = concurso.disciplines;
      // Debug logs removed for security
    }
    
    if (blocksArray.length > 0) {
      let currentIndex = 1;

      // Processar estrutura hierárquica (blocos -> disciplinas)
      for (const block of blocksArray) {
        // Verificar se o item é um bloco com disciplinas
        if ('disciplines' in block && Array.isArray(block.disciplines)) {
          for (const discipline of block.disciplines) {
            if (discipline.isEnabled) {
              const questionCount = getNumericValue(discipline.questionCount);
              
              // Se a questão está nesta disciplina
              if (questionNumber >= currentIndex && questionNumber < currentIndex + questionCount) {
                return discipline.type;
              }
              
              currentIndex += questionCount;
            }
          }
        }
      }
    }
  }

  // Estrutura tradicional
  let index = 1;
  
  // Conhecimentos Básicos
  if (concurso.has_basic_knowledge && concurso.basic_knowledge_questions) {
    const basicCount = getNumericValue(concurso.basic_knowledge_questions);
    if (questionNumber >= index && questionNumber < index + basicCount) {
      return 'basic';
    }
    index += basicCount;
  }
  
  // Conhecimentos Específicos 1
  if (concurso.has_specific_knowledge_1 && concurso.specific_knowledge_1_questions) {
    const specificCount = getNumericValue(concurso.specific_knowledge_1_questions);
    if (questionNumber >= index && questionNumber < index + specificCount) {
      return 'specific1';
    }
    index += specificCount;
  }
  
  // Conhecimentos Específicos 2
  if (concurso.has_specific_knowledge_2 && concurso.specific_knowledge_2_questions) {
    const specificCount = getNumericValue(concurso.specific_knowledge_2_questions);
    if (questionNumber >= index && questionNumber < index + specificCount) {
      return 'specific2';
    }
    index += specificCount;
  }
  
  // Conhecimentos Específicos 3
  if (concurso.has_specific_knowledge_3 && concurso.specific_knowledge_3_questions) {
    const specificCount = getNumericValue(concurso.specific_knowledge_3_questions);
    if (questionNumber >= index && questionNumber < index + specificCount) {
      return 'specific3';
    }
  }
  
  // Fallback
  return 'basic';
};

/**
 * Verifica se um concurso utiliza a estrutura hierárquica (blocos -> disciplinas)
 * @param concurso O concurso a ser verificado
 * @returns true se usa estrutura hierárquica, false se usa estrutura plana
 */
export const isHierarchicalStructure = (concurso: any): boolean => {
  if (!concurso?.disciplines) return false;
  
  // ✅ Nova estrutura JSONB: objeto com blocks
  if (typeof concurso.disciplines === 'object' && 'blocks' in concurso.disciplines && Array.isArray(concurso.disciplines.blocks)) {
    const blocks = concurso.disciplines.blocks;
    const result = blocks.length > 0 &&
           blocks[0] &&
           typeof blocks[0] === 'object' &&
           'blockName' in blocks[0] &&
           'disciplines' in blocks[0];
    
    // Debug logs removed for security
    return result;
  } 
  // Estrutura antiga: array direto de blocos (fallback)
  else if (Array.isArray(concurso.disciplines) && concurso.disciplines.length > 0) {
    const result = concurso.disciplines[0] &&
           typeof concurso.disciplines[0] === 'object' &&
           'name' in concurso.disciplines[0] &&
           'disciplines' in concurso.disciplines[0];
    
    // Debug logs removed for security
    return result;
  }
  
  return false;
};

// ✅ NOVA IMPLEMENTAÇÃO: Get disciplines usando funções helper centralizadas
export const getDisciplines = (concurso: Concurso) => {
  if (!concurso) return [];
  
  // Debug temporário (comentado para produção)
  // debugDisciplinesStructure(concurso);
  
  // Usar função helper centralizada para extrair disciplinas
  const disciplines = extractDisciplines(concurso);
  
  if (disciplines.length > 0) {
    // Debug logs removed for security
    return disciplines;
  }
  
  // Fallback para estrutura tradicional (apenas se não houver disciplines JSONB)
  devLog.warn('[getDisciplines] Usando estrutura tradicional como fallback - disciplines JSONB não encontrado');
  return getTraditionalDisciplines(concurso);
};

// Função helper para estrutura tradicional (fallback)
const getTraditionalDisciplines = (concurso: Concurso): NestedDiscipline[] => {
  const disciplines: NestedDiscipline[] = [];
  
  if (concurso.has_basic_knowledge) {
    disciplines.push({
      name: 'Conhecimentos Básicos',
      type: 'basic',
      isEnabled: true,
      questionCount: concurso.basic_knowledge_questions || 0,
      weight: concurso.basic_knowledge_weight || 1
    });
  }
  
  if (concurso.has_specific_knowledge_1) {
    disciplines.push({
      name: 'Conhecimentos Específicos 1',
      type: 'specific1',
      isEnabled: true,
      questionCount: concurso.specific_knowledge_1_questions || 0,
      weight: concurso.specific_knowledge_1_weight || 1
    });
  }
  
  if (concurso.has_specific_knowledge_2) {
    disciplines.push({
      name: 'Conhecimentos Específicos 2',
      type: 'specific2',
      isEnabled: true,
      questionCount: concurso.specific_knowledge_2_questions || 0,
      weight: concurso.specific_knowledge_2_weight || 1
    });
  }
  
  if (concurso.has_specific_knowledge_3) {
    disciplines.push({
      name: 'Conhecimentos Específicos 3',
      type: 'specific3',
      isEnabled: true,
      questionCount: concurso.specific_knowledge_3_questions || 0,
      weight: concurso.specific_knowledge_3_weight || 1
    });
  }
  
  return disciplines;
};

// ✅ NOVA FUNÇÃO: Obter pontuações mínimas globais
export const getGlobalMinimumScoresFromConcurso = (concurso: Concurso) => {
  return getGlobalMinimumScores(concurso);
};

// Atualizar os nomes de exibição para disciplinas customizadas
export const updateSectionDisplayNames = (concurso: Concurso) => {
  const displayNames = { ...sectionDisplayNames };
  
  // SEMPRE usar a nova estrutura JSONB disciplines (prioridade máxima)
  if (concurso.disciplines) {
    // Debug logs removed for security
    const disciplines = getDisciplines(concurso);
    
    disciplines.forEach(discipline => {
      if (discipline.isEnabled && discipline.type && discipline.name) {
        // Debug logs removed for security
        displayNames[discipline.type] = discipline.name;
      }
    });
  }
  
  // devLog.log('[updateSectionDisplayNames] Nomes de exibição finais:', displayNames);
  return displayNames;
};

// ==== New helpers to normalize disciplines/blocks across structures ====

// Get discipline weights (type -> weight)
export const getDisciplineWeights = (concurso: Concurso): Record<string, number> => {
  const weights: Record<string, number> = {};
  if (!concurso?.disciplines) return weights;

  // JSONB com blocks
  if (typeof concurso.disciplines === 'object' && !Array.isArray(concurso.disciplines) && (concurso.disciplines as any).blocks) {
    for (const block of (concurso.disciplines as any).blocks) {
      if (block?.disciplines && Array.isArray(block.disciplines)) {
        for (const d of block.disciplines) {
          if (d?.type && d.isEnabled !== false) {
            weights[d.type] = Number(d.weight ?? 1);
          }
        }
      }
    }
    return weights;
  }

  // Array (legado): hierárquico ou plano
  if (Array.isArray(concurso.disciplines)) {
    for (const item of concurso.disciplines) {
      if ((item as any)?.disciplines && Array.isArray((item as any).disciplines)) {
        for (const d of (item as any).disciplines) {
          if (d?.type && d.isEnabled !== false) weights[d.type] = Number(d.weight ?? 1);
        }
      } else if ((item as any)?.type) {
        const d = item as any;
        if (d?.type && d.isEnabled !== false) weights[d.type] = Number(d.weight ?? 1);
      }
    }
  }
  return weights;
};

// Get discipline minimums (type -> min), respecting quota when requested
export const getDisciplineMinimums = (concurso: Concurso, isQuota: boolean): Record<string, number> => {
  const mins: Record<string, number> = {};
  if (!concurso?.disciplines) return mins;

  if (typeof concurso.disciplines === 'object' && !Array.isArray(concurso.disciplines) && (concurso.disciplines as any).blocks) {
    for (const block of (concurso.disciplines as any).blocks) {
      if (block?.disciplines && Array.isArray(block.disciplines)) {
        for (const d of block.disciplines) {
          if (d?.type && d.isEnabled !== false) {
            mins[d.type] = Number(isQuota ? (d.minimum_score_cotas ?? 0) : (d.minimum_score ?? 0));
          }
        }
      }
    }
    return mins;
  }

  if (Array.isArray(concurso.disciplines)) {
    for (const item of concurso.disciplines) {
      if ((item as any)?.disciplines && Array.isArray((item as any).disciplines)) {
        for (const d of (item as any).disciplines) {
          if (d?.type && d.isEnabled !== false) mins[d.type] = Number(isQuota ? (d.minimum_score_cotas ?? 0) : (d.minimum_score ?? 0));
        }
      } else if ((item as any)?.type) {
        const d = item as any;
        if (d?.type && d.isEnabled !== false) mins[d.type] = Number(isQuota ? (d.minimum_score_cotas ?? 0) : (d.minimum_score ?? 0));
      }
    }
  }
  return mins;
};

// Get block minimums and mapping discipline->blockId
export const getBlockMinimumMaps = (
  concurso: Concurso,
  isQuota: boolean
): { blockMinimums: Record<string, number>; disciplineToBlock: Record<string, string> } => {
  const blockMinimums: Record<string, number> = {};
  const disciplineToBlock: Record<string, string> = {};
  if (!concurso?.disciplines) return { blockMinimums, disciplineToBlock };

  if (typeof concurso.disciplines === 'object' && !Array.isArray(concurso.disciplines) && (concurso.disciplines as any).blocks) {
    for (const block of (concurso.disciplines as any).blocks) {
      const bId = block.blockId || block.blockName;
      if (bId) blockMinimums[bId] = Number(isQuota ? (block.blockMinimumCotas || 0) : (block.blockMinimumScore || 0));
      if (block?.disciplines && Array.isArray(block.disciplines)) {
        for (const d of block.disciplines) {
          if (d?.type && d.isEnabled) disciplineToBlock[d.type] = bId;
        }
      }
    }
    return { blockMinimums, disciplineToBlock };
  }

  if (Array.isArray(concurso.disciplines)) {
    for (const block of concurso.disciplines as any[]) {
      const bId = block.id || block.name;
      if (bId) blockMinimums[bId] = Number(isQuota ? (block.minimum_score_cotas || 0) : (block.minimum_score || 0));
      if (block?.disciplines && Array.isArray(block.disciplines)) {
        for (const d of block.disciplines) {
          if (d?.type && d.isEnabled) disciplineToBlock[d.type] = bId;
        }
      }
    }
  }
  return { blockMinimums, disciplineToBlock };
};
