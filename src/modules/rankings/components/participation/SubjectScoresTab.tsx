// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Concurso, DisciplineBlock, NestedDiscipline } from '@/types/concursos';
import { formatScore } from '@/lib/utils';

// Função auxiliar para buscar disciplina por ID ou por TYPE na estrutura JSONB
const findDiscipline = (disciplines: any, keyOrId: string): NestedDiscipline | undefined => {
  if (!disciplines) return undefined;
  
  // Nova estrutura hierárquica (objeto com blocks)
  if (typeof disciplines === 'object' && !Array.isArray(disciplines) && disciplines.blocks) {
    // Debug logs removed for security
    for (const block of disciplines.blocks) {
      if (block?.disciplines && Array.isArray(block.disciplines)) {
        const found = block.disciplines.find((d: NestedDiscipline) => d.id === keyOrId || (d as any).type === keyOrId);
        if (found) return found;
      }
    }
    return undefined;
  }
  
  // Estrutura antiga (array)
  if (Array.isArray(disciplines)) {
    // Debug logs removed for security
    for (const item of disciplines) {
      if ('disciplines' in item) {
        // Estrutura hierárquica (blocos)
        const found = item.disciplines?.find((d: NestedDiscipline) => d.id === keyOrId || (d as any).type === keyOrId);
        if (found) return found;
      } else {
        // Estrutura plana
        if ((item as any).id === keyOrId || (item as any).type === keyOrId) return item as NestedDiscipline;
      }
    }
  }
  
  return undefined;
};

interface SubjectScoresTabProps {
  concurso: Concurso;
  subjectScores: Record<string, number>;
  onSubjectScoreChange: (key: string, value: number) => void;
  canEdit: boolean;
}

