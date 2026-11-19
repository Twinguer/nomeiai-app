-- Ranking provisório: helpers e RPCs de voto/consenso

-- Achata respostas { booklet: { section: { q: answer } } } → { q: answer }
CREATE OR REPLACE FUNCTION public.flatten_user_booklet_answers(
  p_answers jsonb,
  p_booklet_id text
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_result jsonb := '{}'::jsonb;
  v_section_key text;
  v_q text;
BEGIN
  IF p_answers IS NULL OR p_booklet_id IS NULL OR NOT (p_answers ? p_booklet_id) THEN
    RETURN v_result;
  END IF;

  FOR v_section_key IN SELECT jsonb_object_keys(p_answers->p_booklet_id)
  LOOP
    IF jsonb_typeof(p_answers->p_booklet_id->v_section_key) = 'object' THEN
      FOR v_q IN SELECT jsonb_object_keys(p_answers->p_booklet_id->v_section_key)
      LOOP
        v_result := jsonb_set(
          v_result,
          ARRAY[v_q],
          to_jsonb(trim(both from p_answers->p_booklet_id->v_section_key->>v_q))
        );
      END LOOP;
    END IF;
  END LOOP;

  RETURN v_result;
END;
$$;

-- Gabarito ativo para pontuação (provisório ou oficial)
CREATE OR REPLACE FUNCTION public.get_active_gabarito_answers(
  p_concurso_id uuid,
  p_booklet_id text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_official jsonb;
  v_provisional jsonb;
  v_source jsonb;
BEGIN
  SELECT gabarito_status, official_answers, provisional_answers
  INTO v_status, v_official, v_provisional
  FROM concursos
  WHERE id = p_concurso_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_status := COALESCE(v_status, 'consensus');

  IF v_status IN ('preliminary', 'final') THEN
    v_source := v_official;
  ELSIF v_status = 'consensus' THEN
    IF v_provisional IS NOT NULL AND v_provisional <> '{}'::jsonb THEN
      v_source := v_provisional;
    ELSE
      v_source := NULL;
    END IF;
  ELSE
    v_source := v_official;
  END IF;

  IF v_source IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN COALESCE(
    v_source->p_booklet_id->'answers',
    v_source->p_booklet_id->'questions'
  );
END;
$$;

-- Registra delta de voto em uma questão (regra: empate mantém líder)
CREATE OR REPLACE FUNCTION public.register_answer_vote(
  p_concurso_id uuid,
  p_booklet_id text,
  p_question_number integer,
  p_old_answer text,
  p_new_answer text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old text;
  v_new text;
  v_leader_answer text;
  v_leader_votes integer;
  v_top_answer text;
  v_top_count integer;
  v_leader_changed boolean := false;
  v_gabarito_status text;
BEGIN
  SELECT gabarito_status INTO v_gabarito_status
  FROM concursos WHERE id = p_concurso_id;

  IF NOT FOUND OR v_gabarito_status <> 'consensus' THEN
    RETURN jsonb_build_object('leader_changed', false, 'skipped', true);
  END IF;

  v_old := NULLIF(upper(trim(both from COALESCE(p_old_answer, ''))), '');
  v_new := NULLIF(upper(trim(both from COALESCE(p_new_answer, ''))), '');

  IF v_old IS NOT DISTINCT FROM v_new THEN
    RETURN jsonb_build_object('leader_changed', false);
  END IF;

  IF v_old IS NOT NULL THEN
    UPDATE ranking_answer_votes
    SET vote_count = vote_count - 1
    WHERE concurso_id = p_concurso_id
      AND booklet_id = p_booklet_id
      AND question_number = p_question_number
      AND answer = v_old;

    DELETE FROM ranking_answer_votes
    WHERE concurso_id = p_concurso_id
      AND booklet_id = p_booklet_id
      AND question_number = p_question_number
      AND answer = v_old
      AND vote_count <= 0;
  END IF;

  IF v_new IS NOT NULL THEN
    INSERT INTO ranking_answer_votes (concurso_id, booklet_id, question_number, answer, vote_count)
    VALUES (p_concurso_id, p_booklet_id, p_question_number, v_new, 1)
    ON CONFLICT (concurso_id, booklet_id, question_number, answer)
    DO UPDATE SET vote_count = ranking_answer_votes.vote_count + 1;
  END IF;

  SELECT answer, vote_count
  INTO v_top_answer, v_top_count
  FROM ranking_answer_votes
  WHERE concurso_id = p_concurso_id
    AND booklet_id = p_booklet_id
    AND question_number = p_question_number
  ORDER BY vote_count DESC, answer ASC
  LIMIT 1;

  SELECT leader_answer, leader_votes
  INTO v_leader_answer, v_leader_votes
  FROM provisional_gabarito_leaders
  WHERE concurso_id = p_concurso_id
    AND booklet_id = p_booklet_id
    AND question_number = p_question_number;

  IF v_top_answer IS NULL THEN
    DELETE FROM provisional_gabarito_leaders
    WHERE concurso_id = p_concurso_id
      AND booklet_id = p_booklet_id
      AND question_number = p_question_number;
    RETURN jsonb_build_object('leader_changed', false);
  END IF;

  IF v_leader_answer IS NULL THEN
    INSERT INTO provisional_gabarito_leaders (
      concurso_id, booklet_id, question_number, leader_answer, leader_votes, updated_at
    ) VALUES (
      p_concurso_id, p_booklet_id, p_question_number, v_top_answer, v_top_count, now()
    );
    v_leader_changed := true;
  ELSE
    SELECT vote_count INTO v_leader_votes
    FROM ranking_answer_votes
    WHERE concurso_id = p_concurso_id
      AND booklet_id = p_booklet_id
      AND question_number = p_question_number
      AND answer = v_leader_answer;

    v_leader_votes := COALESCE(v_leader_votes, 0);

    IF v_top_count > v_leader_votes THEN
      UPDATE provisional_gabarito_leaders
      SET leader_answer = v_top_answer,
          leader_votes = v_top_count,
          updated_at = now()
      WHERE concurso_id = p_concurso_id
        AND booklet_id = p_booklet_id
        AND question_number = p_question_number;
      v_leader_changed := true;
    ELSE
      UPDATE provisional_gabarito_leaders
      SET leader_votes = v_leader_votes,
          updated_at = now()
      WHERE concurso_id = p_concurso_id
        AND booklet_id = p_booklet_id
        AND question_number = p_question_number;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'leader_changed', v_leader_changed,
    'question_number', p_question_number,
    'leader_answer', COALESCE(v_leader_answer, v_top_answer)
  );
END;
$$;

-- Sincroniza votos comparando respostas antigas vs novas
CREATE OR REPLACE FUNCTION public.sync_consensus_votes_for_booklet(
  p_concurso_id uuid,
  p_booklet_id text,
  p_old_answers jsonb,
  p_new_answers jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_flat jsonb;
  v_new_flat jsonb;
  v_all_keys text[];
  v_q text;
  v_old_a text;
  v_new_a text;
  v_qnum integer;
  v_result jsonb;
  v_any_leader_changed boolean := false;
BEGIN
  v_old_flat := flatten_user_booklet_answers(p_old_answers, p_booklet_id);
  v_new_flat := flatten_user_booklet_answers(p_new_answers, p_booklet_id);

  SELECT array_agg(DISTINCT k)
  INTO v_all_keys
  FROM (
    SELECT jsonb_object_keys(v_old_flat) AS k
    UNION
    SELECT jsonb_object_keys(v_new_flat) AS k
  ) s;

  IF v_all_keys IS NULL THEN
    RETURN jsonb_build_object('leader_changed', false);
  END IF;

  FOREACH v_q IN ARRAY v_all_keys
  LOOP
    v_qnum := v_q::integer;
    v_old_a := NULLIF(v_old_flat->>v_q, '');
    v_new_a := NULLIF(v_new_flat->>v_q, '');

    IF v_old_a IS DISTINCT FROM v_new_a THEN
      v_result := register_answer_vote(
        p_concurso_id, p_booklet_id, v_qnum, v_old_a, v_new_a
      );
      IF COALESCE((v_result->>'leader_changed')::boolean, false) THEN
        v_any_leader_changed := true;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('leader_changed', v_any_leader_changed);
END;
$$;

-- Reconstrói provisional_answers JSONB a partir dos líderes
CREATE OR REPLACE FUNCTION public.rebuild_provisional_gabarito(p_concurso_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_leader record;
  v_booklet_answers jsonb;
  v_provisional jsonb := '{}'::jsonb;
  v_official jsonb;
  v_exam_type text;
  v_question_type text;
  v_template jsonb;
  v_entry jsonb;
  v_count integer := 0;
BEGIN
  SELECT official_answers, exam_type
  INTO v_official, v_exam_type
  FROM concursos WHERE id = p_concurso_id;

  v_question_type := CASE WHEN v_exam_type = 'Certo ou Errado' THEN 'TRUE_FALSE' ELSE 'MULTIPLE_CHOICE' END;

  FOR v_leader IN
    SELECT booklet_id, question_number, leader_answer, leader_votes
    FROM provisional_gabarito_leaders
    WHERE concurso_id = p_concurso_id
    ORDER BY booklet_id, question_number
  LOOP
    v_template := COALESCE(
      v_official->v_leader.booklet_id->'answers'->(v_leader.question_number::text),
      v_official->v_leader.booklet_id->'questions'->(v_leader.question_number::text),
      '{}'::jsonb
    );

    v_entry := jsonb_build_object(
      'correct_answer', v_leader.leader_answer,
      'weight', COALESCE((v_template->>'weight')::numeric, 1),
      'section_type', COALESCE(v_template->>'section_type', 'default'),
      'is_nullified', COALESCE((v_template->>'is_nullified')::boolean, false),
      'answer_format', COALESCE(v_template->>'answer_format', 'OBJECTIVE'),
      'question_type', COALESCE(v_template->>'question_type', v_question_type),
      'consensus_votes', v_leader.leader_votes
    );

    IF NOT (v_provisional ? v_leader.booklet_id) THEN
      v_provisional := jsonb_set(
        v_provisional,
        ARRAY[v_leader.booklet_id],
        jsonb_build_object('answers', '{}'::jsonb, 'metadata', jsonb_build_object('source', 'consensus', 'last_updated', now()))
      );
    END IF;

    v_booklet_answers := v_provisional->v_leader.booklet_id->'answers';
    v_booklet_answers := jsonb_set(v_booklet_answers, ARRAY[v_leader.question_number::text], v_entry);
    v_provisional := jsonb_set(
      v_provisional,
      ARRAY[v_leader.booklet_id, 'answers'],
      v_booklet_answers
    );
    v_count := v_count + 1;
  END LOOP;

  UPDATE concursos
  SET provisional_answers = v_provisional,
      updated_at = now()
  WHERE id = p_concurso_id;

  RETURN jsonb_build_object('success', true, 'questions_built', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.flatten_user_booklet_answers(jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_gabarito_answers(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_answer_vote(uuid, text, integer, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_consensus_votes_for_booklet(uuid, text, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rebuild_provisional_gabarito(uuid) TO authenticated;
