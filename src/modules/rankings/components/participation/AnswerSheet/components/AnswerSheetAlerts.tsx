import React from 'react';
import { AlertTriangle, Check, AlertCircle } from 'lucide-react';
import { AnswerSheetAlertsProps } from '../utils/answerSheetTypes';

export const AnswerSheetAlerts: React.FC<AnswerSheetAlertsProps> = ({
  error,
  savedSuccess,
  missingOfficialAnswers,
  nullifiedQuestions,
  onDismissError,
  onDismissSuccess
}) => {
  return (
    <div className="space-y-4">
      {/* Erro */}
      {error && (
        <div className="bg-destructive/15 p-3 rounded-md flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-4 w-4" />
          <p>{error}</p>
          {onDismissError && (
            <button
              onClick={onDismissError}
              className="ml-auto text-destructive/70 hover:text-destructive"
            >
              ×
            </button>
          )}
        </div>
      )}

      {/* Sucesso */}
      {savedSuccess && (
        <div className="bg-green-100 p-3 rounded-md flex items-center gap-2 text-green-800">
          <Check className="h-4 w-4" />
          <p>Respostas salvas com sucesso! Calculando pontuação...</p>
          {onDismissSuccess && (
            <button
              onClick={onDismissSuccess}
              className="ml-auto text-green-700/70 hover:text-green-700"
            >
              ×
            </button>
          )}
        </div>
      )}

      {/* Aviso de gabarito incompleto */}
      {missingOfficialAnswers && (
        <div className="bg-amber-100 border border-amber-300 rounded-md p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5" />
            <div>
              <h4 className="font-medium text-amber-800">Gabarito Oficial Incompleto</h4>
              <p className="text-sm text-amber-700 mt-1">
                O gabarito oficial deste concurso parece estar incompleto ou não foi configurado.
                Você ainda pode preencher suas respostas, mas a pontuação pode não ser calculada corretamente.
              </p>
              <p className="text-xs text-amber-600 mt-2">
                Entre em contato com o administrador para resolver este problema.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};



