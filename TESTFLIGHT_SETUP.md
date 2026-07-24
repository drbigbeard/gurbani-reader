# Shabad Sojhi TestFlight setup

The repository can validate an iOS Simulator build without Apple credentials. The
`Upload Shabad Sojhi to TestFlight` workflow produces and uploads a signed device
build only when it is started manually and the protected `testflight` environment
contains all required secrets.

Apple has required App Store Connect uploads to be built with Xcode 26 and an
iOS 26 SDK since 28 April 2026. The upload workflow therefore uses GitHub's
macOS 26 runner and checks the Xcode major version before building.

## Fixed application identity

- Display name: `Shabad Sojhi`
- iOS bundle identifier: `com.drbigbeard.shabadsojhi`
- Marketing version: `0.16.0`
- Current build number: `22`
- Minimum supported iOS version: `15.0`

Android deliberately retains `app.gurbani.reader.local` so existing local
installations and their on-device data continue to work. The platforms therefore
have different stable identifiers.

Do not create an App Store Connect record with a different iOS bundle identifier.
Apple does not allow the bundle identifier associated with that app record to be
changed later.

## Actions that require the Apple account holder

### 1. Enrol for distribution

Join the Apple Developer Program using the Apple Account that will own the app.
A free Personal Team can install the app on that person's own device through
Xcode, but it cannot distribute the app to family through TestFlight.

Accept any current Apple Developer and App Store Connect agreements before
continuing.

### 2. Register the identifier

In Apple Developer → Certificates, Identifiers & Profiles → Identifiers:

1. Add an App ID.
2. Select **App** and **Explicit App ID**.
3. Description: `Shabad Sojhi`.
4. Bundle ID: `com.drbigbeard.shabadsojhi`.
5. Register it.

### 3. Create the App Store Connect record

In App Store Connect → Apps:

1. Choose **New App**.
2. Platform: iOS.
3. Name: `Shabad Sojhi` or an available store-listing variation.
4. Primary language: English (U.K.) or the preferred listing language.
5. Bundle ID: `com.drbigbeard.shabadsojhi`.
6. SKU: `shabad-sojhi-ios`.
7. Create the record.

The listing name can be edited later. The bundle identifier cannot.

### 4. Create an Apple Distribution certificate

The simplest first-time route is Xcode on the Mac:

1. Xcode → Settings → Accounts.
2. Add the Apple Account and select the paid developer team.
3. Select **Manage Certificates**.
4. Add an **Apple Distribution** certificate if one does not already exist.
5. Open Keychain Access, find the certificate under **My Certificates**, and
   confirm that it has an attached private key.
6. Export the certificate and private key together as a password-protected
   `.p12` file.

Keep the `.p12` and its password private.

### 5. Create an App Store Connect provisioning profile

In Apple Developer → Certificates, Identifiers & Profiles → Profiles:

1. Add a profile.
2. Distribution type: **App Store Connect**.
3. App ID: `com.drbigbeard.shabadsojhi`.
4. Select the Apple Distribution certificate exported above.
5. Name: `Shabad Sojhi App Store`.
6. Generate and download the `.mobileprovision` file.

### 6. Create an App Store Connect API key

In App Store Connect → Users and Access → Integrations → App Store Connect API:

1. Generate a team API key named `Shabad Sojhi GitHub TestFlight`.
2. Select **Developer** access. This is the least-privilege role Apple permits
   to upload builds; App Manager access is not required by this workflow.
3. Record the issuer ID and key ID.
4. Download the `.p8` private key. Apple permits this download only once.

Apple team API keys apply across every app in the developer account and cannot
be restricted to one app. The key's name is for reference only and cannot be
changed after generation.

Do not paste the key or certificate into chat or commit them to Git.

## GitHub environment and secrets

In the GitHub repository:

1. Settings → Environments → **New environment**.
2. Name it exactly `testflight`.
3. Add yourself as a required reviewer if the repository plan supports
   deployment protection rules.
4. Add these environment secrets:

| Secret | Value |
|---|---|
| `APPLE_TEAM_ID` | Ten-character Apple Developer Team ID |
| `APPLE_DISTRIBUTION_CERTIFICATE_BASE64` | Base64 of the exported `.p12` |
| `APPLE_DISTRIBUTION_CERTIFICATE_PASSWORD` | Password chosen during `.p12` export |
| `APPLE_PROVISIONING_PROFILE_BASE64` | Base64 of the `.mobileprovision` file |
| `APP_STORE_CONNECT_KEY_ID` | API key ID |
| `APP_STORE_CONNECT_ISSUER_ID` | API issuer ID |
| `APP_STORE_CONNECT_PRIVATE_KEY_BASE64` | Base64 of the downloaded `.p8` |

On macOS, create the three base64 values without copying binary data into the
browser:

```sh
base64 -i ShabadSojhiDistribution.p12 | pbcopy
base64 -i ShabadSojhi_App_Store.mobileprovision | pbcopy
base64 -i AuthKey_ABC123DEFG.p8 | pbcopy
```

Run one command at a time and paste the clipboard contents into only the matching
GitHub secret.

## Upload a build

1. Open the GitHub repository.
2. Select **Actions**.
3. Select **Upload Shabad Sojhi to TestFlight**.
4. Choose **Run workflow**.
5. Approve the protected environment deployment if GitHub requests it.

The workflow rebuilds and verifies the reading database, runs the application
audits, builds the native iOS app, checks that the provisioning profile exactly
matches the team and bundle identifier, archives the app, and uploads it.

Every subsequent App Store Connect upload must use a build number that has not
already been uploaded for version `0.16.0`. Increment
`CURRENT_PROJECT_VERSION` in both Debug and Release build settings before the
next upload.

## Enable family testing

After Apple finishes processing build 22:

1. App Store Connect → Shabad Sojhi → TestFlight.
2. Complete the required Test Information and Beta App Review contact details.
3. Create an external group named `Family`.
4. Add build 22 and enter clear **What to Test** text.
5. Submit the build for TestFlight review.
6. Once approved, invite family members by email or enable the group's public
   invitation link.

Each family member installs Apple's TestFlight app, accepts the invitation and
installs Shabad Sojhi. TestFlight builds remain available for testing for up to
90 days.
