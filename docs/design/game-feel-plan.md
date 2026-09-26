# Game-feel overhaul plan

Goal: every click on an idea card should feel like it *caused* something. You should see a cause, some anticipation, an impact and a reward. Grow Valley (EYEZMAZE) is the benchmark. Its puzzle is simple; the fun comes from watching little workers make each choice happen, and seeing systems visibly level up because of the order you picked.

## What is wrong today (audit, Sep 2026)

| Area | Current behaviour | Why it feels bad |
|---|---|---|
| Building construction | `scene.ts` shows new buildings with a horizontal clipping plane that sweeps upward over 1.65 s, while the old building is clipped downward at the same time. | Looks like a 3D printer or a loading glitch. There is no weight, anticipation, impact or overshoot, and upgrades cross-fade instead of transforming. |
| Workers | `choice-worker.ts` shows **one** figure that appears from nowhere, slides in a straight line for 0.85 s, waves its arms without a tool, then slides away for 1.05 s and vanishes. | They don't read as characters doing work. There is no crew, nothing carried, no reaction to the result, and they pop in and out. |
| Reaction cues | `reaction-effects.ts` draws dashed lines at 24 % opacity and two thin rings at 35 % opacity for 1.8 s ("restrained"). | Collaborations are the core of the puzzle but are almost invisible. A combo should be the loudest moment in the game. |
| Particles | `construction-effects.ts` uses 10 tiny chips and 16 dust puffs that drift less than 0.6 m. | Hard to see at the default camera distance of 105–145 m. |
| Audio | None. | Half of "juice" is missing. |
| Camera | Lerps to 105–145 m away for every beat, with no impact response. | New buildings are a few pixels tall, and an impact looks the same as idle time. |
| UI feedback | The card greys out; the level text changes quietly. | No link between the 3D payoff and the card that caused it. |
| Level 1 visuals | Settlers L1 shows flat foundation slabs and grey rubble. | The first click, which is the most important moment, gives the least interesting result. |
| Scene tone | Saturated lime ground and heavy fog cover the whole hill. | Buildings don't stand out; everything reads as one green mass. |

## Principles

1. **Cause → anticipation → impact → reward → settle.** Every beat follows this sequence.
2. **Characters make things happen.** Buildings never appear by themselves: a crew brings materials, hammers, and cheers.
3. **Collaborations are loud; solo growth is medium; a missed combo is a sad trombone.** The player should *feel* the order puzzle.
4. **Squash and stretch everything that appears.** Nothing pops in at scale 1, and nothing disappears in one frame.
5. **The camera sells the impact.** Punch in for the hero shot, add a small shake on landing, and pull back to show the result.
6. **Keep it skippable and respect `prefers-reduced-motion`.** The existing guarantees (deterministic save, skip, restart) stay.

## Plan (priority order)

### P0 — Core feel (implemented in this pass)

Files: `build-sequencer.ts` (new), `juice.ts` (new), `sfx.ts` (new), `juice.css` (new), `choice-worker.ts` (rewritten), `reaction-effects.ts`, `scene.ts`, `main.ts`, `cottages.ts`. Tests: `tests/game-feel.test.ts`, `tests/choice-worker.test.ts`.

1. **Construction sequencer** (replaces the clip-plane wipe for buildings)
   - Each changed building gets its own staggered timeline, so a wave builds up in a ripple instead of all at once.
   - *Upgrade:* the old building squashes down (anticipation) and disappears in a dust puff, then the new one springs up.
   - *New building:* homes **drop in** from above, stretching as they fall and squashing on landing. Civic and landmark buildings **push up** out of the ground with a shake, overshoot and settle with an elastic ease.
   - The impact triggers a ground dust ring, ballistic debris that bounces, idea-coloured sparkles, camera shake and an SFX.
2. **Worker crews** (replace the single sliding worker)
   - Crew size grows with the level (2–4). Each worker hops in with a squash-and-stretch pop, **carries a plank or stone** on their head, and walks with a bouncy gait.
   - At the site they **hammer with a visible tool**, with timed hit sparks and a "tok" SFX. When the building lands they **cheer** (jump, arms up), then walk off and poof out with a dust puff.
3. **Collaboration payoff**
   - Glowing "supply orbs" travel along an arc from each source site to the destination (the partner sends something). Their arrival triggers the build.
   - The level-up burst gets a thick shockwave ring on the ground, a light pillar and rising stars, in the clicked idea's colour. It is much brighter than before but short.
4. **Synthesized audio** (WebAudio, no asset files)
   - Card click, worker pop, hammer taps, whoosh, landing thud, level-up chime (the arpeggio pitch rises with the level), collaboration chord, missed-collaboration down-slide.
   - A mute toggle in the HUD, persisted.
