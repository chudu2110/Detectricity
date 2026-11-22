# Authenticated local demo and live dashboard

Date: 2026-11-21. Local working trees; no commit or push. No spec or plan closed.

## Status

Login now skips Google only in the explicit development demo, obtaining a real Keycloak session
for the seeded REFIT account. Home, Devices, Energy and Settings use authenticated backend APIs.
Verified on SmartXu_API_36: Login, live power, weather, devices, energy chart, profile, sign-out
and signing in again. The physical phone is not attached.

Validation: frontend lint, TypeScript, 62 Jest suites / 522 tests and formatting pass.
Backend auth/security tests pass (30 tests); Ruff checks and formatting pass on changed Python files.
Docker Compose configuration validates. Expo Doctor passes 19/20 checks; the existing 15 Expo
package version mismatches remain. No Expo/native dependency upgrades were performed.

## What exists

- `src/features/dashboard/`: Zod backend contracts, authenticated API calls and query options.
- `src/screens/live-dashboard.tsx`: power and today's kWh, province weather, read-only inferred
  devices, and the last 24 hours of main-meter energy using the existing EnergyChart.
- All three tab routes use these screens for demo and Google sessions; API failures never produce mocks.
- `src/lib/auth-client.ts`: loopback demo sign-in and token renewal, without shipping backend credentials.
- `src/lib/session.ts`: demo bootstrap waits for the Login button; logout clears user scope without
  signing out a separate stored Google session. The authenticated profile works in the demo.
- Sibling backend `app/modules/auth/routes/demo.py`: opt-in, loopback-only demo endpoint. It verifies
  the real JWT, dedicated client, fixed identity and absence of admin roles. Disabled by default.
- Tests cover production guards, token renewal, unavailable backend, profile access, readings,
  chart unit conversion, invalid contracts, and the visible demo account label.

## Local runtime

Docker Desktop is installed at D:/Docker; its WSL disks are under D:/DockerData. Database and Keycloak
are running and healthy, Alembic is at head 4d1e7b9c2a58. The host API, REFIT replay, CPU NILM worker
and Metro remain running for the requested interactive demo. PyTorch CPU and its cache are on drive D.

The available House 2 recording is replayed from its last week, with two days seeded and more readings
ingested continuously. CPU inference produced over 74,000 estimates on the initial pass and keeps updating.
This is archived public REFIT data, not measurements of the user's personal home. The demo home's weather
province is Ho Chi Minh for demonstration. The supplied test email has demo home membership ready for Google.

Authenticated demo login, overview, devices, weather and profile return 200; the series API returns actual
energy buckets. The regular mobile client's direct grants remain disabled. The dedicated local demo client
has the API audience mapper and basic/profile/email/roles default scopes.

The host migration initially triggered the historical REFIT seed. That import was interrupted; existing
committed rows remain, and migration completed with SEED_REFIT=0. No imported data was deleted.

## Review outcome

Automated checks, local diff review and emulator verification only. No independent review.

## Decisions and deviations

Keep business API JWT validation intact. The local shortcut exchanges server-held demo credentials
for a normal Keycloak token rather than fabricating signed-in state. The server endpoint is disabled by
default and rejects non-loopback access. Production builds keep Google/PKCE.

Do not offer pretend appliance switching: the backend exposes NILM estimates, not actuation.
Energy currently offers a rolling 24-hour chart; mock day/week/month controls are not used for real data.
The existing mock fixtures/screens remain as test fixtures. Windows temporary download cleanup was blocked
by automatic policy review, so those files remain on drive D.

## Deferred

Actual Google OAuth remains unverified until the user supplies Client ID/secret. OpenWeather and OpenRouter
smoke checks pass. AstralX chat responds with a provider echo; TTS returns 403 for the supplied key and
STT was not tested. Text2SQL connection details are missing. See
[local demo integration](../backlog/2026-11-21-local-demo-integration.md).

## Next

Configure Google identity provider credentials in Keycloak, turn the frontend demo flag off, restart
Metro/app and verify Google login and the invited account's home. The authenticated local demo is usable now.
