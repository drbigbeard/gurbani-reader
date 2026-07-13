# Gurbani Reader & Corpus Explorer

Local-first React/TypeScript and Capacitor reader for Android and iOS, backed by the bundled SQLite corpus pack.

## Current alpha

- Guru Granth Sahib, Bhai Gurdas Ji Vaaran and Bhai Gurdas Singh Ji Vaaran corpus sources.
- 82 source-scoped Guru Granth Sahib named Bani collections from BaniDB.
- Shabad-first author and Raag navigation.
- Gurmukhi, phonetic Latin and attributed SikhRI/TGGSP English-analysis search.
- Separately attributed SikhRI/TGGSP analysis with explicit mapped and unresolved coverage.

## Run

```bash
npm install
npm run check
npm run dev
```

## Offline mobile build

The generated Capacitor projects are included in `android/` and `ios/`. A release package supplies the prepopulated database at `public/assets/databases/gurbani_reader_v4SQLite.db`.

```bash
npm run corpus:restore
npm run build:native
npx cap sync
cd android && ./gradlew assembleDebug
```

The database name is schema-versioned. Installing v0.10 copies the v4 reading database automatically; bookmarks and preferences remain in local app storage.

## Data behaviour

- Enter `nam` or `naam` to see possible exact Gurmukhi forms before counting.
- Word exploration is opt-in; ordinary line selection opens the complete Shabad group.
- Exact concordance is paginated without a 200-result ceiling.
- Named Bani reading uses ordered BaniDB Gurmukhi and transliteration; BaniDB English translations are deliberately not imported.
- SikhRI/TGGSP layers show language, content type, attribution and alignment status.
- Bookmarks, private notes, saved terms and reading preferences stay on the device.

The Git repository includes a checksummed compressed v4 data pack so GitHub Actions can build a directly installable APK. Raw snapshots and generated databases remain excluded; schemas, reproducible ingestion scripts and validation tests are versioned.
