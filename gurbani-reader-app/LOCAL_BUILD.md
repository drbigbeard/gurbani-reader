# Gurbani Reader v0.8 — local Android and iOS build

This is a local-first Capacitor application. The complete production SQLite database is already bundled at `public/assets/databases/gurbani_corpusSQLite.db`; no server or account is required at runtime.

## Included snapshot

- Three explicitly selectable BaniDB packs: Guru Granth Sahib (`G`), Bhai Gurdas Ji Vaaran (`B`) and Bhai Gurdas Singh Ji Vaaran (`S`).
- 68,138 canonical lines, 574,658 indexed token occurrences, 6,481 BaniDB Shabad retrieval groups and 39 contributor records.
- Word frequencies, rankings, concordances and contributor totals are scoped to the selected pack; sources are never silently combined.
- SikhRI/TGGSP: 12,615 separately typed provider-content layers, 72,734 glossary entries and 36,224 searchable term forms.
- Exact-line TGGSP crosswalk: 5,715 matched reference lines; ambiguous and unmatched lines are retained for review and are never guessed.

Canonical corpus data is powered by BaniDB, a Khalis Foundation initiative. Transliteration, glossary, translation, transcreation, commentary and related interpretive layers are attributed to The Guru Granth Sahib Project, Sikh Research Institute (SikhRI), and are used with permission. Provider layers remain separate in the database and interface.

## Android

Prerequisites: Node.js 22+, JDK 21, Android Studio with a current Android SDK, and internet access for the first Gradle dependency download.

```sh
npm install
npm run check
npm run native:sync
cd android
./gradlew assembleDebug
```

The installable debug APK will be at `android/app/build/outputs/apk/debug/app-debug.apk`. Install it with Android Studio or:

```sh
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

## iOS

Prerequisites: macOS, Xcode, an Apple ID configured for local device development, and Node.js 22+.

```sh
npm install
npm run native:sync
npx cap open ios
```

In Xcode, choose your personal development team for the `App` target, connect the iPhone/iPad, select it as the run destination, and press Run. App Store distribution is not required.

## Important update note

The database is copied from the application bundle on first launch. If an earlier technical-fixture build was installed, uninstall it before installing this production snapshot so that the old database cannot remain in the app container.

## Verified commands

- TypeScript check: passed.
- Native Vite build: passed.
- Capacitor Android and iOS sync: passed.
- SQLite `PRAGMA integrity_check`: `ok`.
- Corpus tests: 15 passed.

This Linux workspace could not produce the APK because its network policy blocked the initial Gradle distribution download. iOS signing is only available through Xcode on macOS. The synced platform projects themselves are included.

The installed database contains `G/B/S`. A separate verified wider analytical release also includes source `D`, but Dasam Bani is not silently incorporated because it would change the declared scope of every word frequency and substantially increase the installation size.
