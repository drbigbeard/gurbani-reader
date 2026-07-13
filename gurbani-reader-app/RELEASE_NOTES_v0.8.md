# Gurbani Reader v0.8

## Corpus packs

The offline native database contains three explicitly selectable BaniDB sources:

| Pack | Angs | Canonical lines |
| --- | ---: | ---: |
| Guru Granth Sahib | 1,430 | 60,403 |
| Bhai Gurdas Ji Vaaran | 40 | 7,383 |
| Bhai Gurdas Singh Ji Vaaran | 28 | 352 |

Combined storage totals are 68,138 lines, 6,481 BaniDB Shabad retrieval groups, 39 contributors and 574,658 token occurrences. These storage totals do not imply combined analytical results.

## Source scoping

- Reader and Explore now include a corpus-pack selector.
- Ang navigation uses the selected pack's actual range.
- Exact-word frequency, distinct-line counts, BaniDB Shabad-group counts and concordances are filtered by source.
- Ranked exact forms and contributor totals are filtered by source.
- Concordance selections open the matching source and Ang.
- SikhRI/TGGSP layers remain available only where mapped to Guru Granth Sahib records; the interface does not imply equivalent coverage for the Vaaran packs.

As a verified scope example, exact form `ਹਰਿ` has 9,288 occurrences in `G`, 29 in `B` and 36 in `S`.

## Validation

- SQLite integrity check: `ok`.
- Corpus tests: 15 passed.
- TypeScript check: passed.
- Native Vite build: passed.
- Capacitor Android and iOS sync: passed.

The archive contains native project source rather than signed APK/IPA binaries. Android compilation requires the first Gradle dependency download; iOS compilation and local device signing require Xcode on macOS.
