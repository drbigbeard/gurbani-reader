# Shabad Sojhi v0.16 RC4

RC4 repairs iOS voice access and tightens the reading structure and small-phone interface.

## What changed

- iOS voice search and experimental Identify Keertan now use a maintained native Speech Recognition bridge.
- The first microphone use requests both Speech Recognition and Microphone access instead of incorrectly reporting that recognition is unavailable.
- Punjabi and Roman/English recognition request up to five alternatives and pass them to the tolerant search engine.
- Nitnem is presented in recitation order and uses the full Anand Sahib.
- Short Anand Sahib is a separate commonly used reading in All Banis.
- Anand Sanskar is one ordered ceremony containing its opening readings, Laavan, and concluding readings.
- Commonly read Banis now appear first, including Asa Di Vaar, Sukhmani Sahib, Salok Mahalla 9, Anand Sahib and other frequently used readings; A–Z remains available.
- Six TGGSP heading translations that were attached to the following Gurbani line are repaired without moving genuine whole-Pauri translations.
- Saved Banis use an explicit filled star, can be reordered, and all Library sections are visible without a hidden horizontal swipe.
- The Home Ang/Continue Reading controls reflow safely on narrow iPhones such as iPhone XR.

## Required physical-device gate

Before the build is released to external testers, test build 23 on an iPhone:

1. Tap either microphone entry point.
2. Confirm iOS asks for Speech Recognition and Microphone permission.
3. Accept both and confirm Punjabi voice search returns a transcript.
4. Play Keertan in the background, open Identify Keertan, and confirm listening begins and produces candidates.

Automated checks verify the native package, permission call, locales, alternatives, database and Apple build configuration. Apple permission dialogs and real microphone capture require a physical device.
