# Wider BaniDB corpus status

## Verified Unicode verse snapshots

| Source | Work | Pages | Raw records | Canonical Unicode lines |
| --- | --- | ---: | ---: | ---: |
| G | Guru Granth Sahib | 1,430 | 60,403 | 60,403 |
| B | Bhai Gurdas Ji Vaaran | 40 | 7,383 | 7,383 |
| D | Dasam Bani | 1,428 | 68,096 | 68,095 |
| S | Bhai Gurdas Singh Ji Vaaran | 28 | 352 | 352 |

The sole omitted record is BaniDB verse `75028` in source `D`, Ang 11. Its legacy and Unicode verse fields are both empty. The release records this as `empty_upstream_canonical_text` with disposition `excluded_from_unicode_analysis`; no text is inferred.

The deterministic merged release is `banidb-multi-2026-07-12-5805d3707487`:

- 4 source works
- 11,903 BaniDB Shabad retrieval groups
- 40 contributors
- 136,232 canonical Unicode lines
- 1,105,464 token occurrences
- 874,796 lexical Gurmukhi occurrences
- 64,246 distinct exact forms

## Sources requiring different models

- `A` (Amrit Keertan) is exposed as a 2,675-entry collection/index whose entries point to verses and Shabads in underlying sources. It should be represented as a curated collection with ordered references, not duplicated as a new canonical verse corpus.
- `R` (Rehatnamas and Panthic sources) is exposed through Rehat and chapter endpoints. It requires a structured-document profile rather than fake Angs or Shabad counts.
- `N` (Bhai Nand Lal Ji) appears in BaniDB source metadata, but the current public v2 routes do not expose a complete enumerating endpoint comparable to `angs` for `G/B/D/S`. A complete snapshot therefore needs a provider-supported export or an additional public route.

## Packaging decision

The current mobile bundle remains the Guru Granth Sahib (`G`) personal-reading pack with SikhRI/TGGSP enrichment. This keeps the default install around 261 MiB and preserves the declared scope of word statistics. The wider `G/B/D/S` index is built separately so a future optional corpus pack can add a visible source selector and source-scoped rankings instead of silently mixing corpora.
