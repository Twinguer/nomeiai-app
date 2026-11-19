
import { supabase } from '@/integrations/supabase/client';
import { devLog, sanitizeForLog } from '@/utils/productionLogger';

export interface Follower {
  id: string;
  name: string;
  avatar_url?: string | null;
}

export const getFollowers = async (userId: string): Promise<Follower[]> => {
  try {
    const { data, error } = await supabase
      .rpc('get_followers_list', { target_user_id: userId });

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    devLog.error('Error fetching followers:', error);
    return [];
  }
};

export const getRandomUsers = async (count: number = 10, excludeUserId?: string): Promise<Follower[]> => {
  try {
    let query = supabase
      .from('public_profiles')
      .select('id, name, avatar_url')
      .limit(count);

    // If we need to exclude a user (e.g. the current user)
    if (excludeUserId) {
      query = query.neq('id', excludeUserId);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    devLog.error('Error fetching random users:', error);
    return [];
  }
};

export const getFollowing = async (userId: string): Promise<Follower[]> => {
  try {
    const { data, error } = await supabase
      .rpc('get_following_list', { target_user_id: userId });

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    devLog.error('Error fetching following:', error);
    return [];
  }
};

export const followUser = async (followerId: string, followedId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('user_followers')
      .insert({
        follower_id: followerId,
        followed_id: followedId
      });

    if (error) {
      throw error;
    }

    return true;
  } catch (error) {
    devLog.error('Error following user:', error);
    return false;
  }
};

export const unfollowUser = async (followerId: string, followedId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('user_followers')
      .delete()
      .eq('follower_id', followerId)
      .eq('followed_id', followedId);

    if (error) {
      throw error;
    }

    return true;
  } catch (error) {
    devLog.error('Error unfollowing user:', error);
    return false;
  }
};
