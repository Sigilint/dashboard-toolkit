# Roadmap

## Known gaps

- **No component tests.** The core, the relay, polling end to end, and the
  manual and factory sources are tested (22 tests). The React components
  were checked by driving the examples in headless Chrome.
- **Source-only package.** There's no prebuilt bundle or `.d.ts` output, so
  apps must compile it with Vite or a similar bundler.
- **No prototype has been migrated yet.** See
  [Extraction](EXTRACTION.md#moving-the-prototypes-onto-the-toolkit).
- **The relay keeps everything in memory** and has a single shared token.
  It's for demos and development.
- **Alert history.** Cleared alerts are dropped. There's no shelving or
  suppression.
- **Accessibility.** No `aria-live` announcements yet, no keyboard path
  through schematic areas, no screen-reader testing.
- **Browsers.** Checked in Chrome only; layouts not checked at phone width.
- **Drawer layout is the same for every entity.** `hide` is a fixed list
  and `extra` always sits after the trend. To put a device picture first,
  the well-pad example hides `about` and re-renders it inside `extra`.
- **`OverlayCard` has a fixed width** and no `className`, so wider cards
  (well-pad's tour and weather cards) are sized by overriding `.dt-card`
  in the app.
- **Below 1100 px the drawer is modal.** It covers overlay cards, so a
  guided tour on the map can't be stepped while the drawer is open.

## Next steps

**Small**
- `aria-live` region for new alarms.
- Keyboard navigation of schematic areas.
- A Svelte 5 adapter (`useDashboard` equivalent) for the release dashboard.
- Export `vite build` library output and type declarations.
- `OverlayCard` `width` / `className` props.
- `DetailDrawer` `hide` and section order as functions of the entity.

**Medium**
- Charts module (line, column, horizontal bar, legend, tooltip) for summary
  layouts, following the dataviz rules.
- Alert log with shelving and reasons (ISA-18.2).
- Server-side view storage in the relay (`GET/PUT /views`), matching
  `remoteViewStorage`.
- Replay: scrub back through `history` and render the main view as it was.
- Component tests with Vitest + Testing Library.
- First-class multi-channel devices: a device record that owns several
  channels, so marker, drawer and table can treat it as one thing (today
  this is a convention on `group` and `meta`; see
  [Components](COMPONENTS.md#detail-drawer)).

**Large**
- Migrate `well-site-monitor` and `offshore-platform-monitor` onto the
  toolkit.
- A production relay: durable storage, per-sender auth, signature
  verification (GitHub, Stripe-style HMAC), back-pressure.
- Multi-site: a fleet overview of many dashboards, drilling into each.

## Open questions

- Should derived rules be functions (flexible, client-only) or data
  (portable, server-evaluable)?
- Does the release dashboard keep its tenant-aware view hash, or adopt the
  toolkit's?
- Which wire format should real services standardise on: the toolkit's
  record shape, or CloudEvents everywhere with a mapper?
