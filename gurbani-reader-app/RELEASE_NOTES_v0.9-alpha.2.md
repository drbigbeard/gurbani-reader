# Gurbani Reader v0.9.0-alpha.2

This is the first Shabad-first, source-scoped usability release after the v0.8 corpus proof.

## Included

- Author → Shabad list → complete Shabad navigation.
- Raag → Shabad list → complete Shabad navigation.
- 82 ordered Guru Granth Sahib named Bani collections from the attributed BaniDB snapshot.
- Gurmukhi, phonetic Latin and SikhRI/TGGSP English-analysis search.
- Whole-Shabad Gurmukhi reading with optional transliteration and separately controlled text sizes.
- Explicit SikhRI/TGGSP Gurmukhi/transliteration/English layer labels and coverage accounting.
- Exact concordance pagination with no 200-result ceiling.
- Optional, user-selected frequency grouping that preserves the exact-form result.
- Versioned v3 SQLite asset, allowing installation over v0.8 without retaining its older corpus schema.

## Source boundaries

- Corpus: Guru Granth Sahib, Bhai Gurdas Ji Vaaran and Bhai Gurdas Singh Ji Vaaran.
- Named Banis: only BaniDB collections declared as Guru Granth Sahib (`sourceId: G`).
- 22 Dasam or mixed/unspecified-source collections remain excluded until those sources are explicitly added and reviewed.
- BaniDB English translations are not used. SikhRI/TGGSP analysis remains separately attributed and is never attached through guessed alignment.

## Alpha limitations

- Named Bani view is a continuous ordered reading view; per-line Shabad/TGGSP linking will follow after a reviewed collection-to-canonical alignment.
- iOS project is synchronized but has not been signed for installation.
- Android APK is intended to be built by the included GitHub Actions workflow or Android Studio.
