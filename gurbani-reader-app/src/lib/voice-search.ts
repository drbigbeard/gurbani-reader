import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import {
  AudioSessionCategoryOption,
  AudioSessionMode,
  CapacitorAudioRecorder,
} from '@capgo/capacitor-audio-recorder';
import { SpeechRecognition } from '@capgo/capacitor-speech-recognition';

interface VoiceSearchPlugin {
  available(): Promise<{ available: boolean }>;
  listen(options: { language: string }): Promise<{ matches: string[] }>;
}

export interface VoiceListenOptions {
  maxDurationMs?: number;
  source?: 'voice-search' | 'nearby-audio' | 'same-device-speaker';
}

export interface VoiceCapabilityReport {
  platform: string;
  legacyLocales: string[];
  routes: Array<{
    locale: string;
    engine: 'apple-modern' | 'apple-legacy' | 'android-native' | 'enhanced';
    available: boolean;
  }>;
  enhancedConfigured: boolean;
}

const NativeVoiceSearch = registerPlugin<VoiceSearchPlugin>('VoiceSearch');
const enhancedSpeechUrl = String(import.meta.env.VITE_ENHANCED_SPEECH_URL ?? '').trim();
const enhancedSpeechToken = String(import.meta.env.VITE_ENHANCED_SPEECH_TOKEN ?? '').trim();
const PUNJABI_LOCALES = ['pa-Guru-IN', 'pa-IN', 'pa'];
const ENGLISH_INDIA_LOCALES = ['en-IN', 'en-GB'];
const ENHANCED_SPEECH_CONSENT_KEY = 'shabad-sojhi:enhanced-punjabi-speech-consent:v1';

let stopActiveSession: (() => Promise<void>) | null = null;
let lastRoute = '';

export function activeVoiceRoute(): string {
  return lastRoute;
}

export async function stopVoiceSearch(): Promise<void> {
  await stopActiveSession?.();
}

export async function voiceSearchAvailable(): Promise<boolean> {
  if (enhancedSpeechUrl) return true;
  if (Capacitor.isNativePlatform()) {
    if (Capacitor.getPlatform() === 'ios') return true;
    try {
      return (await NativeVoiceSearch.available()).available;
    } catch {
      return false;
    }
  }
  return Boolean(webRecognizer());
}

export async function voiceCapabilityReport(): Promise<VoiceCapabilityReport> {
  const platform = Capacitor.getPlatform();
  const report: VoiceCapabilityReport = {
    platform,
    legacyLocales: [],
    routes: [],
    enhancedConfigured: Boolean(enhancedSpeechUrl),
  };
  if (platform === 'ios') {
    try {
      report.legacyLocales = (await SpeechRecognition.getSupportedLanguages()).languages;
    } catch {
      report.legacyLocales = [];
    }
    for (const locale of [...PUNJABI_LOCALES, ...ENGLISH_INDIA_LOCALES]) {
      let modern = false;
      try {
        modern = (await SpeechRecognition.isOnDeviceRecognitionAvailable({ language: locale })).available;
      } catch {
        modern = false;
      }
      report.routes.push({ locale, engine: 'apple-modern', available: modern });
      report.routes.push({
        locale,
        engine: 'apple-legacy',
        available: localeSupported(report.legacyLocales, locale),
      });
    }
  } else if (platform === 'android') {
    let available = false;
    try {
      available = (await NativeVoiceSearch.available()).available;
    } catch {
      available = false;
    }
    report.routes.push({ locale: 'pa-IN', engine: 'android-native', available });
  }
  report.routes.push({
    locale: 'pa-Guru-IN',
    engine: 'enhanced',
    available: Boolean(enhancedSpeechUrl),
  });
  return report;
}

export async function listenForSearch(
  language: 'pa-IN' | 'en-GB',
  options: VoiceListenOptions = {},
): Promise<string[]> {
  await stopVoiceSearch();
  const errors: string[] = [];

  if (Capacitor.getPlatform() === 'ios') {
    const routes = await iosRoutes(language);
    for (const route of routes) {
      try {
        const matches = await listenOnIos(route.locale, route.modern, options);
        if (matches.length) {
          lastRoute = `${route.modern ? 'Apple on-device' : 'Apple Speech'} · ${route.locale}`;
          return matches;
        }
      } catch (error) {
        errors.push(errorMessage(error));
      }
    }
  } else if (Capacitor.isNativePlatform()) {
    try {
      const matches = uniqueMatches(
        (await NativeVoiceSearch.listen({ language: language === 'pa-IN' ? 'pa-IN' : 'en-IN' })).matches,
      );
      if (matches.length) {
        lastRoute = `Android speech · ${language === 'pa-IN' ? 'pa-IN' : 'en-IN'}`;
        return matches;
      }
    } catch (error) {
      errors.push(errorMessage(error));
    }
  } else {
    const Recognition = webRecognizer();
    if (Recognition) {
      try {
        const matches = await listenOnWeb(Recognition, language === 'pa-IN' ? 'pa-IN' : 'en-IN');
        if (matches.length) {
          lastRoute = `Browser speech · ${language === 'pa-IN' ? 'pa-IN' : 'en-IN'}`;
          return matches;
        }
      } catch (error) {
        errors.push(errorMessage(error));
      }
    }
  }

  if (language === 'pa-IN' && enhancedSpeechUrl) {
    const matches = await listenWithEnhancedPunjabi(options);
    if (matches.length) {
      lastRoute = 'Enhanced Punjabi · pa-Guru-IN';
      return matches;
    }
  }

  const detail = [...new Set(errors.filter(Boolean))].slice(0, 2).join(' ');
  throw new Error(
    language === 'pa-IN'
      ? `Punjabi recognition could not produce a transcript.${detail ? ` ${detail}` : ''}`
      : `Voice recognition could not produce a transcript.${detail ? ` ${detail}` : ''}`,
  );
}

