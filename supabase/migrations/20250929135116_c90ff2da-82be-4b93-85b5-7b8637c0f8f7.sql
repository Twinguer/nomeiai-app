-- Criar tabela de notificações
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'general',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Usuários podem ver suas próprias notificações"
ON public.notifications
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Sistema pode inserir notificações"
ON public.notifications
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Usuários podem atualizar suas próprias notificações"
ON public.notifications
FOR UPDATE
USING (auth.uid() = user_id);

-- Função para criar notificações quando usuário entra em ranking
CREATE OR REPLACE FUNCTION public.notify_ranking_participants()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_concurso_title TEXT;
  v_new_user_name TEXT;
  v_participant RECORD;
BEGIN
  -- Buscar título do concurso
  SELECT titulo INTO v_concurso_title
  FROM concursos
  WHERE id = NEW.concurso_id;
  
  -- Buscar nome do novo usuário
  SELECT name INTO v_new_user_name
  FROM users_profiles
  WHERE id = NEW.user_id;
  
  -- Notificar todos os outros participantes
  FOR v_participant IN
    SELECT DISTINCT user_id
    FROM user_rankings
    WHERE concurso_id = NEW.concurso_id
    AND user_id != NEW.user_id
  LOOP
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      metadata
    ) VALUES (
      v_participant.user_id,
      'new_participant',
      'Novo participante no ranking',
      format('Um novo participante (%s) foi cadastrado no ranking %s', 
             COALESCE(v_new_user_name, 'Usuário'), 
             COALESCE(v_concurso_title, 'Concurso')),
      jsonb_build_object(
        'concurso_id', NEW.concurso_id,
        'new_user_id', NEW.user_id,
        'concurso_title', v_concurso_title,
        'new_user_name', v_new_user_name
      )
    );
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Trigger para notificar quando usuário entra em ranking
CREATE TRIGGER trigger_notify_ranking_participants
  AFTER INSERT ON user_rankings
  FOR EACH ROW
  EXECUTE FUNCTION notify_ranking_participants();

-- Função para contar notificações não lidas
CREATE OR REPLACE FUNCTION public.count_unread_notifications(p_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM notifications
  WHERE user_id = p_user_id AND is_read = false;
$$;

-- Função para administradores enviarem notificações
CREATE OR REPLACE FUNCTION public.admin_send_notification(
  p_target_type TEXT,
  p_target_id UUID,
  p_title TEXT,
  p_message TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar se usuário é admin
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN FALSE;
  END IF;

  -- Log da ação administrativa
  INSERT INTO security_logs (user_id, action, details)
  VALUES (auth.uid(), 'admin_send_notification', jsonb_build_object(
    'target_type', p_target_type,
    'target_id', p_target_id,
    'title', p_title
  ));

  IF p_target_type = 'all' THEN
    -- Enviar para todos os usuários
    INSERT INTO notifications (user_id, type, title, message, metadata)
    SELECT 
      up.id,
      'admin_broadcast',
      p_title,
      p_message,
      jsonb_build_object('sent_by_admin', auth.uid())
    FROM users_profiles up;
    
  ELSIF p_target_type = 'ranking' THEN
    -- Enviar para usuários de um ranking específico
    INSERT INTO notifications (user_id, type, title, message, metadata)
    SELECT 
      ur.user_id,
      'admin_ranking',
      p_title,
      p_message,
      jsonb_build_object(
        'sent_by_admin', auth.uid(),
        'concurso_id', p_target_id
      )
    FROM user_rankings ur
    WHERE ur.concurso_id = p_target_id;
    
  ELSIF p_target_type = 'user' THEN
    -- Enviar para usuário específico
    INSERT INTO notifications (user_id, type, title, message, metadata)
    VALUES (
      p_target_id,
      'admin_direct',
      p_title,
      p_message,
      jsonb_build_object('sent_by_admin', auth.uid())
    );
  END IF;
  
  RETURN TRUE;
END;
$$;