# Shabad Sojhi v0.16 RC3

RC3 adds a device-local, reviewable feedback loop around the app's most
important beta capabilities.

## What changed

- Written search now offers **Did you find what you meant?** and a dedicated
  zero-result correction path.
- Ordinary voice search preserves every recognised alternative in its feedback
  context and lets the tester correct the transcript.
- Identify Keertan lets the tester select the intended Shabad or search for it
  manually when it was not suggested.
- Experimental TGGSP theme suggestions can be marked relevant, not relevant or
  missing expected material.
- A new **Settings → Feedback** screen lists, deletes and exports feedback
  records.
- Feedback export is separate from the personal backup and excludes raw audio,
  bookmarks, reflections and reading history.
- A review compiler deduplicates exported corrections and produces pending
  benchmark candidates. Nothing changes search without human review.

## Release gates

- All existing tolerant written, voice, first-letter and negative search cases
  remain mandatory.
- TGGSP theme positive and negative cases remain mandatory.
- Feedback exports must retain stable Shabad and line IDs and all recognition
  alternatives.
- Review tooling must reject exports containing personal notes or reading
  history.
- Android and iOS native builds remain mandatory.
