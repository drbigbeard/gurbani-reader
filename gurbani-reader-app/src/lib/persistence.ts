import { useCallback, useEffect, useState } from 'react';

export interface ReaderPreferences {
  showTransliteration: boolean;
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
}

export const defaultPreferences: ReaderPreferences = {
  showTransliteration: true,
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
  readingPosition: null
};

export function usePersistentState<T>(key: string, initial: T): [T, (next: T | ((current: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => readValue(key, initial));

  useEffect(() => {
    try { window.localStorage.setItem(key, JSON.stringify(value)); }
    catch { /* The application remains usable when private storage is unavailable. */ }
  }, [key, value]);

  const update = useCallback((next: T | ((current: T) => T)) => {
    setValue(current => typeof next === 'function' ? (next as (current: T) => T)(current) : next);
  }, []);

  return [value, update];
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
