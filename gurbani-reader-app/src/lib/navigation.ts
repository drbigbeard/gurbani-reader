import { useCallback, useEffect, useRef, useState } from 'react';
import type { Screen } from '../types';

interface RouteState { screen: Screen; key: number; scrollY: number; }

export function useNavigation(initial: Screen = 'home') {
  const initialised = useRef(false);
  const [screen, setScreen] = useState<Screen>(initial);

  useEffect(() => {
    if (!initialised.current) {
      const existing = history.state as RouteState | null;
      if (!existing?.screen) history.replaceState({ screen: initial, key: Date.now(), scrollY: 0 } satisfies RouteState, '');
      else setScreen(existing.screen);
      initialised.current = true;
    }
    const onPop = (event: PopStateEvent) => {
      const route = event.state as RouteState | null;
      setScreen(route?.screen ?? initial);
      requestAnimationFrame(() => window.scrollTo({ top: route?.scrollY ?? 0, behavior: 'auto' }));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [initial]);

  const navigate = useCallback((next: Screen, replace = false) => {
    const current = (history.state ?? { screen, key: Date.now() }) as RouteState;
    history.replaceState({ ...current, screen, scrollY: window.scrollY } satisfies RouteState, '');
    const nextState = { screen: next, key: Date.now(), scrollY: 0 } satisfies RouteState;
    if (replace) history.replaceState(nextState, ''); else history.pushState(nextState, '');
    setScreen(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [screen]);

  return { screen, navigate, back: () => history.back() };
}
