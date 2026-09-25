# Regular-building development — 25 September 2026

Regular houses and the market, tavern, forge, guild and office families now have eight authored states, with both desktop and mobile geometry.

| State | Homes | Shops and civic offices |
|---|---|---|
| 1 | Footing and starter posts | Footing and posts |
| 2 | Full frame and low walls | Half walls |
| 3 | Enclosed cottage | Basic enclosed hall |
| 4 | Planters and working chimney | Family fittings, stalls or signage |
| 5 | Workshop/store room | Store room |
| 6 | Side wing | Side wing |
| 7 | Full upper floor, raised roof and chimney | Two-storey wing |
| 8 | Projecting attic gable | Roof lantern or an additional forge stack |

Upper house shells replace the earlier shell and roof; they do not overlap the old roof. The original ground floor, doorway, colors and footprint remain recognisable. The new upper windows, structural floor beams, attic frontage and chimney position are authored in Blender. The civic wing roof also seats directly on its gable, closing the previous gap.

Home levels 1–8 select all eight states. Regular shops open with the basic stage-3 hall and develop through stage 8 across levels 1–6. Later district milestones continue to add buildings. New regular district buildings begin at stage 3 and advance through 5, 7 and 8 as the district develops, instead of appearing fully grown. The special Archive, windmill, castle and project-landmark progression is preserved. Existing timed towns advance regular buildings to stage 8; no save migration is needed because geometry stages are derived from saved progress.

Blender sources: `build_cottages.py` and `build_civic.py`. Runtime stage selection is centralized in `src/town/building-development.ts`; scene transitions already rebuild when a plot's stage changes. Shared buffers, vertex colors, materials, building footprints and existing collision proxies are retained.

Neutral Blender review sheets are under `art/reviews/development/`: all eight home stages, all eight tavern stages, and the mature families at both detail levels. These are authored-model review renders, not live browser screenshots.

Validation: TypeScript and **99 tests pass**; the production build passes (with the existing large-chunk advisory). All **16** mature home/civic GLBs re-import with triangle counts matching runtime JSON. The source libraries contain zero degenerate triangles. Tests cover eight distinct home and civic states in both LODs, growing district buildings, preserved street footprints, shared-buffer lifetimes, and a mature-model ceiling of 7,000 desktop / 3,200 mobile triangles including optional cottage porches. The Archive and windmill runtime mesh data are unchanged.
