# Detectricity rebuild

Kind: native consumer software, an energy assistant for Vietnamese households.
Primary action: understand a home's electricity use and ask the assistant what to do next.
Source: references/Detectricity.pdf, supplied by the user on 2026-11-21.

## Product

Explain bills and appliance consumption using tool-computed figures. Support Vietnamese conversation,
grounded explanations, proactive alerts and actionable savings suggestions. Device estimates must be
labelled as estimates. Never invent savings, prices, home readings or AI answers.

## Visual direction

The user requests a complete UI/UX replacement with an iOS-like commercial finish and light matcha green,
referencing the pale sage iPhone finish. Use warm off-white, pale matcha surfaces, forest text and a
restrained dark matcha action colour with verified contrast. The user rejected the flat first pass
and requested a luxurious iOS-inspired mirror-glass finish with beautifully illustrated icons.
Use softly lit matcha backgrounds, translucent fills, bright upper rims and soft shadows to establish
depth. The floating dock uses native background blur where supported. Use the illustrated navigation
and appliance icons and the eco-house art on Home and sign-in. The art is decorative and energy
figures, bills and device estimates come from the existing APIs.
Keep a single radius/type/spacing system. See the [frontend design system](../wattprint-expo/docs/design-system.md).
Five destinations: overview, devices, energy, assistant, account. Place account and home settings together.
Device rows open meaningful details; data controls must not imply unsupported remote switching.

## Taste Skill adaptation

Apply its concise product-specific copy, real material, equal edges, clear hierarchy, consistent system,
honest empty/error states and restrained press feedback. Its HTML landing-page sections, WebGL scenes,
browser layout dealers and browser gate do not apply to this existing React Native Android application.
Use native screenshots, accessibility, touch targets, light/dark mode and project checks instead.
The user's requested matcha palette takes precedence over random website palette selection.

## Architecture

Replace the old screen bodies and demo gallery. Retain the working auth, validated HTTP boundary,
server authorization, TanStack Query infrastructure and compatible application identifiers.
All data and AI calls go through the shared client; keep the repository import boundaries and i18n.
Add native audio only where required for the requested conversational interface, using Expo's SDK-selected
package and a rebuilt development client. Permission denial and unavailable speech services need usable states.

## Completion evidence

Check Login, overview, period selection, device details, alerts, chat streaming/history/feedback,
microphone permission/recording and speech error handling, profile changes, logout and relaunch.
Record actual results and limitations. Do not present a layout mockup as the running app.
