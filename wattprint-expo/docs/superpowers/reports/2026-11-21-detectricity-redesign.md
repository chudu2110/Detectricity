# Detectricity redesign report

2026-11-21. See the [spec](../specs/2026-11-21-detectricity-redesign.md) and
[plan](../plans/2026-11-21-detectricity-redesign.md).

## Status

The direct Gradle `assembleDebug` build succeeded in 1m 8s. APK Signature Scheme v2 verification
passed, and `adb install -r` returned Success. Native verification used the SmartXu_API_36 emulator.
The physical Pixel was unavailable over USB.

Before the final source fixes, `pnpm check` passed lint and types with 67 Jest suites and 553 tests.
Jest reported a worker teardown warning. `pnpm format:check` passed. The final full checks were
running when this record was updated. Every applicable token pair passed the contrast report
(verified: `node scripts/contrast-report.js`). Backend Copilot API and LLM tests passed, 16 total.

## What exists

- The signed-in JavaScript tab bar presents Home, Devices, Energy, Assistant and Account with matcha
  primitives and localized labels (verified: `src/app/(app)/_layout.tsx`, `src/components/app-ui.tsx`,
  `src/components/app-tab-bar.tsx`).
- The authenticated screens show replay meter data, labelled device estimates and detail, day/week/month
  energy, billing and forecast, home settings and alerts (verified: `src/screens`, `src/features/dashboard`).
- Copilot supports streaming, conversations, feedback and native voice requests through the shared
  HTTP client (verified: `src/features/copilot`, `src/lib/http.ts`).
- Docs updated: README, AGENTS, design system, architecture, data fetching, client state, components,
  wattprint-base digests and HANDOFF.

## Review outcome

The documentation link guard passed (verified: `node node_modules/jest/bin/jest.js --runInBand scripts/docs-links.test.ts`).
Documentation was checked against the current frontend routes, state, HTTP and audio implementation.
The authenticated REFIT demo returned HTTP 200 for overview, devices, bill, home, preferences and
conversation history. Live Copilot returned SSE metadata, steps, tokens and a done event. The provider
previously returned 402 because the request omitted a completion limit and it reserved 65,536 tokens.
The backend now sends the configured completion limit, default 2,048, bounded to 128–8,192.

The first rebuild hit Ninja's 260-character object filename limit after Skia compiled. Expo prebuild
now applies `-DCMAKE_OBJECT_PATH_MAX=250` through the Windows config plugin. The earlier 128-character
setting was shorter than the generated output directory and prevented hashing. With the 250-character
setting, the calculated hashed path for the offending object is 239 characters. The host has Windows
long-path support disabled, and the registry update was denied. The successful build hashed the generated paths with the revised
configuration (verified: `plugins/with-android-cmake-dir.js`, `scripts/android-cmake.test.ts`).

Expo Doctor passed 19 of 20 checks after Expo Constants was updated from 58.0.15 to 58.0.16.
The remaining check reports 14 baseline SDK dependency version mismatches.

On the emulator, login, Home, Devices, device detail, Energy day and week, and Assistant worked.
A native streamed answer used measured bill tiers and sources. Feedback returned HTTP 204.
Conversation history and reopening the same conversation each returned HTTP 200. The speech action
returned HTTP 503 because AstralX rejected the configured TTS model with an upstream HTTP 403.

The async `expo/fetch` import stalled for 191 seconds on a Metro development chunk. The shared
client now uses a synchronous guarded require for the native transport, with a default-transport
test. In one run with `--max-workers 2`, Metro bundled 2,273 modules in 3.5 seconds.

Late source fixes set the Account stack's initial route to Settings, route Back to the Account root,
keep the welcome view from auto-scrolling, and label the day chart endpoint 24:00.

## Decisions and deviations

My calls: use JavaScript Tabs for the custom native bar, keep existing app identifiers and scheme for
compatibility, and apply Taste Skill 2.5.1 using Android verification and the requested matcha palette.
The loopback-only demo uses public REFIT House 2 recordings through an authenticated Keycloak session.

## Deferred

Google OAuth needs provider credentials. Successful speech playback requires provider access for
the configured TTS model (verified: [workspace record](../../../../Agent-Rules/README.md)).

## Next

The demo remains open with Metro, API and workers running at the user's request. Physical Pixel
verification is pending until the device is connected. Confirm Google OAuth and speech playback
when provider credentials and model access are available.

## Glass revision

