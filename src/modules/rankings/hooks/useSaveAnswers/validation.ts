/**
 * ✅ SEGURANÇA: Validação de limite de edições movida para backend
 * Esta função agora apenas valida formato de dados, não limites de plano
 */
export const validateSaveAnswers = (
  editCount: number,
  selectedBookletId?: string
): { isValid: boolean; errorMessage?: string } => {
  // Verificar se editCount é um número válido
  if (typeof editCount !== 'number' || editCount < 0) {
    return {
      isValid: false,
      errorMessage: "Contador de edições inválido."
    };
  }

  // Verificar se um caderno foi selecionado (permitir string vazia se há cadernos disponíveis)
  if (!selectedBookletId || selectedBookletId.trim() === '') {
    // Não retornar erro aqui, deixar o useSaveAnswers resolver o caderno padrão
  }

  // Limite de edições é validado no backend via RPC check_free_user_edit_limits
  return { isValid: true };
};
