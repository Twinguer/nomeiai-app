import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MessageSquare, Reply, Image as ImageIcon, FileText, Download } from 'lucide-react';
import type { GroupPost, GroupComment } from '../../domain/types';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';
import { CommentSection } from './CommentSection';
import { getAvatarUrl } from '@/utils/avatarUtils';

interface PostCardProps {
  post: GroupPost;
  groupId: string;
  authorName?: string;
  authorAvatar?: string;
  onCommentAdded?: () => void;
}

export const PostCard: React.FC<PostCardProps> = ({
  post,
  groupId,
  authorName,
  authorAvatar,
  onCommentAdded,
}) => {
  const { user } = useAuth();
  const [showComments, setShowComments] = useState(false);
  const isAuthor = user?.id === post.author_id;

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  const timeAgo = formatDistanceToNow(new Date(post.created_at), {
    addSuffix: true,
    locale: ptBR,
  });

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={getAvatarUrl(authorAvatar)} alt={authorName} />
            <AvatarFallback>{getInitials(authorName)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-sm">
                {authorName || 'Usuário'}
              </p>
              {isAuthor && (
                <span className="text-xs text-muted-foreground">(Você)</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{timeAgo}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <p className="text-sm whitespace-pre-wrap break-words mb-4" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{post.content}</p>

        {/* Anexos */}
        {post.attachments && post.attachments.length > 0 && (
          <div className="mb-4 space-y-2">
            {post.attachments.map((attachment, index) => (
              <div key={index} className="border rounded-lg overflow-hidden">
                {attachment.type === 'image' ? (
                  <div className="relative">
                    <img
                      src={attachment.url}
                      alt={attachment.name}
                      className="w-full max-h-96 object-contain bg-muted"
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <div className="p-4 bg-muted/50 flex items-center gap-3">
                    <FileText className="h-8 w-8 text-red-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{attachment.name}</p>
                      <p className="text-xs text-muted-foreground">Documento PDF</p>
                    </div>
                    <a
                      href={attachment.url}
                      download={attachment.name}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                      >
                        <Download className="h-4 w-4" />
                        Baixar
                      </Button>
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-4 pt-3 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowComments(!showComments)}
            className="text-muted-foreground"
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            {post.comments_count || 0} comentários
          </Button>
        </div>

        {showComments && (
          <div className="mt-4 pt-4 border-t">
            <CommentSection
              postId={post.id}
              groupId={groupId}
              comments={
                post.comments && Array.isArray(post.comments) 
                  ? post.comments 
                  : []
              }
              onCommentAdded={onCommentAdded}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

