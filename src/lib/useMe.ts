'use client';

import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/client';
import type { Role } from '@/domain/types';

export interface Me {
  id: string;
  role: Role;
  name: string;
  points: number;
  phoneTail: string;
}

export function useMe(): { me: Me | null; loading: boolean; refresh: () => void } {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    apiGet<{ user: Me | null }>('/api/auth/me')
      .then((d) => {
        if (alive) setMe(d.user);
      })
      .catch(() => {
        if (alive) setMe(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [tick]);

  return { me, loading, refresh: () => setTick((t) => t + 1) };
}
