# Gurbani Reader v0.13 RC 1

This is an installable local Android test build. It is not an App Store or Play Store release.

## Reading and translation

- Translation now has exactly three states: Off, BaniDB, and TGGSP where available. TGGSP is the default.
- Verified TGGSP line translations remain directly beneath their Gurbani line.
- A TGGSP translation supplied for a whole passage or Pauri remains once at the end of that passage. It is not silently replaced line by line.
- BaniDB English translation is available per line as a separate option and as the fallback where TGGSP supplies no translation.
- TGGSP word material is labelled “TGGSP word details” and shows only the supplied meaning, grammar and etymology fields.

## Added readings

- Jaap Sahib, Shabad Hazare Patshahi 10, Tav-Prasad Savaiye and Benti Chaupai use BaniDB’s SGPC `length=s` reading.
- The SGPC readings for Rehras Sahib and Ardas are included as compiled readings rather than being mislabelled wholly as Dasam Bani.
- TGGSP Birth/Naming, Amrit Sanskar, both Anand Sanskar parts, Lava and Antam Sanskar are available in an ordered life-event path.

## Interface

- Go directly to Ang shows the total, such as `/1430` for Guru Granth Sahib.
- Go to Ang and Continue reading share a compact Home row; Continue reading names the saved Bani or reading where possible.
- Appearance and Layers open as compact panels with an explicit Close control. Android Back closes a panel before navigating.
- Browse defaults to All and A–Z where appropriate; category/type controls appear above the free-text filter.
- The Gurmukhi font can be toggled between Normal and Bold.

## Review workbook

The separate XLSX contains draft line allocations for 76 TGGSP passage translations. It is not imported into this app build. Only manually reviewed wording is eligible for v0.14.

Text and baseline translations are from BaniDB. The Guru Granth Sahib Project material is from Sikh Research Institute and is used with permission.
