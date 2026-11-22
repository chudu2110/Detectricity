# Design system

Tokens, type, spacing, Android rules, component usage and accessibility for this app. Written 2026-10-25 against
Expo SDK 58.0.19, React Native 0.88.0, React 19.3.0, Uniwind 1.13.0, Tailwind CSS 4.3.3, `@gluestack-ui/core` 5.0.15,
`react-native-reanimated` 4.7.1. Related: [components.md](components.md) (composition and variants),
[architecture.md](architecture.md), [client-state.md](client-state.md) (the theme preference store),
[performance.md](performance.md). Detectricity uses warm off-white, pale matcha and forest text
(verified: `src/global.css`). The [old HTML demo](design-system/wattprint-design-system.html) records
the 2026-10-26 theme.

The local [Taste Skill 2.5.1](../../Agent-Rules/skills/taste-skill/SKILL.md) informs concise copy, consistent
spacing, hierarchy and press feedback. The [workspace brief](../../Agent-Rules/design-brief.md)
sets the matcha palette and adapts visual verification to React Native with Android screenshots.

Labels: **(verified: ...)** names the file, command or URL checked. **(opinion)** is our choice or advice, not proven.
This project styles with Uniwind classes and semantic tokens only; there is no second styling system and no
design-token TypeScript file (verified: `src/global.css` is the single source; `README.md` "Decisions").

## 1. Tokens

