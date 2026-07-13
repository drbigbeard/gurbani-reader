# Proof-of-concept implementation report

## Outcome

The first ingestion and analytical-index proof of concept is operational using clearly labelled technical fixtures.

## Verified behaviour

Eight automated tests pass:

1. canonical fixture validation;
2. exact source reconstruction from UTF-16, Unicode code-point, and UTF-8 byte offsets;
3. cyclic text hierarchy rejection;
4. canonical display-text preservation with separate NFC comparison;
5. separation of `ਹਰਿ` and `ਹਰ` exact counts;
6. separate token, line, and nearest-unit counts;
7. reviewed rather than automatically approved provider crosswalk proposals;
8. deterministic analysis-release identity for identical inputs.

## Fixture build

The fixture build produces:

- one corpus release;
- one source work;
- two recursive text units;
- three canonical lines;
- sixteen total token occurrences;
- thirteen lexical Gurmukhi occurrences;
- three provider crosswalk records;
- one exact-text proposal requiring review;
- one whitespace-normalised proposal requiring review;
- one unavailable unmatched record.

The exact technical-fixture query `ਸੁਣਿਐ` returns:

- three token occurrences;
- three distinct lines;
- one nearest structural unit;
- all three underlying occurrence identifiers.

These are fixture validation results, not corpus findings.

## Production blockers

The pipeline is ready for adapter development, but production adapters cannot be completed until representative BaniDB and SikhRI/TGGSP records are provided. In particular, the project still needs:

- stable identifiers and update semantics;
- full response/export schemas;
- a complete or synchronisable BaniDB snapshot;
- SikhRI/TGGSP layer and coverage records;
- exact attribution metadata;
- jointly supplied mappings, if any;
- representative complex structures.

## Recommended next implementation

When partner samples arrive:

1. store each raw delivery unchanged;
2. add a BaniDB adapter into the internal canonical contract;
3. add a SikhRI/TGGSP provider adapter;
4. run schema and integrity validation;
5. produce a proposed crosswalk queue;
6. review complex mappings;
7. validate known token and structural counts independently;
8. connect the verified analytical index to the prototype interface.
