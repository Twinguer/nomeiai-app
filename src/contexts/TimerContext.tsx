import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { devLog } from '@/utils/productionLogger';
import {
  getPendingTimerTask,
  setTimerSuggestedMinutes,
} from '@/utils/timerTaskContext';

/** Renova study_started_at no servidor enquanto o timer está ativo (alinha com TTL de 10 min na RPC). */
const STUDYING_HEARTBEAT_INTERVAL_MS = 3 * 60 * 1000;

function suggestTimerMinutesForTask(sessionStartTime: Date | null): void {
  if (!sessionStartTime) return;

  const sessionDuration = Math.floor(
    (Date.now() - sessionStartTime.getTime()) / (1000 * 60)
  );
  if (sessionDuration < 1) return;

  const pending = getPendingTimerTask();
  if (pending) {
    setTimerSuggestedMinutes(pending.scheduleSessionId, sessionDuration);
  }
}

interface TimerContextType {
  minutes: number;
  seconds: number;
  isRunning: boolean;
  isPaused: boolean;
  initialMinutes: number;
  isStudying: boolean;
  startTimer: (minutes?: number) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  stopTimer: () => void;
  setInitialTime: (minutes: number) => void;
}

const TimerContext = createContext<TimerContextType | undefined>(undefined);

export const useTimer = () => {
  const context = useContext(TimerContext);
  if (!context) {
    throw new Error('useTimer must be used within a TimerProvider');
  }
  return context;
};

interface TimerProviderProps {
  children: ReactNode;
}