5. **UI ↔ world link**
   - Floating world-anchored "+1 ▲ Lv N" labels over the site.
   - The card badge bumps when its level rises, and the pressed card squashes.
   - A collaboration banner slides in with both idea colours.
6. **Camera**
   - Frame the action closer (≈ 60–80 m for single sites instead of 105–145 m).
   - Impact shake with a decaying amplitude, and a small FOV kick on collaborations.
7. **Timing**
   - Each wave follows anticipation (crew arrives and hammers, about 0.9 s) → reveal (drop-in or push-up) → celebrate (about 1.2 s).
   - Collaborations add the supply-orb travel before the reveal.

### P1 — Readability and reward (next)

8. **Level 1 of every idea should be a real, fun object, not foundation slabs.** The existing Settlers construction stages stay as authored. Other ideas could use more detailed first stages later; for example, Windmill L1 could be a small post mill whose sails already turn, and Market L1 could be a colourful stall with an awning.
9. **Stage silhouettes must differ clearly at game camera distance.** Each level adds one **big** readable feature: a roof colour, a tower, a flag, a chimney with smoke.
10. **Ambient life after a building is complete:** chimney smoke, turning sails, stall awnings flapping, a few residents at the doors. This should be event-driven (only near sites that levelled up), so the rule of no residents roaming between clicks can stay.
11. **Ending cinematics:** a MAX-all fireworks sequence and an orbit fly-through, plus a Storybook Night variant with lanterns lighting up one by one.
12. **A reveal for missed collaborations:** the partner's worker walks over, shrugs, and a grey "✕" puff appears. This teaches the puzzle without text.
13. **Scene grading:** desaturate the lime grass about 20 %, add warm key light and cool shadows, reduce the fog, and add a soft vignette so buildings pop against the ground.

### P2 — 3D model pass (Blender)

The Blender MCP is configured in Codex (`uvx mcp-for-blender` → Blender on `localhost:9876`), so a Claude cloud session can't reach it. The build scripts work the same way in headless Blender (`pip install bpy==4.2.0`, then `python -c "import bpy, runpy; runpy.run_path('art/blender/<script>.py')"`), and that's how this pass was authored.

**Done (Sep 26):**
- **Chibi worker** (`build_residents.py`): big head with eyes, cheeks, hair and ears, a tinted tunic and sleeves, and untinted skin, belt, trousers and boots (as vertex colours in `residents.json` under `detail`). Pivots are unchanged; the crew adds a wide-brim hat in the idea colour. Review: `art/reviews/residents/chibi-worker.png`.
- **Civic identity kits** (`build_civic_identity.py` → `generated/civic-identity.json`). Each family gains one readable feature per stage, inside the tested footprint:
  - market: striped awning and flag, then bunting, signboard and more;
  - tavern: hanging mug sign and chimney, then barrels and lanterns;
  - forge: tall stone stack with glowing embers, then a giant cog, iron smokestack, anvil and glowing windows;
  - guild: belfry with a bell and spire, then a shield, flags, clock and taller spire;
  - offices: domed cupola, then a letterbox and a clock;
  - mill: grain sacks and a hay bale.

  Preview every family and stage at `/art/reviews/models/gallery.html?row=civic` (or `?row=projects`, `&close=<row>`).
- **Homes (settlers) are unchanged by request:** only their animation was changed, not the model.

Remaining:

14. **Chunkier toy proportions:** roofs about 1.3× taller with deeper overhangs, thicker walls and trims, bigger doors and windows. Grow-style buildings read as toys, not scale models.
15. **Consistent palette:** 3 roof colours × 2 wall tones, with gradient-mapped vertex colours instead of flat greys.
16. **Hero landmark per idea** at levels 3 and 8, with a unique silhouette (mill with big sails, archive dome, star tower with a telescope, forge with a glowing furnace).
17. ~~**Worker model**~~: done (see above). Next: a distinct hat or prop per idea (hard hat, gardener's hat, blacksmith apron…).
18. **Scaffolding and construction kit:** poles, planks, ladder and crane, to show under construction for about 0.6 s before the reveal.
19. **Props that sell each idea:** hay bales, crates, barrels, market carts, a boat on the river, sheep in the fields.
20. **LOD and budget:** keep the current mobile LOD path; check the triangle budget with `scripts/audit-town-assets.mjs`.

## Success criteria

- Every card click produces at least 3 distinct feedback channels (motion, particles, sound, UI) within 150 ms.
- No object appears or disappears in a single frame: everything scales, drops, or poofs.
- A collaboration is clearly louder than a solo level, and a missed collaboration is clearly sadder.
- 60 fps on desktop and 30 fps on mobile are kept; all effects are pooled or disposed per wave.
- `npm run check` passes; reduced motion falls back to instant, silent changes.
