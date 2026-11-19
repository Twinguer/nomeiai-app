-- Corrige normalize_nickname: translitera acentos (ex.: Natály Lima -> natalylima)
-- em vez de remover letras acentuadas (natlylima).

BEGIN;

CREATE OR REPLACE FUNCTION public.normalize_nickname(p_input TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  sanitized TEXT;
BEGIN
  sanitized := LOWER(COALESCE(p_input, ''));
  sanitized := TRANSLATE(
    sanitized,
    'àáâãäåāăąèéêëēėęìíîïīįòóôõöōøùúûüūçćčñńýÿśšźżłđÀÁÂÃÄÅĀĂĄÈÉÊËĒĖĘÌÍÎÏĪĮÒÓÔÕÖŌØÙÚÛÜŪÇĆČÑŃÝŸŚŠŹŻŁĐ',
    'aaaaaaaeeeeeeeiiiiiooooooouuuuucccnnyysszzldaaaaaaaeeeeeeeiiiiiooooooouuuuucccnnyysszzld'
  );
  sanitized := REGEXP_REPLACE(sanitized, '[^a-z0-9_.]', '', 'g');
  sanitized := SUBSTRING(sanitized, 1, 20);

  IF LENGTH(sanitized) < 3 THEN
    RETURN NULL;
  END IF;

  RETURN sanitized;
END;
$$;

COMMENT ON FUNCTION public.normalize_nickname(TEXT) IS
'Normaliza nickname: translitera acentos, remove espaços e caracteres inválidos.';

COMMIT;
