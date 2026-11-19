
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, UserCheck } from 'lucide-react';
import { UsersList, User } from './UsersList';
import { getFollowers, getFollowing } from './FollowersService';
import { useSecureUserUrls } from '@/services/userUrlObfuscation';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/modules/payments';
import { showProRequiredToast } from '@/utils/planRestrictions';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';

interface FollowersColumnProps {
  userId: string;
}

export const FollowersColumn: React.FC<FollowersColumnProps> = ({ userId }) => {
  const { user } = useAuth();
  const { isPro } = useSubscription();
  const [followers, setFollowers] = useState<User[]>([]);
  const [following, setFollowing] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { generateSecureUserUrl } = useSecureUserUrls();

  useEffect(() => {
    const loadFollowersData = async () => {
      setIsLoading(true);
      try {
        // Load followers and following in parallel
        const [followersData, followingData] = await Promise.all([
          getFollowers(userId),
          getFollowing(userId)
        ]);
        
        setFollowers(followersData);
        setFollowing(followingData);
      } catch (error) {
        devLog.error('Error loading followers/following data:', error);
        // Set empty arrays on error
        setFollowers([]);
        setFollowing([]);
      } finally {
        setIsLoading(false);
      }
    };

    if (userId) {
      loadFollowersData();
    }
  }, [userId]);

  const handleViewProfile = async (id: string) => {
    // Verificar se é perfil de outro usuário e se o usuário atual é Free
    const isOtherUserProfile = user && id !== user.id;
    if (isOtherUserProfile && !isPro) {
      showProRequiredToast(navigate, 'Visualizar Perfis de Outros Usuários');
      return;
    }

    try {
      const secureUrl = await generateSecureUserUrl(id, 'profile');
      navigate(secureUrl);
    } catch (error) {
      devLog.error('Erro ao gerar URL segura de usuário:', error);
      navigate('/comunidade');
    }
  };

  // Limitar para exatamente 6 usuários para exibição
  const displayFollowers = followers.slice(0, 6);
  const displayFollowing = following.slice(0, 6);

  return (
    <div className="space-y-1">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center">
            <Users className="h-4 w-4 mr-2 text-blue-500" />
            Seguidores ({followers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <UsersList
            title=""
            users={displayFollowers}
            isLoading={isLoading}
            emptyMessage="Nenhum seguidor ainda"
            icon={<></>}
            onViewProfile={handleViewProfile}
            onViewAll={async () => {
              try {
                const secureUrl = await generateSecureUserUrl(userId, 'followers');
                navigate(secureUrl);
              } catch (error) {
                devLog.error('Erro ao gerar URL segura:', error);
                navigate('/comunidade');
              }
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center">
            <UserCheck className="h-4 w-4 mr-2 text-green-500" />
            Seguindo ({following.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <UsersList
            title=""
            users={displayFollowing}
            isLoading={isLoading}
            emptyMessage="Não seguindo ninguém ainda"
            icon={<></>}
            onViewProfile={handleViewProfile}
            onViewAll={async () => {
              try {
                const secureUrl = await generateSecureUserUrl(userId, 'following');
                navigate(secureUrl);
              } catch (error) {
                devLog.error('Erro ao gerar URL segura:', error);
                navigate('/comunidade');
              }
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
};
