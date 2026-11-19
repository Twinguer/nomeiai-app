
import { SectionType } from '@/types/concursos';

export interface ExamSectionConfig {
  sectionType: SectionType;
  displayName: string;
  weight: number;
  questionCount: number;
  isEnabled: boolean;
  isCustom: boolean;
  customName?: string;
  name?: string; // Added this property for compatibility
}

export class ExamSectionBuilder {
  private config: ExamSectionConfig;
  
  constructor(sectionType: SectionType, displayName: string) {
    this.config = {
      sectionType,
      displayName,
      weight: 1,
      questionCount: 0,
      isEnabled: false,
      isCustom: false,
      name: displayName // Initialize name with displayName
    };
  }
  
  withWeight(weight: number): ExamSectionBuilder {
    this.config.weight = weight;
    return this;
  }
  
  withQuestionCount(count: number): ExamSectionBuilder {
    this.config.questionCount = count;
    return this;
  }
  
  enabled(): ExamSectionBuilder {
    this.config.isEnabled = true;
    return this;
  }
  
  disabled(): ExamSectionBuilder {
    this.config.isEnabled = false;
    return this;
  }
  
  asCustomSection(name?: string): ExamSectionBuilder {
    this.config.isCustom = true;
    if (name) {
      this.config.customName = name;
      this.config.name = name; // Also update the name property
    }
    return this;
  }
  
  build(): ExamSectionConfig {
    return { ...this.config };
  }
}
