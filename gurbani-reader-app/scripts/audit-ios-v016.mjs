#!/usr/bin/env node
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const read = path => readFileSync(resolve(root, path), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const delegate = read('ios/App/App/AppDelegate.swift');
const info = read('ios/App/App/Info.plist');
const storyboard = read('ios/App/App/Base.lproj/Main.storyboard');
const project = read('ios/App/App.xcodeproj/project.pbxproj');
const swiftPackage = read('ios/App/CapApp-SPM/Package.swift');
const voice = read('src/lib/voice-search.ts');
const html = read('index.html');
const css = read('src/v016.css');

assert(swiftPackage.includes('CapgoCapacitorSpeechRecognition'), 'Capgo iOS Speech Recognition package was not added by Capacitor sync.');
assert(
  swiftPackage.match(/CapgoCapacitorSpeechRecognition/g)?.length >= 2,
  'The iOS target does not link the speech-recognition product.',
);
assert(voice.includes('SpeechRecognition.requestPermissions()'), 'First-use iOS permission request is missing.');
assert(voice.includes("Capacitor.getPlatform() === 'ios'"), 'Shared voice bridge does not select the native iOS implementation.');
assert(voice.includes("language === 'pa-IN'"), 'Punjabi voice-search locale handling is missing.');
assert(voice.includes('maxResults: 5'), 'Recognition alternatives are not requested.');
assert(voice.includes('contextualStrings:'), 'Gurbani recognition context is missing.');
assert(delegate.includes('ApplicationDelegateProxy.shared'), 'Standard Capacitor application delegate is missing.');
assert(storyboard.includes('customClass="CAPBridgeViewController"'), 'Storyboard is not using the standard Capacitor bridge.');
assert(!delegate.includes('registerPluginType'), 'The obsolete custom plugin registration path is still present.');
assert(info.includes('<key>NSMicrophoneUsageDescription</key>'), 'Microphone purpose string is missing.');
assert(info.includes('<key>NSSpeechRecognitionUsageDescription</key>'), 'Speech-recognition purpose string is missing.');
assert(info.includes('<key>ITSAppUsesNonExemptEncryption</key>'), 'Export-compliance declaration is missing.');
assert(
  /<key>ITSAppUsesNonExemptEncryption<\/key>\s*<false\/>/u.test(info),
  'The app must declare that it does not use non-exempt encryption.'
);
assert(!info.includes('<string>armv7</string>'), 'Legacy armv7 capability must not be required.');
assert(project.includes('IPHONEOS_DEPLOYMENT_TARGET = 15.0;'), 'iOS 15 deployment target changed unexpectedly.');
assert(project.includes('CURRENT_PROJECT_VERSION = 23;'), 'RC4 must use TestFlight build 23.');
assert(project.includes('TARGETED_DEVICE_FAMILY = "1,2";'), 'Universal iPhone/iPad device family setting is missing.');
assert(
  project.match(/PRODUCT_BUNDLE_IDENTIFIER = com\.drbigbeard\.shabadsojhi;/g)?.length === 2,
  'The permanent Shabad Sojhi iOS bundle identifier is not configured for both build types.'
);
assert(html.includes('viewport-fit=cover'), 'Edge-to-edge iPhone safe-area viewport support is missing.');
assert(css.includes('env(safe-area-inset-top)'), 'Top safe-area handling is missing.');
assert(css.includes('env(safe-area-inset-bottom)'), 'Bottom safe-area handling is missing.');

const sourceDatabase = resolve(root, 'public/assets/databases/gurbani_reader_v9SQLite.db');
const bundledDatabase = resolve(root, 'ios/App/App/public/assets/databases/gurbani_reader_v9SQLite.db');
assert(existsSync(sourceDatabase), 'Prepared v9 SQLite database is missing.');
assert(existsSync(bundledDatabase), 'The v9 SQLite database was not copied into the iOS bundle. Run npm run ios:prepare.');
assert(statSync(sourceDatabase).size === statSync(bundledDatabase).size, 'Bundled iOS database does not match the prepared source database.');
assert(readFileSync(bundledDatabase).subarray(0, 16).toString() === 'SQLite format 3\u0000', 'Bundled iOS database is not a valid SQLite file.');

console.log(JSON.stringify({
  status: 'pass',
  platform: 'ios',
  version: '0.16.0',
  build: '23',
  bundleIdentifier: 'com.drbigbeard.shabadsojhi',
  deploymentTarget: '15.0',
  packagedDatabaseBytes: statSync(bundledDatabase).size,
  nativeVoiceBridge: 'CapgoCapacitorSpeechRecognition',
  firstUsePermissionRequest: true,
  recognitionAlternatives: 5,
  safeAreas: true,
  physicalDeviceGate: 'Required before external TestFlight release'
}, null, 2));