export const TimerProvider: React.FC<TimerProviderProps> = ({ children }) => {
  const { user } = useAuth();

  // Create user-specific localStorage keys
  const getStorageKey = (key: string) => {
    return user ? `timer-${user.id}-${key}` : `timer-guest-${key}`;
  };

  // Helper to build storage keys for a specific user (used on logout cleanup)
  const getUserStorageKey = (userId: string, key: string) => {
    return `timer-${userId}-${key}`;
  };

  // Load timer state from localStorage on mount with validation (user-specific)
  const [minutes, setMinutes] = useState(() => {
    const saved = localStorage.getItem(getStorageKey('minutes'));
    const parsed = saved ? parseInt(saved) : 60;
    return isNaN(parsed) ? 60 : parsed;
  });
  const [seconds, setSeconds] = useState(() => {
    const saved = localStorage.getItem(getStorageKey('seconds'));
    const parsed = saved ? parseInt(saved) : 0;
    return isNaN(parsed) ? 0 : parsed;
  });
  const [isRunning, setIsRunning] = useState(() => {
    const saved = localStorage.getItem(getStorageKey('isRunning'));
    return saved === 'true';
  });
  const [isPaused, setIsPaused] = useState(() => {
    const saved = localStorage.getItem(getStorageKey('isPaused'));
    return saved === 'true';
  });
  const [initialMinutes, setInitialMinutes] = useState(() => {
    const saved = localStorage.getItem(getStorageKey('initialMinutes'));
    const parsed = saved ? parseInt(saved) : 60;
    return isNaN(parsed) ? 60 : parsed;
  });
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(() => {
    const saved = localStorage.getItem(getStorageKey('sessionStartTime'));
    if (!saved) return null;
    const date = new Date(saved);
    return isNaN(date.getTime()) ? null : date;
  });
  
  // endTime state for localStorage persistence
  const [endTime, setEndTime] = useState<number | null>(() => {
    const saved = localStorage.getItem(getStorageKey('endTime'));
    return saved ? parseInt(saved) : null;
  });
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const endTimeRef = useRef<number | null>(endTime);
  const remainingSecondsRef = useRef<number>(initialMinutes * 60);
  const isRunningRef = useRef<boolean>(false);
  const isPausedRef = useRef<boolean>(false);
  const hasReconciledStudyingRef = useRef<string | null>(null);

  // Sync ref with state
  useEffect(() => {
    endTimeRef.current = endTime;
  }, [endTime]);

  // Keep running/paused refs in sync to avoid stale closures in event listeners
  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  const isStudying = isRunning && !isPaused;

  // Clear timer when user changes (logout/login)
  useEffect(() => {
    // Track previous user to detect logout
    const previousUserId = sessionStorage.getItem('previous_user_id');
    const currentUserId = user?.id || null;

    if (user) {
      // User logged in - load their timer state
      const savedMinutes = localStorage.getItem(getStorageKey('minutes'));
      const savedSeconds = localStorage.getItem(getStorageKey('seconds'));
      const savedIsRunning = localStorage.getItem(getStorageKey('isRunning'));
      const savedIsPaused = localStorage.getItem(getStorageKey('isPaused'));
      const savedInitialMinutes = localStorage.getItem(getStorageKey('initialMinutes'));
      const savedSessionStartTime = localStorage.getItem(getStorageKey('sessionStartTime'));

      if (savedMinutes) setMinutes(parseInt(savedMinutes));
      if (savedSeconds) setSeconds(parseInt(savedSeconds));
      if (savedIsRunning) setIsRunning(savedIsRunning === 'true');
      if (savedIsPaused) setIsPaused(savedIsPaused === 'true');
      if (savedInitialMinutes) setInitialMinutes(parseInt(savedInitialMinutes));
      if (savedSessionStartTime) {
        const date = new Date(savedSessionStartTime);
        if (!isNaN(date.getTime())) setSessionStartTime(date);
      }
      
      // Restore end time if exists for this user
      const savedEndTime = localStorage.getItem(getStorageKey('endTime'));
      if (savedEndTime) {
        const parsedEnd = parseInt(savedEndTime);
        if (!isNaN(parsedEnd)) setEndTime(parsedEnd);
      } else {
        setEndTime(null);
      }
      
      // Update session storage with current user
      sessionStorage.setItem('previous_user_id', currentUserId);
    } else if (previousUserId && !currentUserId) {
      // User logged out - stop timer and update database
      // Clear interval if running
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      
      // Update database to mark user as not studying
      const updateStatus = async () => {
        try {
          await supabase
            .from('users_profiles')
            .update({
              is_studying: false,
              study_started_at: null
            })
            .eq('id', previousUserId);
        } catch (error) {
          devLog.error('Error updating studying status on logout:', error);
        }
      };
      updateStatus();
      
      // Clear all timer state
      setIsRunning(false);
      setIsPaused(false);
      setMinutes(60);
      setSeconds(0);
      setInitialMinutes(60);
      setSessionStartTime(null);
      setEndTime(null);
      
      // Clear user-specific timer data from localStorage
      if (previousUserId) {
        const keys = ['minutes','seconds','isRunning','isPaused','sessionStartTime','endTime','initialMinutes'];
        keys.forEach((k) => localStorage.removeItem(getUserStorageKey(previousUserId, k)));
      }
      
      // Clear session storage
      sessionStorage.removeItem('previous_user_id');
    }
  }, [user]);

  // Save timer state to localStorage whenever it changes (user-specific)
  useEffect(() => {
    if (!isNaN(minutes) && minutes >= 0) {
      localStorage.setItem(getStorageKey('minutes'), minutes.toString());
    }
  }, [minutes, user]);

  useEffect(() => {
    if (!isNaN(seconds) && seconds >= 0) {
      localStorage.setItem(getStorageKey('seconds'), seconds.toString());
    }
  }, [seconds, user]);

  useEffect(() => {
    localStorage.setItem(getStorageKey('isRunning'), isRunning.toString());
  }, [isRunning, user]);

  useEffect(() => {
    localStorage.setItem(getStorageKey('isPaused'), isPaused.toString());
  }, [isPaused, user]);

  useEffect(() => {
    localStorage.setItem(getStorageKey('initialMinutes'), initialMinutes.toString());
  }, [initialMinutes, user]);

  useEffect(() => {
    if (sessionStartTime) {
      localStorage.setItem(getStorageKey('sessionStartTime'), sessionStartTime.toISOString());
    } else {
      localStorage.removeItem(getStorageKey('sessionStartTime'));
    }
  }, [sessionStartTime, user]);

  // Save endTime to localStorage when it changes
  useEffect(() => {
    if (endTime) {
      localStorage.setItem(getStorageKey('endTime'), endTime.toString());
    } else {
      localStorage.removeItem(getStorageKey('endTime'));
    }
  }, [endTime, user]);


  // Timer countdown logic using absolute end time (robust across tab switches)
  useEffect(() => {
    if (isRunning && !isPaused) {
      // Initialize end time if not set (e.g., after resume or refresh)
      if (!endTimeRef.current) {
        const newEnd = Date.now() + (minutes * 60 + seconds) * 1000;
        endTimeRef.current = newEnd;
        setEndTime(newEnd);
      }

      const tick = () => {
        if (!endTimeRef.current) return;
        const remaining = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000));
        const nextMinutes = Math.floor(remaining / 60);
        const nextSeconds = remaining % 60;
        
        // Validate values before setting
        if (!isNaN(nextMinutes) && !isNaN(nextSeconds)) {
          setMinutes(nextMinutes);
          setSeconds(nextSeconds);
        }

        if (remaining <= 0) {
          // Stop ticking
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }

          suggestTimerMinutesForTask(sessionStartTime);

          // Reset state
          setIsRunning(false);
          setIsPaused(false);
          setSessionStartTime(null);
          setEndTime(null);

          // Notification
          if (Notification.permission === 'granted') {
            new Notification('Timer Finalizado!', {
              body: 'Volte ao cronograma para confirmar e salvar seu registro.',
              icon: '/favicon-32.png'
            });
          } else {
            alert('Tempo esgotado! Volte ao cronograma para salvar seu registro.');
          }
          setMinutes(0);
          setSeconds(0);
        }
      };

      // Run an initial tick immediately
      tick();
      intervalRef.current = setInterval(tick, 1000);

      // Add Page Visibility API listener to handle tab switching
      const handleVisibilityChange = () => {
        if (!document.hidden) {
          // Tab became visible again - force recalculation
          tick();
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning, isPaused, initialMinutes, sessionStartTime]);

  // Ensure time is recalculated immediately when tab becomes visible or window gains focus
  useEffect(() => {
    const forceRecalc = () => {
      if (!isRunningRef.current || isPausedRef.current) return;

      // Restore endTime from storage if missing (e.g., after tab suspension)
      if (!endTimeRef.current) {
        const stored = localStorage.getItem(getStorageKey('endTime'));
        if (stored) {
          const parsed = parseInt(stored);
          if (!isNaN(parsed)) {
            endTimeRef.current = parsed;
            setEndTime(parsed);
          }
        }
      }
      if (!endTimeRef.current) return;

      const remaining = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000));
      setMinutes(Math.floor(remaining / 60));
      setSeconds(remaining % 60);

      if (remaining <= 0) {
        // Finalize immediately if time is up
        setIsRunning(false);
        setIsPaused(false);
        setSessionStartTime(null);
        setEndTime(null);
        setMinutes(0);
        setSeconds(0);
      }
    };

    const onFocusOrShow = () => forceRecalc();

    window.addEventListener('focus', onFocusOrShow);
    window.addEventListener('pageshow', onFocusOrShow as any);
    document.addEventListener('visibilitychange', onFocusOrShow);

    return () => {
      window.removeEventListener('focus', onFocusOrShow);
      window.removeEventListener('pageshow', onFocusOrShow as any);
      document.removeEventListener('visibilitychange', onFocusOrShow);
    };
  }, []);

  // Request notification permission when timer starts
  useEffect(() => {
    if (isRunning && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [isRunning]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Update database when studying status changes
  const updateStudyingStatus = async (studying: boolean) => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('users_profiles')
        .update({
          is_studying: studying,
          study_started_at: studying ? new Date().toISOString() : null,
        })
        .eq('id', user.id);

      if (error) {
        devLog.error('Error updating studying status:', error);
      }
    } catch (error) {
      devLog.error('Error updating studying status:', error);
    }
  };

  const refreshStudyingHeartbeat = async () => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('users_profiles')
        .update({ study_started_at: new Date().toISOString() })
        .eq('id', user.id)
        .eq('is_studying', true);

      if (error) {
        devLog.error('Error refreshing studying heartbeat:', error);
      }
    } catch (error) {
      devLog.error('Error refreshing studying heartbeat:', error);
    }
  };

  // Sincroniza flag stale no banco após restaurar estado do localStorage no login
  useEffect(() => {
    if (!user?.id) {
      hasReconciledStudyingRef.current = null;
      return;
    }

    if (hasReconciledStudyingRef.current === user.id) return;

    const reconcileTimer = window.setTimeout(() => {
      const shouldBeStudying = isRunningRef.current && !isPausedRef.current;
      void updateStudyingStatus(shouldBeStudying);
      hasReconciledStudyingRef.current = user.id;
    }, 0);

    return () => window.clearTimeout(reconcileTimer);
  }, [user?.id]);

  // Effect to update database when studying status changes
  useEffect(() => {
    updateStudyingStatus(isStudying);
  }, [isStudying, user?.id]);

  // Mantém study_started_at fresco durante sessões longas de timer
  useEffect(() => {
    if (!isStudying || !user?.id) return;

    const heartbeatTimer = window.setInterval(() => {
      void refreshStudyingHeartbeat();
    }, STUDYING_HEARTBEAT_INTERVAL_MS);

    return () => window.clearInterval(heartbeatTimer);
  }, [isStudying, user?.id]);

  const startTimer = (mins?: number) => {
    const startMins = mins ?? initialMinutes;
    if (mins) {
      setInitialMinutes(mins);
    }
    // Reset time state
    setMinutes(startMins);
    setSeconds(0);

    // Configure end time based on absolute clock
    const newEndTime = Date.now() + startMins * 60 * 1000;
    setEndTime(newEndTime);
    remainingSecondsRef.current = startMins * 60;

    setIsRunning(true);
    setIsPaused(false);
    setSessionStartTime(new Date());
  };

  const pauseTimer = () => {
    // Capture remaining time when pausing
    remainingSecondsRef.current = minutes * 60 + seconds;
    setEndTime(null);
    setIsPaused(true);
  };

  const resumeTimer = () => {
    // Restore end time from remaining seconds
    const remaining = remainingSecondsRef.current ?? minutes * 60 + seconds;
    const newEndTime = Date.now() + remaining * 1000;
    setEndTime(newEndTime);
    setIsPaused(false);
  };

  const stopTimer = () => {
    suggestTimerMinutesForTask(sessionStartTime);

    // Clear ticking
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setEndTime(null);

    setIsRunning(false);
    setIsPaused(false);
    setMinutes(initialMinutes);
    setSeconds(0);
    setSessionStartTime(null);

    // Clear localStorage when timer is stopped (user-specific)
    localStorage.removeItem(getStorageKey('minutes'));
    localStorage.removeItem(getStorageKey('seconds'));
    localStorage.removeItem(getStorageKey('isRunning'));
    localStorage.removeItem(getStorageKey('isPaused'));
    localStorage.removeItem(getStorageKey('sessionStartTime'));
    localStorage.removeItem(getStorageKey('endTime'));
  };

  const setInitialTime = (mins: number) => {
    setInitialMinutes(mins);
    if (!isRunning) {
      setMinutes(mins);
      setSeconds(0);
    }
  };


  return (
    <TimerContext.Provider
      value={{
        minutes,
        seconds,
        isRunning,
        isPaused,
        initialMinutes,
        isStudying,
        startTimer,
        pauseTimer,
        resumeTimer,
        stopTimer,
        setInitialTime,
      }}
    >
      {children}
    </TimerContext.Provider>
  );
};
