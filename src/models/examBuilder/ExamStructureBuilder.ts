
import { ExamSectionBuilder, ExamSectionConfig } from './ExamSectionBuilder';
import { Concurso, SectionType } from '@/types/concursos';

export class ExamStructureBuilder {
  private examType: 'Alternativas' | 'Certo ou Errado' = 'Alternativas';
  private alternativesCount: number = 5;
  private wrongAnswerPenalty: number = 0;
  private sections: ExamSectionConfig[] = [];
  private disciplines: any[] = [];

  constructor() {
    // Inicialização vazia
  }

  withExamType(type: 'Alternativas' | 'Certo ou Errado'): ExamStructureBuilder {
    this.examType = type;
    return this;
  }

  withAlternativesCount(count: number): ExamStructureBuilder {
    this.alternativesCount = count;
    return this;
  }

  withWrongAnswerPenalty(penalty: number): ExamStructureBuilder {
    this.wrongAnswerPenalty = penalty;
    return this;
  }

  withDisciplines(disciplines: any[]): ExamStructureBuilder {
    this.disciplines = disciplines;
    return this;
  }

  enableSection(sectionType: SectionType, questionCount: number = 0, weight: number = 1): ExamStructureBuilder {
    let displayName = '';

    // Determinar o nome de exibição baseado no tipo
    switch (sectionType) {
      case 'basic':
        displayName = 'Conhecimentos Básicos';
        break;
      case 'specific1':
        displayName = 'Conhecimentos Específicos 1';
        break;
      case 'specific2':
        displayName = 'Conhecimentos Específicos 2';
        break;
      case 'specific3':
        displayName = 'Conhecimentos Específicos 3';
        break;
      case 'discursive':
        displayName = 'Discursiva';
        break;
      case 'case_study1':
        displayName = 'Estudo de Caso 1';
        break;
      case 'case_study2':
        displayName = 'Estudo de Caso 2';
        break;
      case 'case_study3':
        displayName = 'Estudo de Caso 3';
        break;
      default:
        displayName = sectionType;
        break;
    }

    // Verificar se já existe uma seção desse tipo
    const existingIndex = this.sections.findIndex(s => s.sectionType === sectionType);
    if (existingIndex >= 0) {
      // Atualizar a seção existente
      this.sections[existingIndex] = new ExamSectionBuilder(sectionType, displayName)
        .withQuestionCount(questionCount)
        .withWeight(weight)
        .enabled()
        .build();
    } else {
      // Adicionar nova seção
      this.sections.push(
        new ExamSectionBuilder(sectionType, displayName)
          .withQuestionCount(questionCount)
          .withWeight(weight)
          .enabled()
          .build()
      );
    }

    return this;
  }

  disableSection(sectionType: SectionType): ExamStructureBuilder {
    // Remover a seção específica
    this.sections = this.sections.filter(s => s.sectionType !== sectionType);
    return this;
  }

  getEnabledSections(): ExamSectionConfig[] {
    return [...this.sections];
  }

  toConcurso(): Partial<Concurso> {
    const concurso: any = {
      // Configurações gerais do exame
      exam_type: this.examType,
      alternatives_count: this.alternativesCount,
      
      // Sempre usar modo customizável
      has_custom_knowledge: true,
      
      // Configurações para as versões subjetivas
      has_discursive: false,
      has_case_study_1: false,
      has_case_study_2: false,
      has_case_study_3: false,
      
      // Subjective sections don't have weights
    };
    
    // Converter seções para disciplinas - criar como bloco único
    const disciplines = this.sections.map(section => {
      // Verificar se é um tipo de seção subjetiva
      if (section.sectionType === 'discursive') {
        concurso.has_discursive = true;
        return null; // Não criar disciplina para seções subjetivas
      } else if (section.sectionType === 'case_study1') {
        concurso.has_case_study_1 = true;
        return null;
      } else if (section.sectionType === 'case_study2') {
        concurso.has_case_study_2 = true;
        return null;
      } else if (section.sectionType === 'case_study3') {
        concurso.has_case_study_3 = true;
        return null;
      }
      
      // Criar disciplina para tipos de questões objetivas
      return {
        id: crypto.randomUUID(),
        type: section.sectionType,
        name: section.displayName,
        isEnabled: true,
        questionCount: Number(section.questionCount),
        weight: Number(section.weight),
        minimum_score: 0,
        minimum_score_cotas: 0
      };
    }).filter(Boolean); // Remove null entries
    
    // ✅ Criar nova estrutura JSONB hierárquica com blocks
    if (disciplines.length > 0) {
      concurso.disciplines = {
        minimum_total_score: 0,
        minimum_total_score_cotas: 0,
        wrong_answer_penalty: this.wrongAnswerPenalty,
        blocks: [{
          blockId: crypto.randomUUID(),
          blockName: 'Gerais',
          blockMinimumScore: 0,
          blockMinimumCotas: 0,
          disciplines: disciplines
        }]
      };
    } else {
      concurso.disciplines = {
        minimum_total_score: 0,
        minimum_total_score_cotas: 0,
        wrong_answer_penalty: this.wrongAnswerPenalty,
        blocks: []
      };
    }
    
    return concurso;
  }
}
