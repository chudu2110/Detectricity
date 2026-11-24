# Detectricity: agent entry point

Updated 2026-11-21. Read the product brief and repository rules before editing.

## Read in this order

1. [Product brief](references/Detectricity.pdf): Detectricity, a Vietnamese household energy assistant.
2. [Design and implementation brief](design-brief.md).
3. [Frontend rules](../wattprint-expo/AGENTS.md) or [backend rules](../wattprint-backend/AGENTS.md).
4. Frontend architecture, data, design-system and component docs under `wattprint-expo/docs`.
5. [Taste Skill](skills/taste-skill/SKILL.md), installed from Leonxlnx/taste-skill for reuse.

## Folders

- `logs/`: API, Metro, emulator, replay, NILM and check output. Older runs keep their existing names.
- `screenshots/`: device screenshots and visual QA artifacts.
- `references/`: the original PDF, its rendered pages, the previous API setup guide, and the [glass hero image prompt](references/glass-art-prompt.md).
- `skills/`: local reusable skills. Repository-specific instructions remain in each repo.

[USB phone setup](phone-setup.md): current Samsung device, port forwarding, demo login and known limitations.

## Runtime

Docker Desktop is installed at `D:\Docker`; container disks are at `D:\DockerData`.
Database: 11096. Keycloak: 11095. Host FastAPI: 11093. Metro: 11094.
The Android development app id and URL scheme remain compatible with the existing installed build.

The development demo uses a real, loopback-only Keycloak session for REFIT House 2.
The public REFIT recording is static demo data; these are not measurements of the user's personal home.
Backend JWT validation remains enabled. Google credentials are still required to verify Google sign-in.

Secrets belong only in the existing backend/frontend `.env` files as appropriate. Never place a private
key in an `EXPO_PUBLIC_*` variable or this folder. The earlier setup guide is reference material;
the current code and product brief take precedence over old Wattprint/Wappi naming.

## Verification

Follow the frontend's required lint, type, test, format and Expo checks, then verify the native app.
Use the attached physical phone when available; otherwise label emulator verification explicitly.
Do not claim speech-provider success from a working microphone UI: the currently supplied AstralX
key previously allowed chat but rejected the configured TTS model.
