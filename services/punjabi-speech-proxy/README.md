# Shabad Sojhi Punjabi speech proxy

This private beta service sends a short, transient recording to Google Cloud
Speech-to-Text V2 using the documented Punjabi Gurmukhi locale
`pa-Guru-IN` and the `chirp_2` model. The service does not write audio or
transcripts to storage.

The mobile applications never contain a Google service-account credential.
For the family beta they send a separate, revocable beta access value to this
proxy. Apply Cloud Run request and cost limits before distributing more widely.

## Required Google Cloud configuration

1. Create or select a billed Google Cloud project.
2. Enable Cloud Speech-to-Text and Cloud Run.
3. Deploy this directory to Cloud Run in `europe-west4`.
4. Give the Cloud Run runtime service account the Speech-to-Text User role.
5. Configure `SHABAD_SOJHI_BETA_KEY` as a Cloud Run secret.
6. Build the app with:

   - `VITE_ENHANCED_SPEECH_URL=https://YOUR_SERVICE/v1/recognise`
   - `VITE_ENHANCED_SPEECH_TOKEN=THE_REVOCABLE_BETA_KEY`

Do not put a downloaded Google service-account JSON key in the application or
in the repository.
