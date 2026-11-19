import { useQuery } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/useDebounce';
import { communityProfileService } from '../services/communityProfileService';

export function useCommunityUsers(searchQuery: string = '') {
  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['community-users', debouncedSearchQuery],
    queryFn: async () => {
      const trimmedSearch = debouncedSearchQuery?.trim();
      const searchParam = trimmedSearch ? trimmedSearch : null;
      return communityProfileService.fetchPublicProfiles(searchParam);
    },
    staleTime: 0,
    cacheTime: 0,
  });

  return {
    users: data || [],
    isLoading,
    isError,
    refetch,
  };
}
