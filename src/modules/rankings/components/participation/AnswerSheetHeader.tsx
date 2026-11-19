import React from 'react';
import { Concurso } from '@/types/concursos';
import { Separator } from '@/components/ui/separator';
import { BookOpen, Briefcase, BookA, School, Award, GraduationCap, Scale } from 'lucide-react';
interface AnswerSheetHeaderProps {
  concurso: Concurso;
  getTotalQuestions: () => number;
}
export const AnswerSheetHeader: React.FC<AnswerSheetHeaderProps> = ({
  concurso,
  getTotalQuestions
}) => {
  const totalQuestions = getTotalQuestions();
  const examTypeLabel = concurso.exam_type === 'Certo ou Errado' ? 'Certo ou Errado' : `${concurso.alternatives_count || 5} Alternativas`;
  return <div className="space-y-4">
      <div className="bg-card p-4 rounded-lg border border-border shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold">{concurso.orgao}</h3>
            
          </div>
          
          <div className="flex items-center bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded-lg border border-emerald-200">
            <GraduationCap className="h-5 w-5 mr-2 text-emerald-600" />
            <span className="font-medium">{totalQuestions} questões no total</span>
          </div>
        </div>
        
        
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          {/* Render disciplines from the new structure */}
          {concurso.disciplines && Array.isArray(concurso.disciplines) && concurso.disciplines.map((discipline, index) => {
            // Check if it's a hierarchical structure (block with disciplines)
            if ('disciplines' in discipline && Array.isArray(discipline.disciplines)) {
              // Render each discipline in the block
              return discipline.disciplines.map((subDiscipline: any, subIndex: number) => {
                if (!subDiscipline.isEnabled) return null;
                
                return (
                  <div key={`${index}-${subIndex}`} className="flex items-start">
                    <div>
                      <p className="font-medium flex items-center">
                        {subDiscipline.name || subDiscipline.type}
                        {subDiscipline.weight > 0 && (
                          <span className="ml-2 flex items-center text-emerald-700 font-medium">
                            <Scale className="h-3.5 w-3.5 mr-1" />
                            Peso {subDiscipline.weight}
                          </span>
                        )}
                      </p>
                      <div className="flex items-center text-muted-foreground">
                        <p>{subDiscipline.questionCount || 0} questões</p>
                      </div>
                    </div>
                  </div>
                );
              });
            } else {
              // Flat structure - render discipline directly
              if (!discipline.isEnabled) return null;
              
              return (
                <div key={index} className="flex items-start">
                  <div>
                    <p className="font-medium flex items-center">
                      {discipline.name || discipline.type}
                      {discipline.weight > 0 && (
                        <span className="ml-2 flex items-center text-emerald-700 font-medium">
                          <Scale className="h-3.5 w-3.5 mr-1" />
                          Peso {discipline.weight}
                        </span>
                      )}
                    </p>
                    <div className="flex items-center text-muted-foreground">
                      <p>{discipline.questionCount || 0} questões</p>
                    </div>
                  </div>
                </div>
              );
            }
          }).flat().filter(Boolean)}
          
          {/* All subjective sections are now handled by JSONB disciplines above */}
        </div>
      </div>
    </div>;
};