# Design

## Principles

Carried over from the three prototypes:

1. **The main view leads.** A schematic, matrix or table gets the centre of
   the screen. The summary strip, rail, alerts and stream exist to find and
   explain what's on it.
2. **Colour means abnormal.** Following ISA-101 practice, amber and red appear
   only for warning and alarm. Normal is greyscale. One blue accent means
   selected or interactive.
3. **Never colour alone.** Status always has an icon shape and a word.
   Category is a shape and a letter, never a colour.
4. **Show the data, not a guess.** A silent entity shows NO DATA and raises a
   fault. It never carries its last value forward.
5. **Live but calm.** Values update in place, and new stream rows flash
   briefly. Live / Paused freezes the screen without losing data.
6. **Context stays visible.** Filters dim what's out of scope on schematics
   and matrices rather than removing it.
7. **Every number leads somewhere.** Tiles filter; markers, alerts, rows and
   cells open the drawer; the drawer links to related entities.

One difference from the release dashboard prototype: it gave each event type
its own colour. The toolkit keeps colour for severity only, and shows event
type as a word (the `kind` tag) instead.

## Tokens

CSS custom properties in `src/styles/toolkit.css`, prefixed `--dt-`.
- **Light** is the stylesheet's default.
- **Dark** applies with `data-theme="dark"`, or when the system prefers dark
  and no theme is forced.
- `useTheme` sets the attribute from `?theme=`, then the saved choice.
  `DashboardApp` falls back to dark, the control-room default; change it
  with `defaultTheme`.

| Group | Tokens |
|---|---|
| Surfaces | `--dt-bg`, `--dt-panel`, `--dt-panel-2`, `--dt-stage` |
| Rules | `--dt-rule`, `--dt-rule-2` |
| Text | `--dt-ink`, `--dt-ink-2`, `--dt-ink-3` |
| Accent | `--dt-accent`, `--dt-accent-soft`, `--dt-on-accent` |
| Warning | `--dt-warn` (#fab219), `--dt-warn-edge`, `--dt-warn-soft`, `--dt-warn-text` |
| Alarm | `--dt-alarm` (#d03b3b), `--dt-alarm-edge`, `--dt-alarm-soft`, `--dt-alarm-text` |
| OK text | `--dt-ok-text` (connection status only) |
| Markers | `--dt-mk-fill`, `--dt-mk-stroke`, `--dt-mk-letter` |
| Type | `--dt-mono` JetBrains Mono, `--dt-sans` Inter, `--dt-display` Space Grotesk |
| Layout | `--dt-rail-w` 248px, `--dt-side-w` 330px, `--dt-stream-h` 236px, `--dt-drawer-w` 440px |

The warning and alarm fills are the same in both themes. Their text and edge
variants change so labels keep their contrast.

**Theming.** Override tokens after importing the stylesheet:

```css
:root { --dt-accent: #3b33b5; --dt-sans: "IBM Plex Sans", sans-serif; }
:root[data-theme="dark"] { --dt-accent: #9a94ff; }
```

Keep `--dt-warn` and `--dt-alarm` distinct from your accent and from each
other.

## Encoding

**Category: shape and letter**

| Shape | Typical use in the prototypes |
|---|---|
| Circle | Safety |
| Diamond | Security |
| Square | Operations / production / services |
| Triangle | Integrity / workers |
| Hexagon | Environment |
| Inverted triangle | Weather |

An app picks the shape and letter for each category in its config.

**Status: colour, icon, word**

| Severity | Colour | Icon | On a marker |
|---|---|---|---|
| normal | none | circle | default fill |
| warning | amber | triangle | amber fill, value callout |
| alarm | red | diamond | red fill, value callout |
| offline / fault | none | crossed dashed box | dashed outline, NO DATA |
| unacknowledged | status colour | | pulsing ring |
| selected | accent | | ring |

## Layout and breakpoints

| Width | Layout |
|---|---|
| > 1440 px | Rail 248 · main · side 330; the summary strip puts category tiles and derived tiles side by side |
| 1101–1440 px | Rail 220 · side 300; the strip stacks |
| ≤ 1100 px | Single scrolling column: main, alerts, rail, stream. Strip tiles three across. The drawer covers the screen over a backdrop. `hide-md` elements hide |
| ≤ 640 px | Tiles two across; the top bar wraps; `hide-sm` elements (secondary stream columns) hide; overlay cards show only as chips |

The drawer sits over the main view, next to the alerts column, so alerts
stay visible while an entity is open.

## Accessibility

- **Buttons and controls**
  - Markers, matrix cells, table rows and stream rows are focusable. Enter
    opens the entity; markers also take Space.
  - Status filters are a radio group. Toggles expose `aria-pressed` or
    `aria-expanded`; the views list marks the active view.
- **Drawer**
  - `role="dialog"` with the entity's name as its label.
  - Focus moves to the close button; Esc closes.
- **Status icons** have text labels (`ALARM`, `WARNING`…).
- **Motion:** `prefers-reduced-motion` stops pulses, flashes, blinks and the
  drawer animation.

Still to do: an `aria-live` region for new alarms, keyboard access to
schematic areas (the rail's location list is the keyboard path), and
screen-reader testing.
