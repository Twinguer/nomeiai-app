
import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { User, Upload, Loader2, Pen, Clock } from 'lucide-react';
import { useStudyStatistics } from '@/modules/statistics';
import { getAvatarUrl } from '@/utils/avatarUtils';
import { formatPublicNicknameHandle } from '@/utils/nicknameUtils';

interface ProfileHeaderProps {
  name: string;
  email: string;
  avatarUrl: string | null;
  uploading: boolean;
  handleAvatarUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  statusConcurseiro: string;
  profileText?: string;
  isCoach?: boolean;
  nickname?: string;
}

const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  name,
  email,
  avatarUrl,
  uploading,
  handleAvatarUpload,
  statusConcurseiro,
  profileText,
  isCoach,
  nickname
}) => {
  const { statistics } = useStudyStatistics();
  
  const getInitials = (name: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  const formatHours = (hours: number) => {
    return hours.toFixed(1) + 'h';
  };

  const publicNicknameHandle = formatPublicNicknameHandle(nickname);

  return (
    <div className="flex flex-col items-center space-y-4">
      <Avatar className="h-32 w-32" style={{ boxShadow: '0 8px 20px rgba(0, 0, 0, 0.5), 0 4px 8px rgba(0, 0, 0, 0.4), 0 2px 4px rgba(0, 0, 0, 0.3)' }}>
        <AvatarImage src={getAvatarUrl(avatarUrl)} alt={name} />
        <AvatarFallback className="text-3xl">
          {name ? getInitials(name) : <User className="h-12 w-12" />}
        </AvatarFallback>
      </Avatar>
      
      <div className="text-center">
        <h2 className="text-xl font-bold">{name || 'Usuário'}</h2>
        {publicNicknameHandle && (
          <p className="text-sm text-muted-foreground">{publicNicknameHandle}</p>
        )}
        <p className="text-sm text-muted-foreground">{email}</p>
        
        <div className="flex flex-col items-center gap-2 mt-2">
          {isCoach && (
            <Badge className="bg-purple-100 text-purple-800 border-purple-300 hover:bg-purple-200">
              Coach
            </Badge>
          )}
          {statistics.totalHours > 0 && (
            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
              <Clock className="h-3 w-3 mr-1" />
              {formatHours(statistics.totalHours)} estudadas
            </Badge>
          )}
        </div>
        
        <div className="mt-2">
          <Label htmlFor="avatar" className="cursor-pointer text-sm text-blue-600 hover:text-blue-800">
            {uploading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Enviando...
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Alterar foto
              </div>
            )}
          </Label>
          <Input 
            id="avatar" 
            type="file" 
            className="hidden" 
            onChange={handleAvatarUpload}
            accept="image/*"
            disabled={uploading}
          />
        </div>
      </div>
      
      <Separator />
      
      <div className="w-full space-y-2">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <Pen className="h-4 w-4 mr-2 text-purple-500" />
            <span className="text-sm">Status</span>
          </div>
          <span className="text-sm font-semibold">{statusConcurseiro}</span>
        </div>
        
        {profileText && (
          <div className="mt-3 text-sm text-center py-2 px-3 bg-muted text-muted-foreground border border-border rounded-md italic">
            &ldquo;{profileText}&rdquo;
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileHeader;
