import { Capacitor, registerPlugin } from '@capacitor/core';
import { SpeechRecognition } from '@capgo/capacitor-speech-recognition';

interface VoiceSearchPlugin {
  available(): Promise<{ available: boolean }>;
  listen(options: { language: string }): Promise<{ matches: string[] }>;
}

const NativeVoiceSearch = registerPlugin<VoiceSearchPlugin>('VoiceSearch');

export async function voiceSearchAvailable(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    // On iOS the first microphone press must reach requestPermissions().
    // Treating an uninitialised native bridge as "unavailable" prevented iOS
    // from ever showing its Speech Recognition and Microphone prompts in RC3.
    if (Capacitor.getPlatform() === 'ios') return true;
    try { return (await NativeVoiceSearch.available()).available; } catch { return false; }
  }
  return Boolean(webRecognizer());
}

export async function listenForSearch(language: 'pa-IN' | 'en-GB'): Promise<string[]> {
  if (Capacitor.getPlatform() === 'ios') return listenOnIos(language);
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

async function listenOnIos(language: 'pa-IN' | 'en-GB'): Promise<string[]> {
  let permission = await SpeechRecognition.checkPermissions();
  if (permission.speechRecognition === 'prompt' || permission.speechRecognition === 'prompt-with-rationale') {
    permission = await SpeechRecognition.requestPermissions();
  }
  if (permission.speechRecognition !== 'granted') {
    throw new Error('Microphone and Speech Recognition access are required. Enable both for Shabad Sojhi in iPhone Settings.');
  }

  const capability = await SpeechRecognition.available();
  if (!capability.available) {
    throw new Error(
      language === 'pa-IN'
        ? 'Punjabi speech recognition is temporarily unavailable. Check your connection or try Roman / English voice search.'
        : 'Speech recognition is temporarily unavailable. Check your connection and try again.',
    );
  }

  try {
    const result = await SpeechRecognition.start({
      language,
      maxResults: 5,
      partialResults: false,
      addPunctuation: false,
      useOnDeviceRecognition: false,
      contextualStrings: language === 'pa-IN'
        ? ['ਗੁਰਬਾਣੀ', 'ਵਾਹਿਗੁਰੂ', 'ਸਤਿਗੁਰੁ', 'ਆਨੰਦੁ', 'ਆਸਾ ਕੀ ਵਾਰ']
        : ['Gurbani', 'Waheguru', 'Satigur', 'Anand Sahib', 'Asa Di Vaar'],
    });
    const matches = [...new Set((result.matches ?? []).map((value) => value.trim()).filter(Boolean))];
    if (!matches.length) throw new Error('No speech was recognised. Try a shorter phrase closer to the microphone.');
    return matches.slice(0, 5);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/permission|denied/iu.test(message)) {
      throw new Error('Microphone and Speech Recognition access are required. Enable both for Shabad Sojhi in iPhone Settings.');
    }
    if (/unsupported locale/iu.test(message)) {
      throw new Error(
        language === 'pa-IN'
          ? 'Punjabi speech recognition is not currently installed or available. Try Roman / English voice search.'
          : 'English speech recognition is not currently available.',
      );
    }
    if (/recognizer.*unavailable|network/iu.test(message)) {
      throw new Error('Speech recognition is temporarily unavailable. Check your connection and try again.');
    }
    throw error;
  }
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
