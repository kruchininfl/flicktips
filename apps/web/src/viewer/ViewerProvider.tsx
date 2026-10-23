'use client';

// The signed-in user for Client Components. The root layout passes what getViewer() returned during SSR;
// actions that change the session or the profile update it here and refresh the Server Components.
import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import type { ViewerProfile } from '@flicktips/shared';

import { api } from '@/api/browser';

interface ViewerContextValue {
  viewer: ViewerProfile | null;
  setViewer: (viewer: ViewerProfile | null) => void;
  // PATCH /api/me (the "hide viewed" filter), then re-render the server data that depends on it
  updateProfile: (data: { hide_viewed: boolean }) => Promise<void>;
  // POST /api/auth/logout; protected pages then redirect to /signin on the refresh
  logout: () => Promise<void>;
}

const ViewerContext = createContext<ViewerContextValue | null>(null);

export function ViewerProvider({
  initialViewer,
  children,
}: {
  initialViewer: ViewerProfile | null;
  children: ReactNode;
}) {
  const router = useRouter();
  const [viewer, setViewer] = useState(initialViewer);
  // a new server render (router.refresh, sign-in redirect) brings a new initial viewer
  const [prevInitial, setPrevInitial] = useState(initialViewer);
  if (prevInitial !== initialViewer) {
    setPrevInitial(initialViewer);
    setViewer(initialViewer);
  }

  const updateProfile = useCallback(
    async (data: { hide_viewed: boolean }) => {
      const response = await api.me.update({ hide_viewed: data.hide_viewed ? 1 : 0 });
      setViewer(response.data);
      router.refresh();
    },
    [router],
  );

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } finally {
      setViewer(null);
      router.refresh();
    }
  }, [router]);

  const value = useMemo(() => ({ viewer, setViewer, updateProfile, logout }), [viewer, updateProfile, logout]);
  return <ViewerContext.Provider value={value}>{children}</ViewerContext.Provider>;
}

function useViewerContext(): ViewerContextValue {
  const context = useContext(ViewerContext);
  if (!context) throw new Error('useViewer must be used inside <ViewerProvider>');
  return context;
}

// The signed-in user or null.
export function useViewer(): ViewerProfile | null {
  return useViewerContext().viewer;
}

// Actions on the session and the profile.
export function useViewerActions() {
  const { setViewer, updateProfile, logout } = useViewerContext();
  return { setViewer, updateProfile, logout };
}