2026-11-21. The user rejected the flat first pass and requested a luxurious iOS-inspired mirror-glass
finish and illustrated icons. The revision adds glossy matcha surfaces with directional rims and
soft shadows, ambient page lighting, 12 custom SVG illustrations and a native-blur dock that samples
the active tab scene. The dock hides for keyboards, the selection spring respects Reduce Motion,
and iOS Reduce Transparency uses the gradient fallback. Home and sign-in use the transparent
eco-house PNG. Assistant uses the shared lighting, illustrated prompt cues and glass composer.
Artwork is decorative. The household measurements and estimates continue to come from dashboard APIs
(verified: `src/components/glass-surface.tsx`, `src/components/app-tab-bar.tsx`,
`src/components/illustrated-icon.tsx`, `src/components/house-illustration.tsx`,
`src/screens/home/index.tsx`, `src/screens/auth/sign-in.tsx`, `src/screens/assistant/index.tsx`).

Built-in ImageGen generated the transparent hero in image generation mode. Prompt and save-path
record: [glass art prompt](../../../../Agent-Rules/references/glass-art-prompt.md).
The app asset is `assets/illustrations/eco-home-glass.png`.

The direct Gradle build with Expo Blur 58.0.6 completed in 2m 24s (verified:
Android build log (historical artifact unavailable in this workspace)).
Every modeled token pair in the revised contrast report passed
(verified: `node scripts/contrast-report.js`).

Installed on SmartXu API 36 and reproduced a crash after pressing Bắt đầu. Passing
`Keyboard.isVisible` directly to React lost the native object's receiver. The signed-in layout
now calls the method on Keyboard. A mount regression test covers the failure. The Account stack
uses Expo Router's supported settings anchor.

After a cold start the demo signed in, populated the dashboard and opened all five tabs. The
Assistant dock hid on keyboard entry, returned on dismissal, and the billing prompt produced
a streamed answer with tariff and meter sources. Account reopened on its settings page. The
final cold-start session recorded no React Native JS warnings or errors during sign-in and
Account verification. The demo was left on Home. Physical-device and iOS checks remain pending.
See Home (historical artifact unavailable in this workspace) and
Assistant (historical artifact unavailable in this workspace).

Frontend checks (historical artifact unavailable in this workspace) passed lint, types and all
572 tests in 69 suites, with a Jest worker teardown warning.
Formatting (historical artifact unavailable in this workspace) passed.
Expo Doctor (historical artifact unavailable in this workspace) passed 19 of 20 checks and
reported 14 SDK package version differences.

Docs updated: workspace entry point and design brief, frontend README and AGENTS, design system,
components, architecture, wattprint-base, HANDOFF and the redesign spec.

## Typography, controls and motion

The new layout gives the meter value, unit and reading status distinct type sizes. At regular
phone widths the house sits next to the reading, moving the Assistant action above the dock.
Larger type or narrow screens stack the illustration. Two static Bricolage Grotesque weights
with Vietnamese coverage are bundled under the SIL Open Font License in `assets/fonts`.
Body text retains the platform font. Pressable rows, buttons, the segmented period selector
and screen entrances use short motion with system reduction. Assistant suggestions fill and
focus the editable field. During streaming the user's send action becomes Stop.

Verified on SmartXu API 36 at default settings and with transition animation scale 0 and font
scale 1.5. The emulator preferences were restored. Home, Energy period selection and Assistant
drafting were exercised in the native client. See the
motion recording (historical artifact unavailable in this workspace).
Lint, typecheck and 577 tests passed (historical artifact unavailable in this workspace);
Jest reported a worker teardown warning. Format passed (historical artifact unavailable in this workspace).
Expo Doctor (historical artifact unavailable in this workspace) reports the existing 14
package version differences in one check. Physical phone and iOS verification remain pending.

## Kinetic landscape and interaction

Home and sign-in now render an illustrated landscape around the existing house. Turbines rotate,
clouds drift and light travels on a Bézier track. These layers are decorative. Home can pause
the artwork. Energy reveals the measured bars progressively and supports direct time-slot
selection. Assistant animates its welcome orb and the activity indicator. Tab transitions
follow the direction of travel without replacing the tab state.

The SmartXu API 36 emulator was tested with the Home scene running, paused, under OS Reduce Motion,
then resumed. Separate frames of the landscape changed while running and were identical while
paused or reduced. The original OS preference was restored. See the
device recording (historical artifact unavailable in this workspace).
Lint, types and 579 tests (historical artifact unavailable in this workspace) passed, with the
existing Jest worker teardown warning. Formatting (historical artifact unavailable in this workspace)
passed. Expo Doctor (historical artifact unavailable in this workspace) passed 19 of 20 checks.
