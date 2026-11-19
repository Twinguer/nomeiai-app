export type SaveRankingSuccess = {
  id: string;
  duplicated: false;
};

export type SaveRankingDuplicate = {
  duplicated: true;
  message: string;
};

export type SaveRankingError = {
  error: true;
  message: string;
};

export type SaveRankingResult =
  | SaveRankingSuccess
  | SaveRankingDuplicate
  | SaveRankingError;

export function isSaveRankingSuccess(
  result: SaveRankingResult | undefined | null
): result is SaveRankingSuccess {
  return !!result && 'id' in result && !result.duplicated && !('error' in result);
}

export function resolveSaveRankingOutcome(
  result: SaveRankingResult | undefined | null
): { ok: true; id: string } | { ok: false; message: string } {
  if (!result) {
    return { ok: false, message: 'Não foi possível salvar o ranking.' };
  }
  if ('error' in result && result.error) {
    return { ok: false, message: result.message };
  }
  if (result.duplicated) {
    return { ok: false, message: result.message };
  }
  if ('id' in result && result.id) {
    return { ok: true, id: result.id };
  }
  return { ok: false, message: 'Não foi possível salvar o ranking.' };
}
