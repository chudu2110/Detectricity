# Detectricity native redesign

2026-11-21. Product and visual requirements are in the
[workspace design brief](../../../../Agent-Rules/design-brief.md).

## Scope

- Build five signed-in destinations in a matcha, iOS-inspired design using shared native controls.
- Show authenticated meter data, read-only device detail, period energy data, bill coverage,
  forecast and alerts. Preserve loading, offline, empty and failure states and label estimates.
- Add a bilingual Assistant for streaming chat, history, feedback, transcription and playback.
- Keep Keycloak and existing app IDs and scheme, and persist device theme and locale with Vietnamese
  as the initial language.

## Decisions

My calls: use JavaScript Tabs for the matcha selection treatment and native React Native views for
the simple energy chart. Adapt local Taste Skill 2.5.1 to React Native and the requested palette.
Check the running app with native screenshots and touch and accessibility behavior.

## Docs touched

README, AGENTS, design system, architecture, data fetching, client state, components,
the wattprint-base skill and HANDOFF. The implementation plan and report record the checks.

## Glass revision

The user rejected the flat first pass and requested a luxurious iOS-inspired mirror-glass finish
with illustrated icons. Give shared matcha surfaces directional rims, graduated fills and soft
shadows. Use a floating dock with native blur of the active tab on supported devices, a material
fallback for reduced transparency, and selection motion that follows the system preference.
Reserve measured dock clearance for scroll content and hide the dock for text entry. Use the
illustrated icon family and decorative eco-house asset while keeping energy figures API-backed.

Update the workspace brief and entry point, frontend README, AGENTS, design system, architecture,
components, wattprint-base digests, HANDOFF and the redesign report. Check token contrast,
documentation links and the frontend gate, then verify the rebuilt native app and record device
coverage and limitations.
