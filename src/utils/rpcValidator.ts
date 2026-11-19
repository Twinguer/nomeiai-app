/**
 * RPC Input Validator
 * Centraliza validação de inputs para chamadas RPC
 */

import { SecurityValidators } from './securityValidators';
import { EnhancedInputValidator } from './enhancedInputValidation';
import { devLog } from './productionLogger';

export class RPCValidator {
  /**
   * Valida código de voucher
   */
  static validateVoucherCode(code: string): string {
    devLog.log('[RPCValidator] validateVoucherCode chamado com:', { code: code?.substring(0, 10) + '...', type: typeof code });
    
    if (!code || typeof code !== 'string') {
      devLog.error('[RPCValidator] validateVoucherCode: código inválido ou não é string');
      throw new Error('Código de voucher é obrigatório');
    }

    // 1. Validar input básico (SQL injection, XSS)
    const basicValidation = SecurityValidators.validateInput(code);
    if (!basicValidation.isValid) {
      devLog.error('[RPCValidator] validateVoucherCode: validação básica falhou', { reason: basicValidation.reason });
      throw new Error(`Código inválido: ${basicValidation.reason}`);
    }

    // 2. Validar formato (apenas letras, números, hífen)
    const trimmed = code.trim().toUpperCase();
    devLog.log('[RPCValidator] validateVoucherCode: código após trim', { trimmed: trimmed.substring(0, 10) + '...', length: trimmed.length });
    
    if (trimmed.length < 3 || trimmed.length > 50) {
      devLog.error('[RPCValidator] validateVoucherCode: tamanho inválido', { length: trimmed.length });
      throw new Error('Código deve ter entre 3 e 50 caracteres');
    }

    if (!/^[A-Z0-9-]+$/.test(trimmed)) {
      devLog.error('[RPCValidator] validateVoucherCode: formato inválido', { trimmed: trimmed.substring(0, 20) });
      throw new Error('Código deve conter apenas letras, números e hífens');
    }

    devLog.log('[RPCValidator] validateVoucherCode: validação bem-sucedida');
    return trimmed;
  }

  /**
   * Valida UUID
   */
  static validateUUID(id: string, fieldName: string = 'ID'): string {
    devLog.log('[RPCValidator] validateUUID chamado', { fieldName, id: id?.substring(0, 8) + '...', type: typeof id });
    
    if (!id || typeof id !== 'string') {
      devLog.error('[RPCValidator] validateUUID: ID inválido ou não é string', { fieldName, id, type: typeof id });
      throw new Error(`${fieldName} é obrigatório`);
    }

    if (!SecurityValidators.validateUUID(id)) {
      devLog.error('[RPCValidator] validateUUID: formato UUID inválido', { fieldName, id });
      throw new Error(`${fieldName} possui formato inválido`);
    }

    devLog.log('[RPCValidator] validateUUID: validação bem-sucedida', { fieldName });
    return id;
  }

  /**
   * Valida número de questão
   */
  static validateQuestionNumber(questionNum: number | string, maxQuestions: number = 200): number {
    const num = typeof questionNum === 'string' ? parseInt(questionNum, 10) : questionNum;

    if (isNaN(num) || !isFinite(num)) {
      throw new Error(`Número de questão inválido: ${questionNum}`);
    }

    if (num < 1 || num > maxQuestions) {
      throw new Error(`Número de questão deve estar entre 1 e ${maxQuestions}`);
    }

    return num;
  }

  /**
   * Valida respostas (JSONB de respostas)
   */
  static validateAnswersJSONB(answers: Record<string, string>, maxQuestions: number = 200): Record<string, string> {
    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
      throw new Error('Respostas devem ser um objeto');
    }

    const validated: Record<string, string> = {};
    const questionNumbers = new Set<number>();

    for (const [key, value] of Object.entries(answers)) {
      // Validar número da questão
      const questionNum = this.validateQuestionNumber(key, maxQuestions);
      
      // Evitar duplicatas
      if (questionNumbers.has(questionNum)) {
        throw new Error(`Questão ${key} duplicada`);
      }
      questionNumbers.add(questionNum);

      // Validar resposta
      if (typeof value !== 'string') {
        throw new Error(`Resposta da questão ${key} deve ser uma string`);
      }

      if (value.length === 0 || value.length > 10) {
        throw new Error(`Resposta da questão ${key} inválida (tamanho: ${value.length})`);
      }

      // Validar formato da resposta (apenas letras A-E ou vazio)
      if (value && !/^[A-E]$/i.test(value.trim())) {
        throw new Error(`Resposta da questão ${key} deve ser A, B, C, D ou E`);
      }

      validated[questionNum.toString()] = value.trim().toUpperCase();
    }