Source: `src/global.css`. Each token is a space separated RGB triple defined twice, in `:where(.light, .light *)` and
`:where(.dark, .dark *)` inside `@layer theme`, and mapped to a Tailwind colour by `@theme inline`
(`--color-primary: rgb(var(--primary))`), so `bg-primary`, `bg-primary-strong`, `text-primary-foreground`, `border-border`, `accent-primary`
and `bg-overlay/50` all exist (verified: `src/global.css`). `Uniwind.setTheme` switches the block
(verified: <https://docs.uniwind.dev/theming/basics.md>). Values below are copied from the file.

| Token | Light RGB | Dark RGB | Intended use |
| --- | --- | --- | --- |
| `primary` | 110 133 92 | 115 147 87 | Chart marks and Switch track |
| `primary-strong` | 70 96 59 | 184 205 162 | Primary actions and link text |
| `primary-foreground` | 255 255 255 | 25 37 22 | Text and icons on `primary-strong` |
| `card` | 255 255 255 | 31 40 31 | Opaque utility surface |
| `card-foreground` | 36 52 39 | 243 245 238 | Text on `card` (defined; no class uses it yet, `text-foreground` is equal) |
| `secondary` | 241 244 234 | 42 52 41 | Secondary Button fill, Input fill (`bg-secondary`) |
| `secondary-foreground` | 36 52 39 | 243 245 238 | Text on `secondary` |
| `background` | 248 249 244 | 22 29 24 | Warm off-white page in light mode |
| `popover` | 255 255 255 | 31 40 31 | Menus and popovers (defined; unused) |
| `popover-foreground` | 36 52 39 | 243 245 238 | Text on `popover` (defined; unused) |
| `muted` | 241 244 234 | 42 52 41 | Quiet fills: image placeholder, pressed row (`active:bg-muted`) |
| `muted-foreground` | 80 93 75 | 171 183 163 | Secondary text, input placeholder and icon (`text-muted-foreground`) |
| `destructive` | 200 40 30 | 255 122 112 | Destructive Button fill, error text (`text-destructive`), invalid input border |
| `destructive-foreground` | 255 255 255 | 250 250 250 | Text on a destructive Button |
| `overlay` | 0 0 0 | 0 0 0 | Modal backdrop (`bg-overlay/50`) |
| `foreground` | 36 52 39 | 243 245 238 | Primary text (`text-foreground`) |
| `border` | 225 232 218 | 61 73 54 | Surface outlines and dividers |
| `input` | 123 133 115 | 118 131 107 | Switch off track (`accent-input`), outline Button dark fill tint (`dark:bg-input/[0.045]`) |
| `ring` | 70 96 59 | 184 205 162 | Focused Input border (`data-[focus=true]:border-ring`) |
| `accent` | 241 244 234 | 42 52 41 | Pressed or hover fill of outline and ghost Buttons |
| `accent-foreground` | 36 52 39 | 243 245 238 | Text on a pressed outline Button |
| `switch-thumb` | 255 255 255 | 255 255 255 | Switch thumb (`accent-switch-thumb`) |
| `brand-soft` | 224 235 207 | 49 65 42 | Tonal action surface |
| `brand-ink` | 54 78 44 | 195 218 174 | Text and icons on matcha surfaces |
| `warning-soft` | 250 240 218 | 75 59 31 | Warning surface |
| `warning-ink` | 121 84 25 | 238 205 140 | Text and icons on warning surfaces |

The app uses shared Page gutters and Surface variants for glass fill, highlight, padding and radius.
`--glass-*` supplies the fill, matcha selection, quiet surface, rim, edge and tinted shadow.
`--ambient-*` supplies the page's base lighting, and the `--art-*` palette provides enamel,
mint, sky, clay and honey tones and ink for illustrations. SVG gradients and native shadows read
these semantic CSS variables through Uniwind and convert token triples with `toCssColor`
(verified: `src/global.css`, `src/components/glass-surface.tsx`, `src/components/illustrated-icon.tsx`).

Rules:

- Use only these token class names for colour: `bg-*`, `text-*`, `border-*`, `accent-*` (non-style colour props such as
  `ActivityIndicator`, see `README.md` "Uniwind native rules"). No hex, `rgb()`, `hsl()` or palette classes
  (`bg-red-500`). Enforced by `scripts/design-guard.test.ts` for hex colours in a colour position, colour functions (`rgb()`, `hsl()`, `color-mix()`, ...), literal values of `*Color` style props (`color: 'white'`) and `dark:` colour pairs;
  palette classes are not guarded (opinion: add if they appear).
- No `dark:` colour pairs outside `src/components/ui` (the tokens already switch). The guard allows `dark:` pairs anywhere
  under `src/components/ui/` (vendored upstream code); today `badge` and `button` have them (verified: `grep -rln 'dark:' src --include=*.tsx
  --include=*.ts --exclude-dir=ui` finds no file with a `dark:` class outside `ui`; inside `ui`, `badge` and `button`
  `index.tsx` match, 2026-10-26). One `rgb(` template is
  allow-listed in `src/lib/nav-theme.ts`: the exact literal `rgb(${parts.join(', ')})`, which turns a token triple into the CSS
  colour React Navigation needs.
- Never put `text-destructive-foreground` on a solid `bg-destructive` in dark: that pair is 2.77:1 (section 2). The Button
  avoids it with `dark:bg-destructive/60`.
- A custom control drawn with a border (checkbox, select) uses `border-input` (3:1); `border-border` is for dividers only
  (decorative). The `Input` is the exception: a filled `bg-secondary` field with a transparent resting border. See section 2.
- Green: use `bg-primary-strong` / `text-primary-strong` for a Button fill or any text; `bg-primary` is for shapes (its white
  text pair is 4.06:1 and fails the 4.5:1 text rule).
- To change a colour, edit the triple in both blocks in `src/global.css`, add or update the pair in `PAIRS` in
  `scripts/contrast-report.js`, and re-run `node scripts/contrast-report.js` (section 2); `scripts/contrast.test.ts` must pass.
  Do not add a token for one screen (opinion).
- The navigation theme reads `--background`, `--foreground`, `--primary`, `--card`, `--border` through `useCSSVariable`
  (verified: `src/hooks/use-nav-theme.ts`), so native navigation chrome follows the tokens.
- Matcha launch assets are configured in `app.json` (verified: `app.json`).

## 2. Contrast

Computed on 2026-11-21 with `node scripts/contrast-report.js` using `src/global.css`.
The script models WCAG relative luminance with thresholds of 4.5:1 for normal text and 3:1 for
large text and reported non-text controls. It composites alpha pairs over the named surface.
Every applicable pair in the report passed. Glass and ambient rows measure named token fills.
Native blur varies with the content behind the dock, so check label legibility on-device as well.

| pair (fg on bg) | kind | light | dark |
| muted-foreground on ambient-matcha | text | 4.91 pass | 4.54 pass |
| muted-foreground on ambient-shade | text | 5.77 pass | 8.02 pass |
| muted-foreground on ambient-skylight | text | 6.76 pass | 6.19 pass |
| muted-foreground on glass-fill | text | 6.63 pass | 6.66 pass |
| muted-foreground on glass-rim | text | 6.96 pass | 4.81 pass |
| muted-foreground on glass-quiet | text | 5.99 pass | 6.32 pass |
| muted-foreground on glass-matcha | text | 5.38 pass | 4.96 pass |
| brand-ink on glass-matcha | text | 7.09 pass | 6.90 pass |
| brand-ink on brand-soft | text | 7.43 pass | 7.27 pass |
| warning-ink on warning-soft | text | 5.99 pass | 7.07 pass |
| foreground on background | text | 12.44 pass | 15.62 pass |
| card-foreground on card | text | 13.16 pass | 13.83 pass |
| popover-foreground on popover | text | 13.16 pass | 13.83 pass |
| primary-foreground on primary-strong | text | 7.01 pass | 9.33 pass |
| primary-strong on background | text | 6.62 pass | 10.05 pass |
| primary-strong on card | text | 7.01 pass | 8.90 pass |
| secondary-foreground on secondary | text | 11.83 pass | 11.78 pass |
| accent-foreground on accent | text | 11.83 pass | 11.78 pass |
| destructive-foreground on destructive | text | 5.56 pass | n/a |
| muted-foreground on background | text | 6.60 pass | 8.20 pass |
| muted-foreground on muted | text | 6.27 pass | 6.19 pass |
| destructive on background | text | 5.25 pass | 6.76 pass |
| destructive-foreground on destructive/60@background | text | n/a | 5.12 pass |
| destructive-foreground on destructive/60@card | text | n/a | 4.84 pass |
| destructive-foreground on destructive/50@background | text | n/a | 6.30 pass |
| muted-foreground on input/30@background | text | n/a | 5.51 pass |
| foreground on input/30@background | text | n/a | 10.49 pass |
| foreground on input/4.5@background | text | n/a | 14.86 pass |
| foreground on input/7.5@background | text | n/a | 14.34 pass |
| primary on background | ui | 3.84 pass | 4.94 pass |
| primary on card | ui | 4.06 pass | 4.37 pass |
| primary-strong on primary/20@card | ui | 5.57 pass | 6.70 pass |
| switch-thumb on primary | ui | 4.06 pass | 3.48 pass |
| switch-thumb on card | ui | n/a | 15.20 pass |
| switch-thumb on input | ui | 3.86 pass | 4.02 pass |
| muted-foreground on card | text | 6.98 pass | 7.26 pass |
| input on background | ui | 3.65 pass | 4.28 pass |
| input on card | ui | 3.86 pass | 3.78 pass |
| ring on background | ui | 6.62 pass | 10.05 pass |
| ring on card | ui | 7.01 pass | 8.90 pass |
| ring on secondary | ui | 6.30 pass | 7.58 pass |
| destructive on secondary | ui | 4.99 pass | 5.10 pass |

Use a visible label and focus treatment on filled inputs. Use `border-input` for a custom control
that needs a resting boundary and the translucent fill from the destructive Button in dark mode
(verified: `src/components/ui/input/index.tsx`, `src/components/ui/button/index.tsx`).

## 3. Type

Uniwind resolves Tailwind's `text-*` sizes; Tailwind v4 defines `text-xs` 12px, `text-sm` 14px, `text-base` 16px,
`text-lg` 18px, `text-xl` 20px, `text-2xl` 24px, `text-3xl` 30px with line heights 16, 20, 24, 28, 28, 32, 36 px
(verified: <https://tailwindcss.com/docs/font-size>; React Native treats these as scalable units, see section 6).
Display headings, prominent readings and action labels use two bundled Bricolage Grotesque weights.
Both include Vietnamese glyphs. Body copy and editable fields use the platform face.
The shell loads the fonts locally before revealing the first route and can render with system
fonts on a load error. Page and section headings expose the header accessibility role.
Use tabular numerals for changing meter values (verified: `src/global.css`, `src/components/app-ui.tsx`,
`src/screens/home/index.tsx`).

## 4. Spacing, radius, size

Use Tailwind spacing and the shared Page gutters. Surface controls card radius and padding by size.
ActionButton, IconButton and SegmentedControl centralize touch sizing and control states
(verified: `src/components/app-ui.tsx`).

## 5. Android rules

- **Touch targets: 48dp minimum**
  (verified: <https://support.google.com/accessibility/android/answer/7101858>: "a width and height of at least 48dp").
  `Button` enforces it: `default` `min-h-12`, `sm` `min-h-12`, `lg` `min-h-14`, `icon` `min-h-12 min-w-12`; Tailwind `h-12` is
  48 dp (verified: `button/index.tsx`, `button.test.tsx`). The modal close button adds `min-h-12 min-w-12`
  (verified: `screens/settings/index.tsx`). A pressable row sets its own `min-h-12`; do not rely on content height (see Pressable). `Input` is `min-h-12` (48 dp; tested in `input.test.tsx`).
  **Known gap:** `InputSlot` has no minimum size (verified: `input/index.tsx`); no screen uses a slot yet.
- **Dark mode:** the preference is `system | light | dark` in `usePreferencesStore`; the root layout calls
  `Uniwind.setTheme(usePreferencesStore.getState().theme)` at module load, before the first render (comment in
  `src/app/_layout.tsx`), and `GluestackUIProvider` calls `Uniwind.setTheme(mode)` in `useLayoutEffect` (verified: both
  files). Choosing `light` or `dark` also sets React Native's color scheme so native `Alert`/`Modal` match; `system`
  follows the device (verified: <https://docs.uniwind.dev/theming/basics.md>). `app.json` has `userInterfaceStyle: automatic`.
  Whether the first release frame flashes the wrong theme is open (backlog, "T4").
- **Status bar:** `<StatusBar style="auto" />` from `expo-status-bar` in the root layout (verified: `src/app/_layout.tsx`).
- **Safe areas:** Page and Assistant account for the top inset and use the measured dock inset
  for bottom clearance. The tab shell provides a zero dock inset while the keyboard is visible
  (verified: `src/components/app-ui.tsx`, `src/screens/assistant/index.tsx`, `src/hooks/use-dock-inset.ts`).
- **Predictive back** is off (`predictiveBackGestureEnabled: false`, verified: `app.json`).
- **Keyboard:** lists and scroll views with inputs set `keyboardShouldPersistTaps="handled"`
  (verified: `screens/settings/index.tsx`).

## 6. Component usage

Detailed composition rules: [components.md](components.md). The components are vendored gluestack v5 under
`src/components/ui` (verified: `README.md`).

### Button

| Need                   | Use                                                                            |
| ---------------------- | ------------------------------------------------------------------------------ |
| Main action            | `<Button><ButtonText>...</ButtonText></Button>` (`variant="default"`)          |
| Selected toggle option | `variant={selected ? 'default' : 'outline'}` plus `accessibilityState={{ selected }}` (`src/components/app-ui.tsx`) |
| Dangerous action       | `variant="destructive"`                                                        |
| Secondary, quiet       | `secondary`, `outline`, `ghost`, `link`                                        |
| Compact in a toolbar   | `size="sm"` (still 48 dp tall); icon only: `size="icon"` with `accessibilityLabel` |
| Busy                   | add `<ButtonSpinner />` as a child; its colour follows the variant             |
| Layout in a row        | `className="flex-1"` only                                                      |

Disabled looks like `opacity-40` through `data-[disabled=true]`. Label text is always a `ButtonText` child (an i18n key).

### Input

`Input` (frame) + `InputField` (the `TextInput`) + optional `InputIcon`/`InputSlot`. The frame is a filled `bg-secondary`
`rounded-2xl` field with a transparent `border-2`; focus shows `border-ring`. Pass `isInvalid` for the error border
and render the error text below with `selectable` and `accessibilityLiveRegion="polite"` (verified: `screens/settings/sample-form.tsx`).
Always set `accessibilityLabel` or `aria-label` on `InputField` (verified: `screens/settings/sample-form.tsx`).
Placeholder, cursor and selection colours come from `*ClassName` bindings already inside `InputField`; do not pass
`placeholderTextColor`.

### Headers and tab bar

The authenticated shell uses Expo Router JavaScript Tabs with a custom AppTabBar and one nested
Stack per destination. The floating AppTabBar renders five illustrated icons and localized labels,
with tab roles, selected state and a matcha selection pill. The selection spring follows system
Reduce Motion. The dock hides while the keyboard is visible. It emits a preventable tab press before
navigating. Screens render their own headings and detail routes supply labelled back actions
(verified: `src/app/(app)/_layout.tsx`, `src/components/app-tab-bar.tsx`, `src/components/app-ui.tsx`).

Expo SDK 58 selects `expo-blur` 58.0.6 for the dock's native BlurView. Android uses
`dimezisBlurViewSdk31Plus` against the active screen's BlurTargetView on API 31 and up. iOS uses a
system chrome material tint and observes Reduce Transparency. Older Android versions and iOS with
Reduce Transparency use the dock's opaque-style gradient. The dock stays outside the tab scene
that it samples to prevent recursive blur (verified: `package.json`, `src/app/(app)/_layout.tsx`,
`src/components/app-tab-bar.tsx`).

### Glass surfaces and art

Use Surface for app cards and GlassSurface for specialized layers such as the Assistant composer
or dock. Fill gradients, a directional rim and soft tinted shadows give surfaces depth.
AmbientBackdrop provides the matcha lighting beneath Page, sign-in and Assistant. IllustratedIcon
draws 12 custom SVG icons using material gradients. Use it for navigation, appliances and
prominent product cues. Use AppIcon for compact utility controls and as the illustration fallback.
Home and sign-in share the decorative transparent PNG through HouseIllustration
(verified: `src/components/glass-surface.tsx`, `src/components/illustrated-icon.tsx`,
`src/components/house-illustration.tsx`, `assets/illustrations/eco-home-glass.png`).

### Modal

`Modal isOpen onClose` > `ModalBackdrop` + `ModalContent` > `ModalHeader` (title `Text` with `accessibilityRole="header"` and
a `ModalCloseButton` with `accessibilityLabel`, 48 dp) + `ModalBody` + `ModalFooter` (verified: `screens/settings/index.tsx`). Sizes
`xs` to `full`, default `md`. Use for short confirmations; a full-screen task is a route, not a modal (opinion).

### Icon

`<Icon as={CloseIcon} size="md" />`; sizes `2xs`, `xs`, `sm`, `md` (18 px), `lg`, `xl`; colour from `text-*` on the icon
(`text-foreground` default) (verified: `icon/index.tsx` and the README note that gluestack `Icon` takes colour from
`text-*`). Inside a Button use `ButtonIcon`. An icon-only control needs an `accessibilityLabel` on its pressable.
`Svg`/Lucide icons used directly need `withUniwind` and are not guarded.

### State components

| Situation                              | Component                    | Notes                                                           |
| -------------------------------------- | ---------------------------- | --------------------------------------------------------------- |
| First load, nothing cached             | `LoadingState`               | `progressbar` role, label from i18n                             |
| Loaded, zero rows                      | `EmptyState` (+ children)    | title, optional description, action as children                 |
| Failed, nothing cached                 | `ErrorState`                 | message from `errorMessage`, `selectable`, polite live region, retry |
| Query paused offline, nothing cached   | `OfflineState`               | variant of `EmptyState`                                         |
| Failed or paused refresh with cached data | banner text, not a state  | a text banner with `accessibilityLiveRegion="polite"` (verified: `src/components/app-ui.tsx`) |

Full screen by default; pass `className="flex-none p-2"` to embed (verified: `state-style.ts`). Data rules:
[data-fetching.md](data-fetching.md).

### Card, Heading, Text, Divider

The vendored utility `Card` is `bg-card rounded-3xl`; `size="default"` is `p-4 gap-3`, `size="sm"` is `p-3 gap-3`
(verified: `src/components/ui/card/styles.tsx`). The dashboard and list screens use `size="sm"`. `Heading` takes `size` and
carries `accessibilityRole="header"` at the call site; `Text` takes `size` (`2xs` to `3xl`) and class colour tokens
(`text-muted-foreground`). `Text` `isTruncated` maps to `line-clamp-1`; it is not used by our code and was not exercised on a
device (verified: `README.md` "gluestack-ui"; opinion: wrap long names instead, as `DeviceRow` does). `Divider` is `h-px bg-border`
and no screen uses it yet (verified: grep of `src` outside `components/ui`).

### Switch and switch rows

The whole row is the control: a `Pressable` with `accessibilityRole="switch"`, `accessibilityState={{ checked, disabled }}`,
`accessibilityLabel` and `min-h-12`, containing a `Switch` wrapped in a `View` with `pointerEvents="none"` and
`importantForAccessibility="no-hide-descendants"`, so TalkBack sees one node and the small native Switch is only an indicator
(verified: `src/features/devices/components/device-row.tsx`, `device-row.test.tsx`). Colour bindings are inside `Switch`:
`trackColorOnClassName="accent-primary"`, `trackColorOffClassName="accent-input"`, `thumbColorClassName="accent-switch-thumb"`
(verified: `src/components/ui/switch/index.tsx`); the contrast pairs are in section 2 (the dark thumb is white since 2026-10-26, so the old off-track limit is gone). An
offline device sets `disabled` on the row `Pressable`, which dims the row once (`opacity-40` through `data-[disabled=true]`) and
blocks the press; the inner `Switch` is not given `disabled`, so it does not dim a second time.

### Badge

`Badge variant="default | secondary | destructive | outline"` with a `BadgeText` child (`text-xs uppercase`)
(verified: `src/components/ui/badge/index.tsx`). `DeviceRow` uses `secondary` for online and `outline` for offline. A badge is
not a touch target.

### Progress

`<Progress value={n}><ProgressFilledTrack /></Progress>`: `h-2` track `bg-primary/20`, fill `bg-primary-strong`. `value` is a 0 to 100
percentage; compute it with a guarded selector so a zero total gives 0, not `NaN` (verified: `shareOf` in
`src/features/energy/energy-selectors.ts`, tested in `energy-selectors.test.ts`).

### Pressable

`Pressable` (the gluestack part) has only a disabled opacity in its base; a pressable row sets its own `min-h-12` (48 dp) at
the call site, as `DeviceRow` does (verified: `device-row.tsx`). Do not rely on content height for the target.

### Energy chart

Live chart bars use native views with numeric percentages, semantic fills and a summary accessibility
label. Keep labels as native text and missing buckets distinct in the chart (verified:
`src/screens/dashboard-parts.tsx`). The victory-native module remains with the old fixture views.

## 7. Motion

- The illustrated landscape has rotating turbine blades, drifting clouds and highlights on the
  foreground track. These are decorative. Home lets the user freeze the scene. The shared phase
  clock runs on the UI thread and stops for Reduce Motion, backgrounding and inactive scenes.
  The welcome orb on Assistant and its recording/request indicators use the same clock.
- Tabs glide in the direction of travel while the selected dock glyph lifts into place. The
  Energy chart grows its bars from the baseline on period entry. Tap the plot or use accessibility
  increment/decrement to inspect a time interval. Keep missing values distinct from recorded zero.
- Shared interactions respect system Reduce Motion. Keep the selected style and pressed tint
  visible with motion off. Use at least 48 logical pixels per interactive target.
- Reanimated animations default to `ReduceMotion.System`; with reduced motion on, `withTiming`/`withSpring` jump to the
  end value, and entering/keyframe/layout animations jump to their end state while exiting ones are skipped. For
  layout animations the page says to set it per animation (for example `BounceIn.reduceMotion(ReduceMotion.System)`).
  `useReducedMotion` returns the setting read at app launch and does not update during the session
  (verified: <https://docs.swmansion.com/react-native-reanimated/docs/guides/accessibility/>,
  <https://docs.swmansion.com/react-native-reanimated/docs/device/useReducedMotion/>).
- **Not verified:** whether the modal's `FadeIn.duration(200)` honours the system setting without an explicit
  `.reduceMotion(...)`. Test on the phone with "Remove animations" before claiming it (open doubt).
- Guidance (opinion): animate opacity and transform only; keep durations short (the modal uses 200 ms); never carry
  meaning by motion alone; check `expo-animation` skill before adding gestures or sheets.
- A dev-only showcase screen that renders every token, variant and state is **out of scope** here and a good future item
  (backlog).

## 8. Accessibility

- **Roles:** `accessibilityRole="header"` on titles, `button` on pressable rows, `progressbar` on the loading indicator
  (verified: states). `accessibilityRole` values `button`, `header`, `link` (external only; use `button` for
  in-app navigation), `tab`, `switch` are valid; `role` takes precedence if both are set
  (verified: <https://reactnative.dev/docs/accessibility>).
- **Labels:** if a touchable has no `accessibilityLabel`, TalkBack reads its child text; icon-only controls and images that
  are decoration need one or `accessible={false}` (give the row one full label and hide the thumbnail).
- **Live regions:** `accessibilityLiveRegion` `polite` for changing status and errors; `assertive` interrupts and is for
  urgent cases only (verified: <https://reactnative.dev/docs/accessibility>; used in `error-state.tsx`, `screens/settings/sample-form.tsx`).
- **State:** expose selection with `accessibilityState={{ selected }}`, disabled with `accessibilityState`/`isDisabled`.
- **Font scaling:** `allowFontScaling` defaults to `true` and follows the system text size; `maxFontSizeMultiplier` caps it
  (verified: <https://reactnative.dev/docs/text>). Nothing in `src` sets either, so text scales without limit. Do not
  fix text heights (`h-*`) on text containers; use `min-h-*` so large text does not clip (opinion). Test the largest
  system font size on the phone for a new screen (done for the four tabs at 2.0 on 2026-10-26).
- **Selectable text:** error text is `selectable` (project rule in `AGENTS.md`).

## Checklist

- [ ] Only token classes for colour; `scripts/design-guard.test.ts` passes (via `pnpm check`).
- [ ] New or changed token: both theme blocks edited, the pair added to `PAIRS`, `node scripts/contrast-report.js` re-run and
      `scripts/contrast.test.ts` green; table in section 2 updated.
- [ ] A custom bordered control uses `border-input`, never `border-border`; green text and Button fills use `primary-strong`.
- [ ] Every pressable is at least 48 dp tall and wide, including inputs and icon buttons (or the gap is recorded).
- [ ] A tab screen that hides the native header uses `CollapsingScrollView` (or `ScreenHeader` for a non-scrolling screen); tab bar colours come from tokens.
- [ ] Titles have `accessibilityRole="header"`; icon-only controls have a label; status text has a live region.
- [ ] Text uses a type role from section 3; no fixed heights on text containers.
- [ ] Looked at light and dark on the phone (see AGENTS.md "Device verification").
- [ ] Animations use opacity or transform, are short, and reduced motion was considered.
- [ ] A new variant or state updates the usage tables here in the same commit.

## Anti-patterns

- `bg-[#fff]`, `style={{ color: '#333' }}`, `bg-red-500`, `rgb(...)` in a class: use a token.
- `bg-white dark:bg-black`: the tokens already switch themes.
- `placeholder:`, `hover:`, `focus-visible:`, `group-*`: silently ignored on native (see `README.md`).
- `className="h-8 px-2 text-xs"` on a Button instead of `size`/`variant`.
- `bg-primary` under small or white text (3.60:1): use `bg-primary-strong`.
- Passing `placeholderTextColor` or `color` props instead of `*ClassName="accent-..."` bindings.
- Meaning carried only by colour (a red border without error text).
- `h-10` on a container of text (clips with a large system font).

## Sources

- Our code: `src/global.css`, `src/components/ui/**`, `src/components/states/**`, `src/hooks/use-nav-theme.ts`,
  `src/app/_layout.tsx`, `scripts/contrast-report.js`, `scripts/design-guard.test.ts`, `scripts/uniwind-guard.test.ts`.
- Uniwind theming: <https://docs.uniwind.dev/theming/basics.md>.
- Tailwind font size: <https://tailwindcss.com/docs/font-size>.
- Android touch target: <https://support.google.com/accessibility/android/answer/7101858>.
- WCAG contrast: <https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html>,
  <https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html>.
- React Native accessibility and Text: <https://reactnative.dev/docs/accessibility>, <https://reactnative.dev/docs/text>.
- Reanimated accessibility: <https://docs.swmansion.com/react-native-reanimated/docs/guides/accessibility/>,
  <https://docs.swmansion.com/react-native-reanimated/docs/device/useReducedMotion/>.
