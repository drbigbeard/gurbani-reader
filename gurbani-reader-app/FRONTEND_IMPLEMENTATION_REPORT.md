# Frontend implementation report

## Outcome

A runnable React/TypeScript application scaffold now implements the agreed personal-reading and corpus-exploration boundaries.

## Implemented screens

- Home and Continue Reading;
- Reader with selectable Gurmukhi tokens;
- context-preserving Word Preview;
- phonetic/Gurmukhi Search;
- candidate resolution for `har`;
- exact-form Word Explorer;
- concordance results;
- Explore and ranked-word view;
- contributor structural profile;
- Gurmat Glossary with provider and coverage states;
- Saved/private-workspace placeholder.

## Local-first personal features

- on-device bookmarks;
- private line-linked notes;
- saved glossary/word terms;
- reading-position persistence;
- transliteration and provider-layer visibility preferences;
- adjustable Gurmukhi text scale;
- persistent dark reading mode;
- explicit service-unavailable states without substituted counts;
- installable PWA manifest and service worker;
- application-shell precaching for offline reopening.

Full offline corpus packs are not included because they require the authorised production dataset, release manifests, storage budgets and update policy.

## Data boundary

The UI depends on the `CorpusGateway` interface rather than directly on fixtures or BaniDB. The current `FixtureCorpusGateway` can be replaced by an HTTP gateway backed by the verified analytical index.

The fixture contains only three canonical lines and no SikhRI/TGGSP interpretive text. Unverified totals remain blank.

## Verification

- strict TypeScript validation: passed;
- Vite production build: passed;
- production HTML runtime request: HTTP 200;
- production JavaScript bundle request: HTTP 200;
- dependency audit: zero known vulnerabilities;
- PWA manifest and service worker serving: passed;
- archive integrity test: passed.

## Current limitations

- no authenticated partner datasets;
- no production API gateway;
- no cloud account or cross-device synchronisation;
- no downloadable production corpus packs;
- no audio implementation;
- no full visual browser regression suite in this environment;
- no domain-expert review of rendered Gurmukhi typography yet;
- no verified structural or whole-corpus counts.

## Next engineering step

When representative BaniDB and SikhRI/TGGSP records arrive:

1. implement source adapters and release ingestion;
2. expose the analytical index through a read-only API;
3. replace `FixtureCorpusGateway` with `HttpCorpusGateway`;
4. attach release metadata to every aggregate;
5. attach provider provenance to every interpretive layer;
6. run browser, accessibility and Gurmukhi rendering tests with real mapped content.
