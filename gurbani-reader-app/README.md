# Gurbani Reader

Local-first React/TypeScript and Capacitor reader for Android and iOS, backed by bundled SQLite reading data.

## Current release candidate

- Guru Granth Sahib and Vaaran Bhai Gurdas Ji reading sources. The two upstream
  Bhai Gurdas contributor records are presented as one author in the app.
- 82 source-scoped Guru Granth Sahib named Bani collections from BaniDB.
- Shabad-first author and Raag navigation.
- Gurmukhi, phonetic Latin and attributed SikhRI/TGGSP English-analysis search.
- Inline SikhRI/TGGSP literal Translation and etymology wherever verified line
  alignment is available, including named-Bani reading paths such as Asa Ki Vaar.
- All 70 published TGGSP readings in the current permissioned snapshot, including
  ordered Amrit, Anand, Birth/Naming and Antam Sanskar ceremony groupings.
- Complete paginated frequency exploration, personal notes, collections, history,
  saved searches, direct references and portable JSON backup/import.

## Run

```bash
npm install
npm run check
npm run dev
```

## Offline mobile build

The generated Capacitor projects are included in `android/` and `ios/`. A release package supplies the prepopulated database at `public/assets/databases/gurbani_reader_v5SQLite.db`.

```bash
npm run corpus:restore
npm run build:native
npx cap sync
cd android && ./gradlew assembleDebug # development only
```

The database name is schema-versioned. Installing v0.11 RC 3 copies the v5
reading database automatically. GitHub Actions compiles an unsigned build input;
the release process signs and verifies the installable APK with the permanent
private key. Local debug builds cannot upgrade that release. Personal data and
preferences now live in a separate native database.

## Data behaviour

- Enter `nam` or `naam` to see possible exact Gurmukhi forms before counting.
- Word exploration is opt-in; ordinary line selection opens the complete Shabad group.
- Exact concordance is paginated without a 200-result ceiling.
- Named Bani reading uses ordered BaniDB Gurmukhi and transliteration; BaniDB English translations are deliberately not imported.
- TGGSP literal Translation is inline beneath its verified Gurmukhi line or
  passage anchor; transcreation, poetical dimension and commentary remain at the
  end of a complete Sabad.
- Bookmarks, private notes, saved terms and reading preferences stay on the device.

The Git repository includes a checksummed compressed v5 data pack so GitHub Actions can build a directly installable APK. Raw snapshots and generated databases remain excluded; schemas, reproducible ingestion scripts and validation tests are versioned.
