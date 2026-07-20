'use client';

// Per-user, localStorage-backed expand/collapse state for the tree sidebar.
// Namespaced by signed-in user id — this is a multi-user SSO app, so a
// single global storage key would leak one user's expand state into another
// user's session on a shared browser profile.

import { useCallback, useState } from 'react';
import { useAuth } from '@/context/AuthContext';

function storageKey(userId: string | undefined) {
  return `vectra_tree_expanded_${userId ?? 'anon'}`;
}

export function useExpandedTreeNodes() {
  const { user } = useAuth();
  const key = storageKey(user?.id);

  const [expanded, setExpanded] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
    } catch {
      return new Set();
    }
  });

  const toggle = useCallback(
    (id: string) => {
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        try {
          window.localStorage.setItem(key, JSON.stringify(Array.from(next)));
        } catch {
          // Swallow quota/SSR errors — in-memory state remains authoritative.
        }
        return next;
      });
    },
    [key]
  );

  return { expanded, toggle };
}
