import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MessageSquare, Send } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { useAddComment } from '../../hooks/useGroupPosts';
import type { GroupComment } from '../../domain/types';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { logError } from '@/utils/secureLogger';
import { useToast } from '@/hooks/use-toast';
import { getAvatarUrl } from '@/utils/avatarUtils';
import { renderContentWithMentions } from '../../domain/mentionUtils';
import { validateGroupContent } from '../../domain/groupContentSecurity';

interface CommentSectionProps {
  postId: string;
  groupId: string;
  comments: GroupComment[];
  onCommentAdded?: () => void;
}

export const CommentSection: React.FC<CommentSectionProps> = ({
  postId,
  groupId,
  comments,
  onCommentAdded,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const addComment = useAddComment();
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const MAX_COMMENT_LENGTH = 500; // Limite de caracteres para comentários

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !user) return;

    const contentValidation = validateGroupContent(commentText);
    if (!contentValidation.ok) {
      toast({
        title: 'Comentário inválido',
        description: contentValidation.error,
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await addComment.mutateAsync({
        groupId,
        postId,
        content: contentValidation.value,
      });
      
      setCommentText('');
      
      // Invalidar queries para forçar atualização
      queryClient.invalidateQueries({ queryKey: ['group-feed', groupId] });
      queryClient.invalidateQueries({ queryKey: ['study-group', groupId] });
      
      if (onCommentAdded) {
        onCommentAdded();
      }
    } catch (error) {
      logError('Erro ao adicionar comentário', error, 'STUDY_GROUPS');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Organizar comentários (principais e respostas)
  const commentsArray = Array.isArray(comments) ? comments : [];
  const mainComments = commentsArray.filter(c => !c.parent_comment_id);
  const getReplies = (commentId: string) =>
    commentsArray.filter(c => c.parent_comment_id === commentId);

  return (
    <div className="space-y-4">
      {/* Lista de comentários */}
      {mainComments.length > 0 ? (
        <div className="space-y-3">
          {mainComments.map((comment) => {
            const replies = getReplies(comment.id);
            return (
              <CommentItem
                key={comment.id}
                comment={comment}
                replies={replies}
                postId={postId}
                groupId={groupId}
                onCommentAdded={onCommentAdded}
              />
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4">
          Nenhum comentário ainda. Seja o primeiro!
        </p>
      )}

      {/* Formulário de comentário */}
      {user && (
        <form onSubmit={handleSubmit} className="space-y-2">
          <div className="space-y-1">
            <Textarea
              value={commentText}
              onChange={(e) => {
                const newValue = e.target.value;
                if (newValue.length <= MAX_COMMENT_LENGTH) {
                  setCommentText(newValue);
                }
              }}
              placeholder="Escreva um comentário... Use @nickname para mencionar"
              rows={3}
              maxLength={MAX_COMMENT_LENGTH}
              className="resize-none"
            />
            <div className="flex justify-end">
              <span className={`text-xs ${commentText.length >= MAX_COMMENT_LENGTH ? 'text-destructive' : 'text-muted-foreground'}`}>
                {commentText.length}/{MAX_COMMENT_LENGTH} caracteres
              </span>
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              type="submit"
              size="sm"
              disabled={!commentText.trim() || isSubmitting || commentText.length > MAX_COMMENT_LENGTH}
            >
              <Send className="h-4 w-4 mr-2" />
              {isSubmitting ? 'Enviando...' : 'Comentar'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
};

interface CommentItemProps {
  comment: GroupComment;
  replies: GroupComment[];
  postId: string;
  groupId: string;
  onCommentAdded?: () => void;
}

const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  replies,
  postId,
  groupId,
  onCommentAdded,
}) => {
  const timeAgo = formatDistanceToNow(new Date(comment.created_at), {
    addSuffix: true,
    locale: ptBR,
  });

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Avatar className="h-8 w-8">
          <AvatarImage src={getAvatarUrl(comment.author_avatar)} alt={comment.author_name || 'Usuário'} />
          <AvatarFallback>{getInitials(comment.author_name)}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="bg-muted rounded-lg p-3">
            <p className="text-xs font-semibold mb-1 text-muted-foreground">
              {comment.author_name || 'Usuário'}
            </p>
            <p className="text-sm whitespace-pre-wrap break-words" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
              {renderContentWithMentions(comment.content)}
            </p>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{timeAgo}</p>
        </div>
      </div>

      {/* Respostas */}
      {replies.length > 0 && (
        <div className="ml-10 space-y-2 border-l-2 pl-4">
          {replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              replies={[]}
              postId={postId}
              groupId={groupId}
              onCommentAdded={onCommentAdded}
            />
          ))}
        </div>
      )}
    </div>
  );
};

