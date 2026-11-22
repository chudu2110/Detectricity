# Demo login and API checks

Date: 2026-11-21. Local working tree, no commit or push. No spec or plan closed.

## Status

The development demo now shows Login and enters the app when pressed, without Google.
Lint, typecheck and all 60 Jest suites / 508 tests pass (`pnpm check` through Corepack with
`npm_config_manage_package_manager_versions=false`, because the global pnpm shim is broken).
`pnpm format:check` passes. `npx expo-doctor` passes 19/20 checks; the existing 15 Expo package
version mismatches remain. No packages were upgraded.

Verified Login, Home, Energy, Settings and sign-out on SmartXu_API_36 (emulator-5554).
ReactNativeJS logcat has no E lines. Physical phone is not connected.
Metro and the host API remain running for the requested interactive demo.

## What exists

- `src/features/auth/hooks/use-sign-in.ts`: temporary commented demo branch, gated by development
  build, development app environment and explicit demo flag. No credentials are fabricated.
- `src/app/_layout.tsx`: app routes require signed-in state again, so Login stays visible until pressed.
- `src/screens/settings/index.tsx`: omit the authenticated profile in the demo; otherwise its request
  immediately expires the tokenless demo session when Settings mounts.
- Hook and Settings tests cover the demo and ensure the production environment retains real auth.
- README, architecture documentation and project skill tooling digest describe the new entry flow.

The sibling backend's ignored `.env` now contains the three supplied API credentials under the
names its settings loader expects. Credentials are absent from frontend environment variables.
OpenWeather current and forecast return 200; the backend weather adapter returns eight forecast slots.
OpenRouter authentication and a small chat completion return 200 with an actual answer.
AstralX `/models` returns only `chat-fast`; the supplied chat example returns 200 with a provider echo.
AstralX TTS returns 403 for `astralx-tts`. STT was not tested.
Host API docs/OpenAPI return 200; unauthenticated `/users/me` correctly returns 401.

## Review outcome

Local diff review, automated checks and emulator verification only. No independent review.

## Decisions and deviations

The user requested temporary Google bypass and an interactive demo. Keep the bypass local to the
development demo instead of disabling backend JWT validation. Existing Home, Devices and Energy
data remain mock-backed: supplying keys alone does not connect those screens to backend services.

## Deferred

Live data, identity infrastructure, voice permissions and Text2SQL are tracked in
[local demo integration](../backlog/2026-11-21-local-demo-integration.md).

## Next

Finish local Docker infrastructure on drive D, then connect the frontend data slices to backend APIs.
