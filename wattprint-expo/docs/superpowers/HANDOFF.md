# HANDOFF: wattprint-expo (refreshed 2026-11-21)

Read this first after a compaction or in a new session. It holds goals, standing rules, state and next steps. Keep it short;
details live in specs, plans, reports and the backlog. Update it when goals move.

## Product and stack

Detectricity is a household energy assistant for Vietnam. Expo SDK 58 / RN 0.88 uses Expo Router
JavaScript Tabs, Uniwind, gluestack, TanStack Query, Zustand/MMKV, SecureStore and i18next.
The sibling FastAPI backend validates Keycloak JWTs. Start with the
[workspace guide](../../../Agent-Rules/README.md) for references, runtime, logs and screenshots.
Read the repo `README.md`, `AGENTS.md` and their area docs before editing.

Repo: `D:\Pinnovation2\wattprint-expo`, origin <https://github.com/daFoggo/wattprint-expo>.

## Standing rules

- Full permission to act; do not ask for permission. If blocked, propose a way and keep going; report in a note at the end. Work
  autonomously until the goals are met.
- Follow the superpowers workflow: brainstorming, design doc, writing-plans, subagent-driven development; a fresh subagent per
  task, a task review, a final review, one fix wave. Record calls the user was not asked about as "my calls" in the design docs.
- Model convention (global `CLAUDE.md`): plan and design go to `planner` (Opus); code to `implementer` (Sonnet); review to `reviewer`
  (Opus); exploration and logs to `scout` or `runner`. Always pass `model` explicitly. Never use Fable models.
- Debug device: the **physical phone** (Pixel 8a, adb serial `3C081JEKB17021`, app id `com.dafoggo.wattprint.dev`), changed by the
  user on 2026-10-26. Always `adb -s 3C081JEKB17021 ...`; Metro through `adb -s 3C081JEKB17021 reverse tcp:11094 tcp:11094` and a
  deep link with `localhost:11094` (`AGENTS.md` "Device verification"). The emulator `Medium_Phone_API_37.0` (`emulator-5554`) is an
  optional fallback: its builds are x86 and the phone is ARM, so an x86 apk does not install on the phone. Restart the emulator:
  `Start-Process "$env:ANDROID_HOME\emulator\emulator.exe" -ArgumentList '-avd','Medium_Phone_API_37.0','-no-snapshot-save'`.
- Progress rule: if a subagent task runs longer than about 5 to 10 minutes, check real evidence (git log, newest files, processes,
  adb) instead of waiting. `expo run:android` and `expo start` never exit (Metro); an agent "waiting on background work" for that is
  stuck. Tell it to proceed and kill Metro (listener on :11094). Never block on non-terminating processes.
- Evidence over claims: run commands, show results; measure before claiming "fast" (method: `docs/performance.md` section 8).
- Documentation rule (`AGENTS.md`): change the rule, the doc and the skill in one commit; a spec lists the docs it touches.
- Commits: conventional (commitlint), hooks run (lint-staged, commitlint), never bypass them.

## Gates (implementer brief)

You are the implementer. A task is done only when every gate below ran and you report the real result, including failures.
Run from the repo root on a clean working tree. `.claude/worktrees/` is ignored by git, lint, Jest and Prettier
(`.claude/skills/` is tracked and checked); do not delete other sessions' worktrees.

| #   | Gate                  | Command                                                  | Pass condition                                                  |
| --- | --------------------- | -------------------------------------------------------- | --------------------------------------------------------------- |
| 1   | Format                | `pnpm format:check`                                      | "All matched files use Prettier code style" (`docs/` is ignored by Prettier) |
| 2   | Lint, types, tests    | `pnpm check`                                             | `eslint --max-warnings 0`, `tsc --noEmit` and `jest --ci` all exit 0 |
| 3   | Expo config           | `npx expo-doctor`                                        | all checks pass                                                 |
| 4   | Phone (UI, native)    | see `AGENTS.md` "Device verification"                    | app relaunched, screenshot taken, `adb logcat -d ReactNativeJS:V *:S` has no `E` lines |
| 5   | Docs                  | routing table in `AGENTS.md`                             | the docs for the area you touched are updated in the same commit |

Guards inside gate 2 (each has self-tests that fail first when you break the rule):

| Test                            | Catches                                                                                      |
| ------------------------------- | -------------------------------------------------------------------------------------------- |
| `scripts/boundaries.test.ts`    | import boundaries (`eslint.boundaries.js`)                                                   |
| `scripts/uniwind-guard.test.ts` | classes Uniwind ignores on native, missing `*ClassName` colour bindings                      |
| `scripts/design-guard.test.ts`  | hex and `rgb()`/`hsl()` literals, `dark:` colour pairs outside `src/components/ui`            |
| `scripts/docs-links.test.ts`    | broken relative doc links, backticked repo paths that do not exist, routing-table skills that are neither project nor listed global |
| `scripts/config-guard.test.ts`  | web imports, NativeWind or template leftovers, Metro and Uniwind wiring                      |
| `scripts/app-identity.test.ts`, `scripts/app-config.test.ts` | application ids per env, `eas.json` assertions            |

