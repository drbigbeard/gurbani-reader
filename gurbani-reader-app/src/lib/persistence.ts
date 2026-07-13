import { useCallback, useEffect, useState } from 'react';
import { personalStoreSupported, readPersonalState, writePersonalState } from './personal-store';
import type { SearchFilters, SearchMode } from '../types';

export interface ReaderPreferences {
  showTransliteration: boolean;
  showTranslation: boolean;
  showProviderLayers: boolean;
  theme: 'light' | 'paper' | 'sepia' | 'dark' | 'black';
  textScale: number;
  transliterationScale: number;
  interpretationScale: number;
  lineSpacing: number;
  wordMode: boolean;
  readerMode: 'reading' | 'study';
  providerLayerVisibility: Record<string, boolean>;
  gurmukhiColor: string;
  latinColor: string;
  backgroundColor: string;
}

export interface PersonalData {
  bookmarks: string[];
  notes: Record<string, string>;
  savedTerms: string[];
  readingPosition: string | null;
  collections: PersonalCollection[];
  history: ReadingHistoryEntry[];
  savedSearches: SavedSearch[];
}

export interface PersonalCollection { id: string; title: string; lineIds: string[]; createdAt: string; }
export interface ReadingHistoryEntry { textUnitId: string; lineId: string | null; visitedAt: string; }
export interface SavedSearch { id: string; title: string; query: string; filters: SearchFilters; mode: SearchMode; }

export const defaultPreferences: ReaderPreferences = {
  showTransliteration: true,
  showTranslation: true,
  showProviderLayers: true,
  theme: 'paper',
  textScale: 1,
  transliterationScale: 1,
  interpretationScale: 1,
  lineSpacing: 1.7,
  wordMode: false,
  readerMode: 'reading',
  providerLayerVisibility: {
    reference_gurmukhi: false,
    transliteration: true,
    literal_translation_pa: false,
    literal_translation_en: true,
    interpretive_transcreation_pa: false,
    interpretive_transcreation_en: true,
    commentary_pa: false,
    commentary_en: false,
    poetical_dimension_pa: false,
    poetical_dimension_en: false
  },
  gurmukhiColor: '#18231f',
  latinColor: '#52635c',
  backgroundColor: '#fbf7ed'
};

export const defaultPersonalData: PersonalData = {
  bookmarks: [],
  notes: {},
  savedTerms: [],
  readingPosition: null,
  collections: [],
  history: [],
  savedSearches: []
};

export function usePersistentState<T>(key: string, initial: T): [T, (next: T | ((current: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => readValue(key, initial));
  const [nativeReady, setNativeReady] = useState(!personalStoreSupported());

  useEffect(() => {
    if (!personalStoreSupported()) return;
    let active = true;
    void readPersonalState<T>(key).then(stored => {
      if (!active) return;
      if (stored) setValue(current => mergeValue(current, stored));
      else void writePersonalState(key, readValue(key, initial));
      setNativeReady(true);
    }).catch(() => setNativeReady(true));
    return () => { active = false; };
  }, [initial, key]);

  useEffect(() => {
    try { window.localStorage.setItem(key, JSON.stringify(value)); }
    catch { /* The application remains usable when private storage is unavailable. */ }
    if (nativeReady) void writePersonalState(key, value);
  }, [key, nativeReady, value]);

  const update = useCallback((next: T | ((current: T) => T)) => {
    setValue(current => typeof next === 'function' ? (next as (current: T) => T)(current) : next);
  }, []);

  return [value, update];
}

function mergeValue<T>(fallback: T, stored: T): T {
  if (fallback && stored && typeof fallback === 'object' && typeof stored === 'object' && !Array.isArray(fallback)) {
    return { ...fallback, ...stored };
  }
  return stored;
}

function readValue<T>(key: string, fallback: T): T {
  try {
    const stored = window.localStorage.getItem(key);
    return stored ? { ...fallback, ...JSON.parse(stored) } : fallback;
  } catch {
    return fallback;
  }
}

export function toggleValue(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter(item => item !== value) : [...values, value];
}
