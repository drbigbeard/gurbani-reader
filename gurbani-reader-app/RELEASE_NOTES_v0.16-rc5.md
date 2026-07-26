# Shabad Sojhi v0.16 RC5

RC5 is a corrective voice-recognition and TGGSP-alignment release.

- Recognition now has one shared lifecycle with explicit Stop, automatic timeout,
  stale-session cleanup and navigation cleanup.
- iOS probes Apple legacy and iOS 26 on-device recognition using Punjabi locale
  variants rather than forcing the legacy `pa-IN` path.
- A cross-platform enhanced Punjabi route supports the documented
  `pa-Guru-IN` locale through a secure proxy when configured.
- Settings can generate a device capability report showing the recognition
  routes actually available.
- Unverified TGGSP line correspondence is no longer interleaved with BaniDB.
  The intact TGGSP rendering appears at the end of the relevant passage/Pauri.
- Asa Di Vaar is explicitly gated to passage-level TGGSP translations until a
  strict line mapping has been manually verified.
