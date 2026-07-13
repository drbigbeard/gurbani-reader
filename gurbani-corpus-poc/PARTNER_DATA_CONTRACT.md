# Minimum partner data contract

## BaniDB delivery

Required before production ingestion:

- delivery or corpus release identifier;
- generated timestamp;
- integrity checksum;
- source catalogue;
- complete text-unit hierarchy or enough metadata to reconstruct it;
- stable line and Shabad/unit identifiers;
- canonical Gurmukhi and ordering;
- source, Ang/page, writer, Raag, and structural metadata;
- update, correction, deletion, and identifier-retirement rules;
- attribution requirements;
- permitted cache, index, and offline behaviour.

The first delivery should include a full snapshot. Incremental updates may follow once reconciliation has been tested against a second snapshot.

## SikhRI/TGGSP delivery

Required before provider-content ingestion:

- provider release identifier and timestamp;
- stable composition, stanza, line, and content identifiers;
- reference Gurmukhi used for mapping;
- line and stanza order;
- transliteration;
- word annotations;
- literal translation;
- interpretive transcreation;
- commentary and significant-term content;
- per-layer coverage status;
- credits, required attribution, and citation format;
- correction, supersession, and withdrawal behaviour.

## Crosswalk acceptance

- Exact identifier matches may be auto-approved only when jointly supplied by the providers.
- Exact text matches may be proposed automatically but remain version-scoped.
- Normalised, segmented, one-to-many, and many-to-one matches require review.
- Unmatched provider records remain unavailable in the reader.
- A provider layer must never be attached through approximate semantic similarity.