async function iosRoutes(language: 'pa-IN' | 'en-GB') {
  const candidates = language === 'pa-IN' ? PUNJABI_LOCALES : ENGLISH_INDIA_LOCALES;
  let legacyLocales: string[] = [];
  try {
    legacyLocales = (await SpeechRecognition.getSupportedLanguages()).languages;
  } catch {
    legacyLocales = [];
  }
  const routes: Array<{ locale: string; modern: boolean }> = [];
  for (const locale of candidates) {
    try {
      if ((await SpeechRecognition.isOnDeviceRecognitionAvailable({ language: locale })).available)
        routes.push({ locale, modern: true });
    } catch {
      // Continue to the legacy probe.
    }
  }
  for (const locale of candidates)
    if (!legacyLocales.length || localeSupported(legacyLocales, locale))
      routes.push({ locale, modern: false });
  return routes.filter(
    (route, index) =>
      routes.findIndex((candidate) => candidate.locale === route.locale && candidate.modern === route.modern) === index,
  );
}

async function listenOnIos(
  locale: string,
  useOnDeviceRecognition: boolean,
  options: VoiceListenOptions,
): Promise<string[]> {
  let permission = await SpeechRecognition.checkPermissions();
  if (permission.speechRecognition === 'prompt' || permission.speechRecognition === 'prompt-with-rationale')
    permission = await SpeechRecognition.requestPermissions();
  if (permission.speechRecognition !== 'granted')
    throw new Error('Microphone and Speech Recognition access are required in iPhone Settings.');

  if ((await SpeechRecognition.isListening()).listening)
    await SpeechRecognition.forceStop();

  const listeners: PluginListenerHandle[] = [];
  let matches: string[] = [];
  let settled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let settlePromise: Promise<string[]> | null = null;
  let settleResolve: ((value: string[]) => void) | null = null;
  let settleReject: ((reason: Error) => void) | null = null;

  const cleanup = async () => {
    if (timer) clearTimeout(timer);
    await Promise.all(listeners.map((listener) => listener.remove().catch(() => undefined)));
    if (stopActiveSession === stop) stopActiveSession = null;
  };
  const finish = async () => {
    if (settled) return;
    settled = true;
    try {
      const partial = await SpeechRecognition.getLastPartialResult();
      matches = uniqueMatches([...(partial.matches ?? []), partial.text, ...matches]);
      await SpeechRecognition.forceStop();
      await cleanup();
      settleResolve?.(matches);
    } catch (error) {
      await cleanup();
      settleReject?.(new Error(errorMessage(error)));
    }
  };
  const fail = async (error: Error) => {
    if (settled) return;
    settled = true;
    await SpeechRecognition.forceStop().catch(() => undefined);
    await cleanup();
    settleReject?.(error);
  };
  const stop = async () => {
    await finish();
  };

  settlePromise = new Promise<string[]>((resolve, reject) => {
    settleResolve = resolve;
    settleReject = reject;
  });
  stopActiveSession = stop;
  listeners.push(
    await SpeechRecognition.addListener('partialResults', (event) => {
      matches = uniqueMatches([
        ...(event.matches ?? []),
        event.accumulatedText ?? '',
        event.accumulated ?? '',
        ...matches,
      ]);
    }),
  );
  listeners.push(
    await SpeechRecognition.addListener('listeningState', (event) => {
      if (event.state === 'stopped' || event.status === 'stopped') void finish();
    }),
  );
  listeners.push(
    await SpeechRecognition.addListener('error', (event) => {
      void fail(new Error(event.message || event.code));
    }),
  );

  try {
    await SpeechRecognition.start({
      language: locale,
      maxResults: 5,
      partialResults: true,
      addPunctuation: false,
      useOnDeviceRecognition,
      contextualStrings: [
        'ਗੁਰਬਾਣੀ',
        'ਵਾਹਿਗੁਰੂ',
        'ਸਤਿਗੁਰੁ',
        'ਆਨੰਦੁ',
        'ਆਸਾ ਕੀ ਵਾਰ',
        'Gurbani',
        'Waheguru',
        'Satigur',
        'Anand Sahib',
        'Asa Di Vaar',
      ],
    });
    timer = setTimeout(() => void finish(), options.maxDurationMs ?? 8_000);
  } catch (error) {
    await fail(new Error(errorMessage(error)));
  }
  return settlePromise;
}

