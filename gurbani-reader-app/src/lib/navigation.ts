import { App as NativeApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Screen } from '../types';

interface RouteState { screen: Screen; key: number; scrollY: number; depth: number; }
const validScreens = new Set<Screen>(['home','read','sabad','bani','search','word','browse','contributor','raag','tggsp','glossary','saved']);

export function useNavigation(initial: Screen = 'home') {
  const initialised = useRef(false);
  const lastRootBack = useRef(0);
  const [screen, setScreen] = useState<Screen>(initial);
  const [exitHint, setExitHint] = useState(false);

  const restore = useCallback((route: RouteState | null) => {
    const next = route?.screen && validScreens.has(route.screen) ? route.screen : initial;
    setScreen(next);
    requestAnimationFrame(() => window.scrollTo({ top: route?.scrollY ?? 0, behavior: 'auto' }));
  }, [initial]);

  useEffect(() => {
    if (!initialised.current) {
      const existing = history.state as RouteState | null;
      if (!existing?.screen || !validScreens.has(existing.screen)) {
        history.replaceState({ screen: initial, key: Date.now(), scrollY: 0, depth: 0 } satisfies RouteState, '');
      } else setScreen(existing.screen);
      initialised.current = true;
    }
    const onPop = (event: PopStateEvent) => restore(event.state as RouteState | null);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [initial, restore]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let remove: (() => Promise<void>) | undefined;
    void NativeApp.addListener('backButton', () => {
      const current = history.state as RouteState | null;
      if ((current?.depth ?? 0) > 0) {
        history.back();
        return;
      }
      const now = Date.now();
      if (now - lastRootBack.current < 1800) void NativeApp.exitApp();
      else {
        lastRootBack.current = now;
        setExitHint(true);
        window.setTimeout(() => setExitHint(false), 1800);
      }
    }).then(handle => { remove = () => handle.remove(); });
    return () => { void remove?.(); };
  }, []);

  const navigate = useCallback((next: Screen, replace = false) => {
    const current = (history.state ?? { screen, key: Date.now(), depth: 0 }) as RouteState;
    history.replaceState({ ...current, screen, scrollY: window.scrollY } satisfies RouteState, '');
    const nextState = { screen: next, key: Date.now(), scrollY: 0, depth: replace ? current.depth : current.depth + 1 } satisfies RouteState;
    if (replace) history.replaceState(nextState, ''); else history.pushState(nextState, '');
    setScreen(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [screen]);

  const back = useCallback(() => {
    const current = history.state as RouteState | null;
    if ((current?.depth ?? 0) > 0) history.back();
    else navigate('home', true);
  }, [navigate]);

  return { screen, navigate, back, exitHint };
}