export const SubjectScoresTab: React.FC<SubjectScoresTabProps> = ({
  concurso,
  subjectScores,
  onSubjectScoreChange,
  canEdit
}) => {
  const [localScores, setLocalScores] = useState<Record<string, number>>(subjectScores);

  // Atualizar scores locais quando subjectScores mudar
  useEffect(() => {
    setLocalScores(subjectScores);
  }, [subjectScores]);

  const handleScoreChange = (key: string, value: string) => {
    const numericValue = parseFloat(value) || 0;
    setLocalScores(prev => ({ ...prev, [key]: numericValue }));
    onSubjectScoreChange(key, numericValue);
  };

  const getScoreLabel = (key: string): string => {
    // Check for other_subjective (preferir JSONB subjects; fallback legacy)
    if (key === 'other_subjective') {
      const otherName = concurso.subjects?.name_other || (concurso as any).other_subjective_name;
      if (otherName) return otherName;
    }
    
    // Check for standard subjective types in JSONB disciplines
    if (['discursive', 'case_study_1', 'case_study_2', 'case_study_3', 'other_subjective'].includes(key)) {
      const discipline = findDiscipline(concurso.disciplines, key);
      if (discipline?.name) {
        return discipline.name;
      }
      
      // Fallback labels for standard types
      const fallbackLabels: Record<string, string> = {
        'discursive': 'Prova Discursiva',
        'case_study_1': 'Estudo de Caso 1',
        'case_study_2': 'Estudo de Caso 2',
        'case_study_3': 'Estudo de Caso 3',
        'other_subjective': 'Outro Subjetivo'
      };
      return fallbackLabels[key] || key;
    }
    
    // Check for custom disciplines
    if (key.startsWith('custom_')) {
      const disciplineId = key.replace('custom_', '');
      const discipline = findDiscipline(concurso.disciplines, disciplineId);
      return discipline?.name || `Disciplina ${disciplineId}`;
    }
    
    return key;
  };

  const getScoreWeight = (key: string): number => {
    // Check for standard subjective types in JSONB disciplines
    if (['discursive', 'case_study_1', 'case_study_2', 'case_study_3', 'other_subjective'].includes(key)) {
      const discipline = findDiscipline(concurso.disciplines, key);
      return discipline?.weight || 1;
    }
    
    // Subjective questions don't have weights - return 1 as default
    if (key === 'other_subjective_name' || key === 'discursive') {
      return 1;
    }
    
    // Check for custom disciplines
    if (key.startsWith('custom_')) {
      const disciplineId = key.replace('custom_', '');
      const discipline = findDiscipline(concurso.disciplines, disciplineId);
      return discipline?.weight || 1;
    }
    
    return 1;
  };

  const getWeightedScore = (key: string): number => {
    const score = localScores[key] || 0;
    const weight = getScoreWeight(key);
    return score * weight;
  };

  // Verificar se o concurso tem seções subjetivas habilitadas - JSONB + CAMPOS DIRETOS
  let hasSubjectiveSections = false;
  
  // Verificar nova estrutura hierárquica (objeto com blocks)
  if (concurso.disciplines && typeof concurso.disciplines === 'object' && !Array.isArray(concurso.disciplines) && concurso.disciplines.blocks) {
    for (const block of concurso.disciplines.blocks) {
      if (block.disciplines && Array.isArray(block.disciplines)) {
        for (const discipline of block.disciplines) {
          if (discipline.isEnabled && ['discursive', 'case_study_1', 'case_study_2', 'case_study_3', 'other_subjective'].includes(discipline.type)) {
            hasSubjectiveSections = true;
            break;
          }
        }
      }
      if (hasSubjectiveSections) break;
    }
  }
  // Verificar estrutura antiga (array de blocos)
  else if (concurso.disciplines && Array.isArray(concurso.disciplines)) {
    for (const discipline of concurso.disciplines) {
      if ('disciplines' in discipline) {
        // Estrutura hierárquica (blocos)
        if (discipline.disciplines?.some(d => 
          d.isEnabled && ['discursive', 'case_study_1', 'case_study_2', 'case_study_3', 'other_subjective'].includes(d.type)
        )) {
          hasSubjectiveSections = true;
          break;
        }
      } else {
        // Estrutura plana
        if (discipline.isEnabled && ['discursive', 'case_study_1', 'case_study_2', 'case_study_3', 'other_subjective'].includes(discipline.type)) {
          hasSubjectiveSections = true;
          break;
        }
      }
    }
  }
  
  // Fallback para campos diretos (compatibilidade)
  hasSubjectiveSections = hasSubjectiveSections || 
    concurso.has_discursive || 
    concurso.has_case_study_1 || 
    concurso.has_case_study_2 || 
    concurso.has_case_study_3 || 
    concurso.has_other_subjective;

  if (!hasSubjectiveSections) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pontuações Subjetivas</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Este concurso não possui seções subjetivas habilitadas.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Helper: verificar se seção subjetiva está habilitada no JSONB ou pelos flags legados
  const isSubjectiveEnabled = (key: string): boolean => {
    // Flags legados (top-level)
    if (key === 'discursive' && (concurso as any).has_discursive) return true;
    if (key === 'case_study_1' && (concurso as any).has_case_study_1) return true;
    if (key === 'case_study_2' && (concurso as any).has_case_study_2) return true;
    if (key === 'case_study_3' && (concurso as any).has_case_study_3) return true;
    if (key === 'other_subjective' && (concurso as any).has_other_subjective) return true;
    // JSONB subjects
    if (key === 'discursive' && concurso.subjects?.discr === true) return true;
    if (key === 'case_study_1' && concurso.subjects?.case1 === true) return true;
    if (key === 'case_study_2' && concurso.subjects?.case2 === true) return true;
    if (key === 'case_study_3' && concurso.subjects?.case3 === true) return true;
    if (key === 'other_subjective' && concurso.subjects?.other === true) return true;
    // JSONB disciplines como fallback
    const d = findDiscipline(concurso.disciplines, key);
    return !!(d && d.isEnabled === true);
  };

  // Seções candidatas subjetivas padrão
  const candidateKeys = ['discursive', 'case_study_1', 'case_study_2', 'case_study_3', 'other_subjective'];
  const enabledSections = candidateKeys.filter(isSubjectiveEnabled);


  return (
    <div className="p-6 space-y-6">
        {enabledSections.map(key => (
          <div key={key} className="space-y-2">
            <div className="space-y-2">
              <Label htmlFor={`score-${key}`} className="font-medium">
                {getScoreLabel(key)}
              </Label>
              
              <Input
                id={`score-${key}`}
                type="number"
                min="0"
                max="100"
                step="0.01"
                placeholder="0.00"
                value={localScores[key] || 0}
                onChange={(e) => handleScoreChange(key, e.target.value)}
                disabled={!canEdit}
                className="w-32"
              />
            </div>
          </div>
        ))}
        
        <div className="pt-4 border-t">
          <div className="flex justify-between items-center">
            <span className="font-medium">Total Ponderado:</span>
            <span className="text-lg font-bold">
              {formatScore(enabledSections.reduce((total, key) => total + getWeightedScore(key), 0))}
            </span>
          </div>
        </div>
    </div>
  );
};
