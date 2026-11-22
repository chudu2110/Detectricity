# Local demo integration

Date: 2026-11-21. Start when the local Docker engine and database are available.

## Verified facts

- Demo and Google sessions now both use the dashboard API slice; the demo obtains real Keycloak tokens.
- Docker, database, Keycloak, replay and CPU NILM are running locally; authenticated business APIs return 200.
- OpenWeather and OpenRouter credentials work in direct smoke checks.
- The supplied AstralX key lists only `chat-fast`; chat responds with a provider echo and TTS returns 403.
- Text2SQL connection details were not supplied.
- Only an emulator is connected; the physical verification phone is absent.

## Remaining work

Configure and verify actual Google OAuth. The local authenticated demo is operational with REFIT data,
so testing the core screens does not depend on Google credentials.
Obtain AstralX STT/TTS access and Text2SQL configuration before claiming those paths work end to end.
