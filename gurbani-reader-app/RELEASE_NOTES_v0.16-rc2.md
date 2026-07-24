# Shabad Sojhi v0.16 RC2

This release keeps the existing Android application ID and iOS bundle ID, so it is an in-place upgrade despite the new displayed name.

## What changed

- Renamed the app to **Shabad Sojhi** with the descriptor **Read · Find · Understand Gurbani**.
- Replaced the previous sacred-symbol icon treatment with a restrained reading/focus mark.
- Rebuilt list and selected-state colours around semantic surfaces; Bani rows now keep neutral backgrounds and readable text across every theme and accent.
- Added one reusable multi-select filter pattern to Search, All Banis, Contributors, Raags, the word index, and contributor filtering within a Raag.
- Filters use **OR within one facet** and **AND across different facets**. Current selections persist; each view supports **Set as default**, **Reset to default**, and **Clear all**.
- Replaced the welcome slides with a short, goal-led first-use path that ends in a real task.
- Added contextual tips for Search and reader controls, plus a permanent searchable **Help & Guide** under Settings.
- Preserved legacy saved searches, My Banis/Saved Banis data, backup format, Android application ID, and iOS bundle ID.

## Release gates

- v0.15 search benchmark remains mandatory.
- TGGSP thematic-search positive and negative cases remain mandatory.
- Semantic contrast is audited for every theme, accent, surface and text role.
- Legacy filter migration and OR/AND facet semantics are automated.
- Backup compatibility includes RC2 filter configuration.

The TGGSP thematic-search proof of concept remains explicitly experimental. Mahan Kosh and extended Raag study pages remain deferred to v0.17.
