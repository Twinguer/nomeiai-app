import { DisciplinesStructure, DisciplineBlockStructure, NestedDisciplineStructure, DisciplineBlock, NestedDiscipline, Concurso } from '../types/concursos';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';

/**
 * TypeGuards para detectar diferentes estruturas de disciplines
 */

// Detectar nova estrutura JSONB completa
export const isNewDisciplinesStructure = (disciplines: any): disciplines is DisciplinesStructure => {
  const result = disciplines && 
         typeof disciplines === 'object' && 
         'minimum_total_score' in disciplines &&
         'minimum_total_score_cotas' in disciplines &&
         'blocks' in disciplines &&
         Array.isArray(disciplines.blocks);
  
  // Debug logs removed for security
  
  return result;
};

// Detectar estrutura antiga de blocos
export const isOldBlocksStructure = (disciplines: any): disciplines is DisciplineBlock[] => {
  const result = Array.isArray(disciplines) && 
         disciplines.length > 0 &&
         'disciplines' in disciplines[0];
  
  // Debug logs removed for security
  
  return result;
};

// Detectar estrutura plana
export const isFlatStructure = (disciplines: any): disciplines is NestedDiscipline[] => {
  const result = Array.isArray(disciplines) && 
         disciplines.length > 0 &&
         'isEnabled' in disciplines[0] &&
         !('disciplines' in disciplines[0]);
  
  // Debug logs removed for security
  
  return result;
};

/**
 * Função para migrar estrutura antiga para nova estrutura
 */
export const migrateDisciplinesStructure = (concurso: Concurso): Concurso => {
  if (!concurso.disciplines) return concurso;
  
  // Se já é a nova estrutura, retornar como está
  if (isNewDisciplinesStructure(concurso.disciplines)) {
    // Debug logs removed for security
    return concurso;
  }
  
  // Migrar estrutura antiga de blocos para nova
  if (isOldBlocksStructure(concurso.disciplines)) {
    // Debug logs removed for security
    
    const newStructure: DisciplinesStructure = {
      minimum_total_score: 0, // Valor padrão - pode ser configurado posteriormente
      minimum_total_score_cotas: 0, // Valor padrão - pode ser configurado posteriormente
      blocks: concurso.disciplines.map(block => ({
        blockId: block.id,
        blockName: block.name,
        blockMinimumScore: block.minimum_score || 0,
        blockMinimumCotas: block.minimum_score_cotas || 0,
        disciplines: block.disciplines.map(discipline => ({
          id: discipline.id || '',
          name: discipline.name,
          type: discipline.type,
          weight: discipline.weight || 1,
          isEnabled: discipline.isEnabled !== false,
          minimum_score: discipline.minimum_score || 0,
          minimum_score_cotas: discipline.minimum_score_cotas || 0,
          questionCount: discipline.questionCount || 0
        }))
      }))
    };
    
    return {
      ...concurso,
      disciplines: newStructure
    };
  }
  
  // Estrutura plana - converter para nova estrutura com um bloco único
  if (isFlatStructure(concurso.disciplines)) {
    // Debug logs removed for security
    
    const newStructure: DisciplinesStructure = {
      minimum_total_score: 0,
      minimum_total_score_cotas: 0,
      blocks: [{
        blockId: 'default-block',
        blockName: 'Disciplinas',
        blockMinimumScore: 0,
        blockMinimumCotas: 0,
        disciplines: concurso.disciplines.map(discipline => ({
          id: discipline.id || '',
          name: discipline.name,
          type: discipline.type,
          weight: discipline.weight || 1,
          isEnabled: discipline.isEnabled !== false,
          minimum_score: discipline.minimum_score || 0,
          minimum_score_cotas: discipline.minimum_score_cotas || 0,
          questionCount: discipline.questionCount || 0
        }))
      }]
    };
    
    return {
      ...concurso,
      disciplines: newStructure
    };
  }
  
  devLog.warn('[migrateDisciplinesStructure] Unknown structure, returning as is');
  return concurso;
};

/**
 * Função para extrair disciplinas de qualquer estrutura
 */
