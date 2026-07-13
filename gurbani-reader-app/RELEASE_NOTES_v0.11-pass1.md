# Gurbani Reader v0.11 · Pass 1

This is the first of two v0.11 checkpoints. It combines the former Alpha 1 and
Alpha 2 scope into one installable, self-audited build.

## Reading and navigation

- Android Back returns through in-app history; Back at Home requires a second
  gesture to exit.
- Search and concordance results open the complete Sabad at the highlighted
  matching line.
- Reading mode remains uninterrupted; Study mode retains line and word tools.
- Gurmukhi, Latin/English and interpretation text can all be made smaller or
  larger.

## Search and analysis

- One search covers Gurmukhi text, roman spellings, English TGGSP analysis and
  Gurmukhi or Latin first-letter sequences.
- The full in-app Gurmukhi keyboard removes reliance on the device keyboard.
- Results can be intersected by text, Raag, contributor, TGGSP availability and
  individual TGGSP section type.
- Exact word totals, concordance pagination and optional form grouping retain
  the selected search scope.
- Blank search with the TGGSP filter lists mapped Sabads.
- Experimental theme search is clearly distinguished from complete source-text
  search.

## TGGSP and sources

- TGGSP sections now render on mapped Sabads, with a sensible available-layer
  fallback if the preferred sections are unavailable.
- Ten independently selectable English/Panjabi/Gurmukhi TGGSP section types are
  supported, with one attribution block per analysis view.
- The installed data audit confirms 948 mapped Sabads, no orphan mappings and
  all ten layers on the known mapping test.
- Bhai Gurdas Ji and Bhai Gurdas Singh Ji are presented as one contributor with
  939 passages, without rewriting the upstream source identifiers.

## Installation continuity

- This is the first APK signed with the permanent Gurbani Reader local release
  key. The previous debug-signed build must be uninstalled once before Pass 1
  can be installed. Pass 2 and later builds can then upgrade in place.
- Preferences and personal state use a separate native SQLite database, ready
  for Pass 2 collections, history and export/import.

## Pass 2 remains

Browse and Saved redesign, collections and notes workflows, the complete
frequency explorer, export/import, direct references and links, adaptive-layout
polish, accessibility QA and the v0.11 release candidate are deliberately kept
for the second combined pass.