    return validated;
  }

  /**
   * Valida pontuações subjetivas (JSONB)
   */
  static validateSubjectiveScores(scores: {
    discursive?: number;
    case_study_1?: number;
    case_study_2?: number;
    case_study_3?: number;
  }): {
    discursive: number;
    case_study_1: number;
    case_study_2: number;
    case_study_3: number;
  } {
    if (!scores || typeof scores !== 'object' || Array.isArray(scores)) {
      throw new Error('Pontuações subjetivas devem ser um objeto');
    }

    const validateScore = (value: any, fieldName: string): number => {
      const num = typeof value === 'number' ? value : parseFloat(value);
      
      if (isNaN(num) || !isFinite(num)) {
        throw new Error(`${fieldName} deve ser um número válido`);
      }

      if (num < 0 || num > 1000) {
        throw new Error(`${fieldName} deve estar entre 0 e 1000`);
      }

      return Math.round(num * 100) / 100; // Arredondar para 2 casas decimais
    };

    return {
      discursive: validateScore(scores.discursive ?? 0, 'Pontuação discursiva'),
      case_study_1: validateScore(scores.case_study_1 ?? 0, 'Estudo de caso 1'),
      case_study_2: validateScore(scores.case_study_2 ?? 0, 'Estudo de caso 2'),
      case_study_3: validateScore(scores.case_study_3 ?? 0, 'Estudo de caso 3')
    };
  }

  /**
   * Valida contador de edições
   */
  static validateEditCount(editCount: number): number {
    if (typeof editCount !== 'number' || isNaN(editCount) || !isFinite(editCount)) {
      throw new Error('Contador de edições deve ser um número válido');
    }

    if (editCount < 0 || editCount > 10000) {
      throw new Error('Contador de edições deve estar entre 0 e 10000');
    }

    return Math.floor(editCount);
  }

  /**
   * Valida tipo de reserva (cota)
   */
  static validateReservationType(reservationType: string | null | undefined): string | null {
    if (reservationType === null || reservationType === undefined || reservationType === '') {
      return null;
    }

    if (typeof reservationType !== 'string') {
      throw new Error('Tipo de reserva deve ser uma string');
    }

    const validTypes = ['AC', 'PPI', 'PC', 'PD', 'PCD'];
    const upper = reservationType.trim().toUpperCase();

    if (!validTypes.includes(upper)) {
      throw new Error(`Tipo de reserva inválido. Permitidos: ${validTypes.join(', ')}`);
    }

    return upper;
  }

  /**
   * Valida ID de caderno
   */
  static validateBookletId(bookletId: string | null | undefined): string | null {
    if (bookletId === null || bookletId === undefined || bookletId === '') {
      return null;
    }

    if (typeof bookletId !== 'string') {
      throw new Error('ID do caderno deve ser uma string');
    }

    const trimmed = bookletId.trim();
    
    if (trimmed.length === 0 || trimmed.length > 50) {
      throw new Error('ID do caderno inválido');
    }

    // Validar formato (apenas letras, números, hífen, underscore)
    if (!/^[A-Z0-9_-]+$/i.test(trimmed)) {
      throw new Error('ID do caderno contém caracteres inválidos');
    }

    return trimmed;
  }

  /**
   * Valida dados de ranking (JSONB)
   */
  static validateRankingData(data: any): any {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('Dados de ranking devem ser um objeto');
    }

    const validated: any = { ...data };

    if (data.edit_count !== undefined) {
      validated.edit_count = this.validateEditCount(data.edit_count);
    }

    if (data.selected_booklet_id !== undefined) {
      validated.selected_booklet_id = this.validateBookletId(data.selected_booklet_id);
    }

    if (data.user_data !== undefined) {
      if (!data.user_data || typeof data.user_data !== 'object' || Array.isArray(data.user_data)) {
        throw new Error('user_data deve ser um objeto');
      }
      validated.user_data = { ...data.user_data };
      if (data.user_data.reservation_type !== undefined && data.user_data.reservation_type !== null) {
        if (typeof data.user_data.reservation_type !== 'string') {
          throw new Error('reservation_type deve ser uma string');
        }
        const trimmed = data.user_data.reservation_type.trim();
        if (!trimmed) {
          throw new Error('reservation_type não pode ser vazio');
        }
        validated.user_data.reservation_type = trimmed;
      }
    }

    return validated;
  }
}

