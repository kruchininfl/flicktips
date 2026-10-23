'use client';

// Shell-wide UI state that the legacy site kept in the redux `app` reducer: the sign-in popup and the header
// search (both opened from the header and from the phone tab bar), plus the top loading bar.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { UNAUTHORIZED_EVENT } from '@/api/browser';

interface UiContextValue {
  signInOpen: boolean;
  openSignIn: () => void;
  closeSignIn: () => void;
  searchOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;
  // pending loads shown by the loading bar (components/shell/LoadingBar)
  loading: number;
  startLoading: () => void;
  doneLoading: () => void;
}

const UiContext = createContext<UiContextValue | null>(null);

export function UiProvider({ children }: { children: ReactNode }) {
  const [signInOpen, setSignInOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [loading, setLoading] = useState(0);

  const openSignIn = useCallback(() => setSignInOpen(true), []);
  const closeSignIn = useCallback(() => setSignInOpen(false), []);
  const openSearch = useCallback(() => setSearchOpen(true), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  const startLoading = useCallback(() => setLoading((n) => n + 1), []);
  const doneLoading = useCallback(() => setLoading((n) => Math.max(0, n - 1)), []);

  // a 401 from the browser API client asks the visitor to sign in, as the legacy api.js did
  useEffect(() => {
    window.addEventListener(UNAUTHORIZED_EVENT, openSignIn);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, openSignIn);
  }, [openSignIn]);

  const value = useMemo(
    () => ({
      signInOpen,
      openSignIn,
      closeSignIn,
      searchOpen,
      openSearch,
      closeSearch,
      loading,
      startLoading,
      doneLoading,
    }),
    [signInOpen, openSignIn, closeSignIn, searchOpen, openSearch, closeSearch, loading, startLoading, doneLoading],
  );
  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi(): UiContextValue {
  const context = useContext(UiContext);
  if (!context) throw new Error('useUi must be used inside <UiProvider>');
  return context;
}
