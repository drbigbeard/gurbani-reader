# Gurbani Reader v0.15 RC 1

This release focuses on practical discovery and a calmer reading structure.

- Rebuilt search around ranked, tolerant Roman, Gurmukhi, phonetic and first-letter representations.
- Searches recognised voice alternatives together and opens the complete Shabad at the matched line.
- Adds a machine-readable 18-case regression gate covering varied phrases, optional nasal markers, selected Dasam Bani, Gurmukhi tolerance, first letters and negative cases.
- Renames the primary Browse destination to Read and reorganises it around All Banis, Nitnem, My Banis, Go to Ang, Raags, Contributors, Vaars, life events, and Words & meanings.
- Removes “Common Banis”, “Composition forms”, “Daily & Banis”, and the top-level Ceremonies tab.
- Uses compact solid/dashed translation rails with one legend instead of repeating provider names on every line.
- Fixes the welcome-tour source detour and adds tour replay from Library.
- Adds an explicitly experimental, microphone-based Identify Keertan test under Library. It stores transcripts, result references and family verdicts locally, never raw audio.
- Keeps the SGPC-only reading profile and adds portable line-reference and provider-coverage tables to the bundled database.

The APK is signed with the same persistent local-install key as the previous GitHub release. Android should therefore allow an in-place update over v0.14; do not install a locally built debug APK over the signed release.