async function listenWithEnhancedPunjabi(options: VoiceListenOptions): Promise<string[]> {
  if (!enhancedSpeechConsent())
    throw new Error('Enhanced Punjabi recognition was not enabled.');

  let permission = await CapacitorAudioRecorder.checkPermissions();
  if (permission.recordAudio === 'prompt' || permission.recordAudio === 'prompt-with-rationale')
    permission = await CapacitorAudioRecorder.requestPermissions();
  if (permission.recordAudio !== 'granted')
    throw new Error('Microphone access is required for enhanced Punjabi recognition.');

  const status = await CapacitorAudioRecorder.getRecordingStatus();
  if (status.status !== 'INACTIVE')
    await CapacitorAudioRecorder.cancelRecording().catch(() => undefined);

  await CapacitorAudioRecorder.startRecording({
    sampleRate: 16_000,
    bitRate: 32_000,
    audioSessionMode: AudioSessionMode.Measurement,
    audioSessionCategoryOptions:
      options.source === 'same-device-speaker'
        ? [AudioSessionCategoryOption.MixWithOthers, AudioSessionCategoryOption.DefaultToSpeaker]
        : [AudioSessionCategoryOption.DefaultToSpeaker],
  });

  let stopped = false;
  let stopResultUri = '';
  const stop = async () => {
    if (stopped) return;
    stopped = true;
    const result = await CapacitorAudioRecorder.stopRecording();
    stopResultUri = result.uri ?? '';
  };
  stopActiveSession = stop;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, options.maxDurationMs ?? 10_000);
    const originalStop = stopActiveSession;
    stopActiveSession = async () => {
      await originalStop?.();
      clearTimeout(timer);
      resolve();
    };
  });
  await stop();
  stopActiveSession = null;

  if (!stopResultUri) throw new Error('The enhanced recogniser did not receive an audio recording.');
  const response = await fetch(Capacitor.convertFileSrc(stopResultUri));
  if (!response.ok) throw new Error('The recorded audio could not be prepared for recognition.');
  const blob = await response.blob();
  const audioBase64 = await blobToBase64(blob);

  const recognition = await fetch(enhancedSpeechUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(enhancedSpeechToken ? { 'x-shabad-beta-key': enhancedSpeechToken } : {}),
    },
    body: JSON.stringify({
      audioBase64,
      mimeType: blob.type || 'audio/mp4',
      languageCode: 'pa-Guru-IN',
      source: options.source ?? 'voice-search',
    }),
  });
  if (!recognition.ok)
    throw new Error(`Enhanced Punjabi recognition is unavailable (${recognition.status}).`);
  const payload = (await recognition.json()) as { matches?: string[] };
  return uniqueMatches(payload.matches ?? []);
}

function enhancedSpeechConsent(): boolean {
  if (localStorage.getItem(ENHANCED_SPEECH_CONSENT_KEY) === 'accepted') return true;
  const accepted = window.confirm(
    'Apple Punjabi recognition is unavailable for this attempt. Use enhanced Punjabi recognition? A short microphone recording will be sent securely to Google Cloud for transcription and will not be stored by Shabad Sojhi.',
  );
  if (accepted) localStorage.setItem(ENHANCED_SPEECH_CONSENT_KEY, 'accepted');
  return accepted;
}

async function listenOnWeb(Recognition: WebRecognition, language: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const recognizer = new Recognition();
    recognizer.lang = language;
    recognizer.interimResults = false;
    recognizer.maxAlternatives = 5;
    recognizer.onerror = () => reject(new Error('Speech could not be recognised.'));
    recognizer.onresult = (event) =>
      resolve(uniqueMatches(Array.from(event.results[0] ?? [], (item) => item.transcript)));
    recognizer.start();
  });
}

function localeSupported(supported: string[], candidate: string): boolean {
  const folded = foldLocale(candidate);
  return supported.some((locale) => foldLocale(locale) === folded);
}

function foldLocale(value: string): string {
  return value.replaceAll('_', '-').toLowerCase();
}

function uniqueMatches(values: Array<string | undefined | null>): string[] {
  return [...new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean))].slice(0, 5);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Audio encoding failed.'));
    reader.onload = () => resolve(String(reader.result ?? '').replace(/^data:[^,]+,/u, ''));
    reader.readAsDataURL(blob);
  });
}

type WebRecognition = new () => {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  onerror: (() => void) | null;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
};

function webRecognizer(): WebRecognition | null {
  const scope = window as typeof window & {
    SpeechRecognition?: WebRecognition;
    webkitSpeechRecognition?: WebRecognition;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}
