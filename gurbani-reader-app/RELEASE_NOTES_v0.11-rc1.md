# Gurbani Reader v0.11 RC 1

RC 1 is the second and final combined v0.11 implementation pass. It includes
all Pass 1 work and combines the former Alpha 3, Alpha 4 and RC scope.

## Browse and frequency

- Banis can be filtered into the available Nitnem compositions, Vaaran, Raag
  collections and other compositions.
- Contributors can be filtered by Guru, Bhagat, Bhatt or other contributor and
  sorted alphabetically or by number of Sabads.
- Bhai Gurdas Ji remains one in-app contributor with 939 passages.
- Word frequency is no longer a top-list view: all 29,495 Guru Granth Sahib
  exact forms and all 12,871 Vaaran exact forms are reachable through
  pagination, search and Gurmukhi initial-letter filters.
- Concordance remains independently paginated to its complete scoped total.

## Personal reading

- Bookmarks and notes open the complete Sabad at the saved line.
- Named collections can be created and populated directly from line actions.
- Reading history keeps the latest 100 distinct Sabads.
- Search queries and their full filter scope can be saved and reopened.
- Personal data remains in a native database separate from the bundled reading
  data.

## Portability and references

- One JSON backup exports bookmarks, notes, collections, history, saved terms,
  saved searches and every reading preference.
- Android uses the native share/save sheet; import uses the system file picker
  and validates the backup before replacing current personal data.
- Line references copy Gurmukhi, contributor, Ang and stable text/Sabad/line
  identifiers.
- BaniDB and TGGSP attribution links are consolidated in the home data footer.

## Reading and accessibility

- Background, Gurmukhi and Latin/English colours are configurable alongside
  five themes, independent font scales and line spacing.
- Controls include visible keyboard focus, larger touch targets, reduced-motion
  handling, responsive compact layouts and accessible labels for primary search
  and filtering.
- Reading mode remains uninterrupted; Study mode exposes actions only when
  requested.

## RC audit

- TypeScript, web and native production builds pass.
- SQLite integrity and Pass 1 TGGSP/search checks pass.
- Complete form-index counts, 82 named Banis, saved-line/history lookup queries
  and backup/personal feature markers are checked automatically.
- Android version code is 13 and the final APK is signed with the same permanent
  key as Pass 1, allowing in-place upgrades from Pass 1.