export const extractDisciplines = (concurso: Concurso): NestedDiscipline[] => {
  if (!concurso.disciplines) {
    // Debug logs removed for security
    return [];
  }
  
  // Debug logs removed for security
  
  // ✅ CORREÇÃO: Verificar se é array vazio primeiro
  if (Array.isArray(concurso.disciplines) && concurso.disciplines.length === 0) {
    // Debug logs removed for security
    return [];
  }
  
  // Nova estrutura hierárquica completa
  if (isNewDisciplinesStructure(concurso.disciplines)) {
    // Debug logs removed for security
    const disciplines: NestedDiscipline[] = [];
    
    for (const block of concurso.disciplines.blocks) {
      for (const discipline of block.disciplines) {
        if (discipline.isEnabled) {
          disciplines.push({
            ...discipline,
            blockName: block.blockName,
            blockId: block.blockId,
            blockWeight: 1, // Pode ser adicionado se necessário
            blockMinimumScore: block.blockMinimumScore,
            blockMinimumCotas: block.blockMinimumCotas
          } as any);
        }
      }
    }
    
    return disciplines;
  }
  
  // Estrutura antiga de blocos (compatibilidade)
  if (isOldBlocksStructure(concurso.disciplines)) {
    // Debug logs removed for security
    const disciplines: NestedDiscipline[] = [];
    
    for (const block of concurso.disciplines) {
      for (const discipline of block.disciplines) {
        if (discipline.isEnabled) {
          disciplines.push({
            ...discipline,
            blockName: block.name,
            blockId: block.id,
            blockWeight: block.weight,
            blockMinimumScore: block.minimum_score,
            blockMinimumCotas: block.minimum_score_cotas
          } as any);
        }
      }
    }
    
    return disciplines;
  }
  
  // Estrutura plana (compatibilidade)
  if (isFlatStructure(concurso.disciplines)) {
    // Debug logs removed for security
    return concurso.disciplines.filter(d => d.isEnabled);
  }
  
  // Tentar detectar estrutura com campos diferentes
  if (Array.isArray(concurso.disciplines) && concurso.disciplines.length > 0) {
    // Debug logs removed for security
    
    // Verificar se é um array de blocos com estrutura diferente
    if (concurso.disciplines[0] && typeof concurso.disciplines[0] === 'object') {
      const firstItem = concurso.disciplines[0];
      
      // Se tem 'disciplines' mas não tem 'blockId', pode ser estrutura antiga
      if ('disciplines' in firstItem && !('blockId' in firstItem)) {
        // Debug logs removed for security
        const disciplines: NestedDiscipline[] = [];
        
        for (const block of concurso.disciplines) {
          for (const discipline of block.disciplines) {
            if (discipline.isEnabled) {
              disciplines.push({
                ...discipline,
                blockName: block.name,
                blockId: block.id,
                blockWeight: block.weight,
                blockMinimumScore: block.minimum_score,
                blockMinimumCotas: block.minimum_score_cotas
              } as any);
            }
          }
        }
        
        return disciplines;
      }
    }
  }
  
  devLog.warn('[extractDisciplines] Unknown structure, returning empty array');
  devLog.warn('[extractDisciplines] Structure details:', {
    type: typeof concurso.disciplines,
    isArray: Array.isArray(concurso.disciplines),
    length: Array.isArray(concurso.disciplines) ? concurso.disciplines.length : 'N/A',
    keys: typeof concurso.disciplines === 'object' ? Object.keys(concurso.disciplines) : 'N/A',
    firstItem: Array.isArray(concurso.disciplines) && concurso.disciplines.length > 0 ? concurso.disciplines[0] : 'N/A'
  });
  
  return [];
};

/**
 * Função para obter pontuações mínimas globais
 */
export const getGlobalMinimumScores = (concurso: Concurso): { total: number; cotas: number } => {
  if (!concurso.disciplines) return { total: 0, cotas: 0 };
  
  if (isNewDisciplinesStructure(concurso.disciplines)) {
    return {
      total: concurso.disciplines.minimum_total_score || 0,
      cotas: concurso.disciplines.minimum_total_score_cotas || 0
    };
  }
  
  // Para estruturas antigas, retornar valores padrão
  return { total: 0, cotas: 0 };
};

/**
 * Função temporária para debug
 */
export const debugDisciplinesStructure = (concurso: Concurso) => {
  devLog.log('=== DEBUG DISCIPLINES STRUCTURE ===');
  devLog.log('Concurso ID:', concurso.id);
  devLog.log('Concurso disciplines:', concurso.disciplines);
  devLog.log('Type of disciplines:', typeof concurso.disciplines);
  devLog.log('Is Array:', Array.isArray(concurso.disciplines));
  
  if (concurso.disciplines) {
    devLog.log('Disciplines keys:', Object.keys(concurso.disciplines));
    
    if (Array.isArray(concurso.disciplines)) {
      devLog.log('Array length:', concurso.disciplines.length);
      if (concurso.disciplines.length > 0) {
        // Debug logs removed for security
        // Debug logs removed for security
      }
    }
  }
  devLog.log('=== END DEBUG ===');
};

/**
 * Função para mapear dados do formulário para nova estrutura
 */
export const mapFormDataToDisciplinesStructure = (formValues: any): DisciplinesStructure => {
  // Debug logs removed for security
  // Debug logs removed for security
  
  // Extrair minimum scores do form (aceita snake_case e camelCase)
  const totalScore = Number(
    (formValues.minimum_total_score ?? formValues.minimumTotalScore ?? 0)
  );
  const quotaScore = Number(
    (formValues.minimum_total_score_cotas ?? formValues.minimumTotalScoreCotas ?? 0)
  );
  
  // Extrair penalidade para respostas erradas (apenas para provas C/E)
  const wrongAnswerPenalty = Number(formValues.wrong_answer_penalty ?? 0);
  
  // Debug logs removed for security
  // Debug logs removed for security
  // Debug logs removed for security
  
  // Mapear blocos de disciplinas
  const blocks = (formValues.disciplines || []).map((block: any) => {
    // Debug logs removed for security
    return {
      blockId: block.id,
      blockName: block.name,
      blockMinimumScore: Number(block.minimum_score) || 0,
      blockMinimumCotas: Number(block.minimum_score_cotas) || 0,
      disciplines: (block.disciplines || []).map((discipline: any) => {
        // Debug logs removed for security
        const questionCount = Number(discipline.questionCount) || 0;
        // Debug logs removed for security
        
        // Validar se questionCount é válido
        if (questionCount === 0) {
          // Debug logs removed for security
        }
        
        return {
          id: discipline.id,
          name: discipline.name,
          type: discipline.type,
          weight: Number(discipline.weight) || 1,
          isEnabled: discipline.isEnabled !== false,
          minimum_score: Number(discipline.minimum_score) || 0,
          minimum_score_cotas: Number(discipline.minimum_score_cotas) || 0,
          questionCount: questionCount
        };
      })
    };
  });
  
  const result = {
    minimum_total_score: totalScore,
    minimum_total_score_cotas: quotaScore,
    wrong_answer_penalty: wrongAnswerPenalty,
    blocks
  };
  
  // Debug logs removed for security
  // Debug logs removed for security
  
  return result;
};
