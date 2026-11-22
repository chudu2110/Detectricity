# Local demo report

Date: 2026-11-20. Local working tree; no commit or push. No spec or plan closed.

## Status

UI demo running on the existing SmartXu_API_36 emulator development build. Physical verification
phone is not attached. Metro remains running on port 11094 because the user requested an interactive demo.
The user confirmed that external credentials will be supplied later.

Validation: `pnpm check` passed lint, typecheck and 60 Jest suites / 503 tests. `pnpm format:check`
passed. `npx expo-doctor` passed 19/20 checks; its version check reports 15 existing Expo packages
behind the SDK's current recommendations. Dependencies were installed from the frozen lockfile.
No dependency upgrades or native rebuild were performed. Home and Energy rendered on the emulator;
ReactNativeJS logcat contained no E lines during the check.

## What exists

`src/env.ts` validates `EXPO_PUBLIC_DEMO_MODE` (default `0`). `src/app/_layout.tsx` allows the app
route group under `__DEV__` with the flag set to `1`, without fabricating credentials. `.env` enables
the local demo; `.env.example` leaves it disabled. Existing device and energy mocks are unchanged.
`src/env.test.ts` covers the flag's default, explicit opt-in and rejection of invalid values.

The sibling backend checkout is installed using Python 3.14 and its frozen uv lockfile. Uvicorn serves
port 11093; `/docs` and `/openapi.json` return HTTP 200, with 26 documented paths. Database-dependent
endpoints are not verified: Docker/TimescaleDB and Keycloak are not installed or running here.

## Review outcome

Local checks and emulator screenshots only; no independent review. Backend source is unchanged.

## Decisions and deviations

Use the already installed development client to preview JS instead of rebuilding Android. Leave
Metro running for the requested demo. The demo bypasses only client navigation, never API authorization.
Settings profile still requires a real session. Documentation updated in README, architecture and
the project skill's tooling digest.

## Deferred

Live data, login and AI configuration remain outside this UI preview; see
[auth backlog](../backlog/) and the sibling backend README for setup requirements.

## Next

Set `EXPO_PUBLIC_DEMO_MODE=0` and restart Metro when configuring real login. Start the backend's
Docker Compose services and supply Google OAuth / AI keys before testing authenticated features.