Rules for you: stay inside the task; copy the nearest existing file instead of inventing; TDD where possible (test red first);
no new dependency unless the task names it (install with `npx expo install`, see `AGENTS.md`); never run `eas build`.

## Report template

At the end of a chunk of work write `docs/superpowers/reports/YYYY-MM-DD-<topic>.md` (template and rules in
`reports/README.md`): Status, What exists, Review outcome, Decisions and deviations, Deferred (link a `backlog/` file per open
item), Next. Reference report: `reports/2026-10-25-base-and-data-layer.md`.

## Goals and status

- **G1 to G5 done and merged to `main`** (Uniwind native compatibility, data-fetching research, validation with the Expo skills,
  benchmarks (data removed on 2026-10-26), architecture). Details: `reports/2026-10-25-base-and-data-layer.md`.
- **Documentation pass** (branch `docs/base-documentation`): `docs/components.md`, `design-system.md`, `client-state.md`,
  `performance.md`, the routing table in `AGENTS.md`, `scripts/design-guard.test.ts`, reports and backlog folders.
- **Detectricity redesign** uses authenticated Home, Devices, Energy, Assistant and Account screens
  with the matcha theme, Vietnamese default and persisted locale. Legacy mock views remain for tests.
- **Android verified on SmartXu_API_36 emulator.** The CMake path setting reduced generated object paths
  and Gradle built and installed the APK. Demo login, Home, Devices/detail, Energy day/week and streamed
  Assistant replies worked. History reopened and feedback returned 204. The physical Pixel was unavailable.
- **External services** Google OAuth needs credentials. The native speech request returned 503 after the
  configured AstralX model returned upstream 403. Expo Doctor passed 19 of 20 checks with 14 baseline SDK
  dependency version mismatches remaining.
- The user rejected the flat first pass and requested glossy iOS-inspired matcha glass and illustrated
  icons. Follow the [design system](../design-system.md) for surfaces, the native-blur dock and artwork.
  See the [redesign report](reports/2026-11-21-detectricity-redesign.md#glass-revision) for implementation
  evidence and gates.
- The signed-in layout calls `Keyboard.isVisible()` on its receiver. Passing that method directly
  to a React state initializer crashed the native demo after login. The regression test is
  `scripts/app-layout.test.tsx`. All five tabs and a sourced AI billing response were verified
  on SmartXu API 36 after the fix.

## Next

The default Home demo opens onto a kinetic landscape. Use the artwork's pause control or the
device's Reduce Motion preference to freeze it. Energy has an adjustable plot and Assistant
has an animated welcome orb. The native clip (historical artifact unavailable in this workspace)
records all three.

The demo was left open with Metro, API and workers running at the user's request. Verify on the
physical phone when connected using `AGENTS.md`. Google OAuth and successful speech playback depend on
provider credentials and model access.

## Environment pitfalls (learned the hard way)

- Windows 260-character path limit: `LongPathsEnabled=1`, SDK CMake 4.1.2 through `plugins/with-android-cmake-dir.js` (win32 only,
  on prebuild with `-DCMAKE_OBJECT_PATH_MAX=250` to hash generated object paths), `nodeLinker: hoisted`. Skia's CMakeLists needs `CMAKE_POLICY_VERSION_MINIMUM=3.5` in the environment of
  `pnpm android` with CMake 4.x (`README.md` "Skia and CMake 4.x").
- victory-native is pinned to 42.0.1 (Skia 2.14.0 from Expo); upgrade trigger in `backlog/2026-10-26-victory-native-43-upgrade.md`.
- `core.autocrlf=true` globally, so `.gitattributes` forces LF; after a `git checkout` or merge that removes tracked files, check
  the working tree (a merge once deleted the untracked `claude-config-summary.md`; it is git-ignored now).
- `npx expo install ... -- --dev` misbehaves on Windows: use `pnpm add -D`.
- The gluestack CLI forces NativeWind when `android/` exists and installs alpha packages: never run it; components are hand-copied
  (stable core 5.0.15, utils 5.0.6).
- Skills are installed globally with `npx skills add <repo> --skill '*' -g -y` in PowerShell (Windows junctions from
  `~/.claude/skills` to `~/.agents/skills`). Git Bash symlinks are not readable by native Windows tools. The only repo-local skill is
  `wattprint-base` (`.claude/skills/wattprint-base`, tracked); the routing table names it and the global ones.
- Bash heredocs with unbalanced quotes can break the tool: write files with the Write tool.
- `docs/` is in `.prettierignore`, so Prettier does not check Markdown there; keep lines near 110 characters by hand.
