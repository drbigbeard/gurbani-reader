import { Capacitor, registerPlugin } from '@capacitor/core';

interface VoiceSearchPlugin {
  available(): Promise<{ available: boolean }>;
  listen(options: { language: string }): Promise<{ matches: string[] }>;
}

const NativeVoiceSearch = registerPlugin<VoiceSearchPlugin>('VoiceSearch');

export async function voiceSearchAvailable(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try { return (await NativeVoiceSearch.available()).available; } catch { return false; }
  }
  return Boolean(webRecognizer());
}

export async function listenForSearch(language: 'pa-IN' | 'en-GB'): Promise<string[]> {
  if (Capacitor.isNativePlatform()) return (await NativeVoiceSearch.listen({ language })).matches;
  const Recognition = webRecognizer();
  if (!Recognition) throw new Error('Voice search is not available on this device.');
  return new Promise((resolve, reject) => {
    const recognizer = new Recognition();
    recognizer.lang = language; recognizer.interimResults = false; recognizer.maxAlternatives = 5;
    recognizer.onerror = () => reject(new Error('Speech could not be recognised.'));
    recognizer.onresult = event => resolve(Array.from(event.results[0] ?? [], item => item.transcript).filter(Boolean));
    recognizer.start();
  });
}

type WebRecognition = new () => {
  lang: string; interimResults: boolean; maxAlternatives: number;
  start(): void; onerror: (() => void) | null;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
};

function webRecognizer(): WebRecognition | null {
  const scope = window as typeof window & { SpeechRecognition?: WebRecognition; webkitSpeechRecognition?: WebRecognition };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}
