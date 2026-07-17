# Theme System

## Goal

Allow each bundled Theme to change both styling and component structure without
forking the Agent Blog's functional behavior. Selecting a Theme changes
presentation only; the same content, routes, publication rules, SEO, RSS, and
privacy guarantees remain in effect.

## Ownership Boundary

The shared core owns:

- routes and page entry points;
- content collection queries, sorting, and filtering;
- URL construction and navigation targets;
- language selection and translated product copy;
- SEO metadata, canonical URLs, feeds, and structured data;
- configuration validation and publication behavior;
- conversion of content into typed, Publication-Safe presentation props.

A Theme owns:

- its stylesheet, fonts, icons, and decorative assets;
- visual tokens and layout rules;
- optional replacements for registered Theme Slots;
- the markup and composition inside those replacements.

A Theme must not import content collections or review-loading modules, read
private runtime configuration, construct application routes, or implement SEO,
RSS, and publication behavior.

## Directory Contract

```text
src/themes/
  shared/
    slots/
      Header.astro
      HomeHero.astro
      ReviewList.astro
      ReviewArticle.astro
      ArchiveList.astro
      Footer.astro
    contracts.ts
    base.css
  night-shift/
    theme.ts
    theme.css
    assets/
    slots/                 # optional replacements only
  signal-console/
    theme.ts
    theme.css
    assets/
    slots/
  quiet-minimal/
    theme.ts
    theme.css
    assets/
    slots/
  catalog.mjs
  registry.ts
```

`shared/slots` contains the complete default implementation. Each Theme folder
is self-contained and may replace any subset of those slots. There is no
Theme-to-Theme inheritance.

The initial slot list is deliberately page-sized rather than atom-sized. Small
elements such as dates, tags, links, and icons can remain local to a slot until
two implementations have a real need to share them.

## Theme Definition and Resolution

The catalog is the single source of stable Theme IDs and human-readable labels
used during AI-assisted setup. Each `theme.ts` exports one statically registered
presentation package with:

- its stylesheet and optional asset metadata;
- a partial map of Theme Slot replacements.

The registry is the single source of valid Theme IDs. Both site startup and the
configuration flow validate the selected ID against it. An unknown ID is a
configuration error instead of silently selecting another design.

For every registered slot, resolution is:

1. use the selected Theme's replacement when present;
2. otherwise use the corresponding shared slot.

Only the selected Theme's stylesheet is loaded. Shared global CSS is limited to
reset, accessibility behavior, and base contracts. Theme-specific selectors do
not accumulate in one global stylesheet; a Theme may use component-scoped CSS
or scope global rules beneath its `data-theme` value.

## Slot Contracts

Core pages prepare typed props and render the resolved slot. Representative
contracts include:

- `HeaderProps`: site identity, primary navigation labels, and stable URLs;
- `HomeHeroProps`: title, description, and optional summary facts;
- `ReviewListProps`: ordered review summaries and their stable article URLs;
- `ReviewArticleProps`: title, date, prepared article content, metadata labels,
  and navigation actions;
- `ArchiveListProps`: prepared archive groups and article URLs;
- `FooterProps`: required publication/privacy notice and optional source link.

Required fields represent capabilities that every Theme must preserve. Optional
fields may be omitted visually. A replacement may reorder required information
and change its markup substantially, but it must not remove required navigation,
article content, privacy disclosure, or actions defined by the slot contract.

Translated product copy is prepared by the core and passed as labels. Themes do
not introduce their own wording or language branches.

## Configuration

The selected Theme remains part of the blog configuration written during
AI-assisted setup. Setup presents the Theme IDs and labels from the same catalog
used by the runtime, then writes the chosen stable ID. A Theme change does not
rewrite content or page files.

For the first version, Themes are bundled at build time. Dynamic installation
and a public third-party Theme API are out of scope. If external Themes are
supported later, the slot contracts will need an explicit compatibility version.

## Verification Contract

Automated checks iterate over every registered Theme and render the key routes.
They verify shared behavior rather than identical markup:

- the home page links to reviews and the archive;
- an article renders its required content and navigation;
- language and required accessibility landmarks remain present;
- canonical metadata and RSS remain valid and Theme-independent;
- an incomplete Theme falls back to shared slots;
- an unknown Theme ID fails configuration validation.

Theme-specific snapshots or visual regression tests may supplement these checks,
but they do not replace the shared behavior contract.

## Migration Sequence

1. Extract typed slot props and shared default slots from the current pages and
   components without changing visible behavior.
2. Add the registry and slot resolver, then validate the configured Theme ID.
3. Move `night-shift` and `signal-console` styles into self-contained Theme
   folders; let them use shared slots initially.
4. Move the AstroPaper-derived `quiet-minimal` styles, assets, attribution, and
   structural replacements into its Theme folder.
5. Remove Theme conditionals from shared components and product copy.
6. Run the shared behavior checks against every Theme, followed by the existing
   Astro and unit test suites.
