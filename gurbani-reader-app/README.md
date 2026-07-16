# Gurbani Reader

Local-first React/TypeScript and Capacitor reader for Android and iOS, backed by bundled SQLite reading data.

## Current release candidate

- Guru Granth Sahib, Vaaran Bhai Gurdas Ji and selected SGPC Dasam readings. The two upstream
  Bhai Gurdas contributor records are presented as one author in the app.
- 82 source-scoped Guru Granth Sahib named Bani collections from BaniDB.
- Shabad-first author and Raag navigation.
- Gurmukhi, phonetic Latin and attributed SikhRI/TGGSP English-analysis search.
- Inline SikhRI/TGGSP literal translation and word details wherever verified line
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

The generated Capacitor projects are included in `android/` and `ios/`. The release workflow restores the checksummed v5 base, fetches and verifies the v0.13 BaniDB snapshot, then creates `public/assets/databases/gurbani_reader_v6SQLite.db`.

```bash
npm run corpus:restore
npm run data:fetch-v013 -- ../../v013-banidb-snapshot
npm run data:upgrade-v6 -- public/assets/databases/gurbani_reader_v5SQLite.db public/assets/databases/gurbani_reader_v6SQLite.db ../../v013-banidb-snapshot
npm run build:native
npx cap sync
cd android && ./gradlew assembleDebug # development only
```

The database name is schema-versioned. Installing v0.13 RC 1 copies the v6
reading database automatically. GitHub Actions compiles an unsigned build input;
the release process signs and verifies the installable APK with the permanent
private key. Local debug builds cannot upgrade that release. Personal data and
preferences now live in a separate native database.

## Data behaviour

- Enter `nam` or `naam` to see possible exact Gurmukhi forms before counting.
- Word exploration is opt-in; ordinary line selection opens the complete Shabad group.
- Exact concordance is paginated without a 200-result ceiling.
- Named Bani reading uses ordered BaniDB SGPC Gurmukhi, transliteration and optional English translation.
- Translation has three states: Off, BaniDB, or TGGSP where available. The last state falls back to BaniDB only where no TGGSP translation covers the line or passage.
- TGGSP literal translation is inline beneath its verified Gurmukhi line or
  passage anchor; transcreation, poetical dimension and commentary remain at the
  end of a complete Sabad.
- Bookmarks, private notes, saved terms and reading preferences stay on the device.

The Git repository includes a checksummed compressed v5 base pack. GitHub Actions constructs v6 from that base and the checksum-verified v0.13 BaniDB snapshot. Its source scope and upstream checksums are machine-readable in `corpus-pack/SOURCES_v013.json`.
