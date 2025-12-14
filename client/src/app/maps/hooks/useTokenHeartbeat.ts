'use client';

import { useEffect, useCallback } from 'react';
import { isTokenExpiring, refreshToken } from '@/services/auth';

export const useTokenHeartbeat = ({ onRefreshStart, onRefreshEnd }: { onRefreshStart?: () => void; onRefreshEnd?: () => void } = {}) => {
  const checkAndRefreshToken = useCallback(async () => {
    if (isTokenExpiring()) {
      onRefreshStart?.();
      try {
        await refreshToken();
      } finally {
        onRefreshEnd?.();
      }
    }
  }, [onRefreshStart, onRefreshEnd]);

  useEffect(() => {
    checkAndRefreshToken();
    const interval = setInterval(checkAndRefreshToken, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [checkAndRefreshToken]);
};

export type UseTokenHeartbeatReturn = ReturnType<typeof useTokenHeartbeat>;

