# Portfolio UI direction

The page introduces Dav as a game developer, shows actual work and contributions, and offers a small interactive world. Its audience should be able to browse the portfolio without understanding or playing the game.

## Design plan

Keep the planet as the memorable visual element and make the reading experience quiet. Separate the opening from the work with a full-width change of surface and a generous boundary, rather than another promotional card.

- Color: light paper `#faf9f5`, light reading surface `#f0f2ec`, forest ink `#30443a`, dark ground `#171e1b`, dark reading surface `#202822`, soft sage `#a3bd90`.
- Type: Space Grotesk for clear, rounded headings; DM Sans for prose and controls. Keep body text at 15–17px, comfortable line height, and short line lengths. Remove the isolated colored word in the headline so the live planet carries the visual emphasis.
- Layout: left-aligned introduction and live globe in separate grid columns on larger screens, so the text never intercepts planet gestures; readable introduction followed by a fully visible interactive globe on phones. The work, personal projects, About, and Contact share a separate reading surface below.

```text
Desktop                     Phone
Name       Navigation       Name   Navigation
Intro       Live planet     Intro
            Controls        Live planet
       Scroll cue           Controls / Scroll cue
======================      ======================
Games and contributions     Games and contributions
Personal projects           Personal projects
About / Contact             About / Contact
```

The existing forest palette and type families fit the user's approved calm direction. Retain those choices rather than adding an unrelated visual identity. Avoid redundant town invitations, decorative labels, entrance animations, and extra card chrome.

## Applied review

The installed frontend-design skill informed hierarchy, intentional restraint, typography, and visual critique. Vercel's web-design-guidelines informed the skip link, semantic navigation, focus visibility, touch alternatives, modal scroll containment, theme support, and a pause control for ongoing ambient motion. Review scope: `index.html`, `src/portfolio.css`, `src/portfolio.ts`, `src/theme.ts`, the hero interactions in `src/town/main.ts`, and `src/town/panel-rail.css`.

Preserve working project links, deep links, saved progress, mouse/keyboard/touch rotation, offscreen rendering pause, and reduced motion. Loading and failure messages live in the opening, next to the game entry, rather than depending on the removed section.

## Review results

- `index.html`: duplicate invitation removed; skip navigation and semantic content target added; game entry has a clear action label; ambient motion has an accessible pause button.
- `src/portfolio.css`: the opening and reading area have distinct surfaces; the phone globe is visible below the copy; small light-theme text was strengthened to exceed 4.5:1 contrast on both surfaces; focus, safe-area spacing, and touch targets are retained.
- `src/town/main.ts`: globe framing fits narrow containers; pause stops drawing while rotation/zoom remain available; viewport dimensions are cached outside the render loop.
- `src/town/panel-rail.css`: panel scrolling stays inside the dialog.

Verified at 1440px, 820px, 390px, and 320px widths in both themes, including keyboard skip navigation and sampled text contrast. Browser smoke checks cover themes, saved progress, deep links, game load failure, no-JavaScript reading, mouse/touch rotation, zoom, momentum, pause/resume, and game transitions. The TypeScript/game suite passes 204 tests.
