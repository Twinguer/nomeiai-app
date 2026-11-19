
import { useCallback } from 'react';
import { SecurityValidators } from '@/utils/securityValidators';
import { inputSanitizer } from '@/components/Security/InputSanitizer';
import { showErrorToast } from '@/integrations/supabase/toast-utils';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';

export const useSecurityValidation = () => {
  const validateAndSanitizeInput = useCallback((input: string, fieldName: string = 'campo') => {
    try {
      // First validate for security threats
      const validation = SecurityValidators.validateInput(input);
      if (!validation.isValid) {
        showErrorToast('Entrada inválida', `${fieldName}: ${validation.reason}`);
        return null;
      }

      // Then sanitize the input
      return inputSanitizer.sanitizeText(input);
    } catch (error) {
      devLog.error('Validation error:', error);
      showErrorToast('Erro de validação', `Erro ao processar ${fieldName}`);
      return null;
    }
  }, []);

  const validateUUID = useCallback((uuid: string, fieldName: string = 'ID') => {
    if (!SecurityValidators.validateUUID(uuid)) {
      showErrorToast('ID inválido', `${fieldName} possui formato inválido`);
      return false;
    }
    return true;
  }, []);

  const validateNumericInput = useCallback((value: any, min: number, max: number, fieldName: string = 'valor') => {
    try {
      const numValue = inputSanitizer.sanitizeNumeric(value);
      if (!SecurityValidators.validateNumericRange(numValue, min, max)) {
        showErrorToast('Valor inválido', `${fieldName} deve estar entre ${min} e ${max}`);
        return null;
      }
      return numValue;
    } catch (error) {
      showErrorToast('Valor inválido', `${fieldName} deve ser um número válido`);
      return null;
    }
  }, []);

  const validateFileUpload = useCallback((file: File) => {
    const validation = SecurityValidators.validateFileUpload(file);
    if (!validation.isValid) {
      showErrorToast('Arquivo inválido', validation.reason || 'Arquivo não permitido');
      return false;
    }
    return true;
  }, []);

  return {
    validateAndSanitizeInput,
    validateUUID,
    validateNumericInput,
    validateFileUpload
  };
};
