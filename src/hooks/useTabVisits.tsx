import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

interface TabVisits {
  feed: number;
  crm: number;
  projects: number;
  messages: number;
}

const STORAGE_KEY = 'tab-last-visits';

export function useTabVisits() {
  const location = useLocation();
  const [lastVisits, setLastVisits] = useState<TabVisits>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return {
          feed: 0,
          crm: 0,
          projects: 0,
          messages: 0,
        };
      }
    }
    return {
      feed: 0,
      crm: 0,
      projects: 0,
      messages: 0,
    };
  });

  // Update last visit timestamp when navigating to a tab
  useEffect(() => {
    const now = Date.now();
    const updates: Partial<TabVisits> = {};

    if (location.pathname === '/feed') {
      updates.feed = now;
    } else if (location.pathname === '/crm') {
      updates.crm = now;
    } else if (location.pathname === '/projects') {
      updates.projects = now;
    } else if (location.pathname === '/messages') {
      updates.messages = now;
    }

    if (Object.keys(updates).length > 0) {
      const newVisits = { ...lastVisits, ...updates };
      setLastVisits(newVisits);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newVisits));
    }
  }, [location.pathname]);

  return lastVisits;
}
