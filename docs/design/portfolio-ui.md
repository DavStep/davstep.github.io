# Portfolio UI direction

The page introduces Dav as a game developer, shows actual work and contributions, and offers a small interactive world. Its audience should be able to browse the portfolio without understanding or playing the game.

## Design plan

Use the supplied reference’s notebook style while keeping the planet as the main visual feature. The introduction and live globe occupy the opening; actual projects, About, and Contact share a separate reading surface below.

- Color: warm paper `#eee8da`, light reading surface `#f3eddf`, ink `#292720`, neutral charcoal `#202020`, dark reading surface `#252525`, dark ink `#efe9dc`. Pastel blue, green, lavender, peach, and yellow tabs distinguish project entries. Dark surfaces use equal RGB channels to avoid a green tint.
- Type: DM Sans for bold headings and readable prose, IBM Plex Mono for project tabs and compact controls, and Caveat for short handwritten notes. Keep paragraphs short and the surrounding controls quiet.
- Layout: centered introduction above the live planet, camera controls and one Play invitation below. Folder icons and connector lines group the project entries. Images and descriptions sit beside each other on desktop and stack on phones. About stays readable, and Contact is framed like a small notebook entry.

```text
Desktop                      Phone
Name       Navigation        Name / Navigation
       Introduction          Introduction
        Live planet          Live planet
          Controls           Controls
       Note / Play / Work     Note / Play / Work
=======================      ======================
Folder: selected work        Folder: selected work
  ├ Image / File tab + copy    ├ Image / File tab / copy
  └ Image / File tab + copy    └ Image / File tab / copy
Folder: after hours          Folder: after hours
About / Contact              About / Contact
```

The reference’s paper, bold headings, folder hierarchy, colored tabs, handwritten notes, and ink borders carry through to the game HUD and project panels. Light mode retains warm paper; dark mode uses neutral charcoal after the user’s correction. Preserve saved appearance preferences and all existing project URLs and game interactions.

## Applied review

The installed frontend-design skill informed the reference-based notebook direction, hierarchy, typography, and visual critique. Vercel's web-design-guidelines informed the skip link, semantic navigation, focus visibility, touch alternatives, modal scroll containment, theme support, and a pause control for ongoing ambient motion. Review scope: `index.html`, `src/portfolio.css`, `src/portfolio.ts`, `src/theme.ts`, the hero interactions in `src/town/main.ts`, and `src/town/panel-rail.css`.

Preserve working project links, deep links, saved progress, mouse/keyboard/touch rotation, offscreen rendering pause, and reduced motion. Loading and failure messages live in the opening, next to the game entry, rather than depending on the removed section.

## Review results

- `index.html`: duplicate invitation removed; skip navigation and semantic content target added; game entry has a clear action label; ambient motion has an accessible pause button.
- `src/portfolio.css`: the opening and reading area have distinct surfaces; the phone globe is visible below the copy; reading text has strong contrast against both palettes; focus, safe-area spacing, and touch targets are retained.
- `src/town/main.ts`: globe framing fits narrow containers; pause stops drawing while rotation/zoom remain available; viewport dimensions are cached outside the render loop.
- `src/town/panel-rail.css`: panel scrolling stays inside the dialog.

Verified at 1440px, 820px, 390px, and 320px widths in both themes, including keyboard skip navigation and sampled text contrast. Browser smoke checks cover themes, saved progress, deep links, game load failure, no-JavaScript reading, mouse/touch rotation, zoom, momentum, pause/resume, and game transitions. The TypeScript/game suite passes 204 tests.
