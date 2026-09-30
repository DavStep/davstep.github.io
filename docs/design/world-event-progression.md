# World events and meaningful progression

Status: implementation specification, 29 September 2026. Implemented through named capability rules and deterministic world events. See current-progression.md for the shipped-in-source rule contract and world-event-visual-progress.md for visual verification. No public deployment is implied.

## Contract

Keep ten one-use choices. A choice introduces a place; supplies and events can develop it later. Each place produces specific capabilities. Developments require those capabilities, not a position in a hidden solution sequence.

Events change persistent world state: creatures, terrain, transport access, artifacts, and building functions. Every event has a visible cause, warning, cinematic, and aftermath. They advance through committed choices, never through elapsed real time. No reaction depends on whether the player watched or skipped its animation.

The island chest, volcanic mountain, ruined roadside shrine, and mountain crystal seam exist before their discovery. Opening camera shots can establish them without explaining the solution. Do not spawn a reward destination only when its collection condition succeeds.

## Treasure expedition and dragon

1. A working harbor, seaworthy ship, and crew enable the first island expedition. A fishing boat alone cannot do it. These capabilities must be attainable without the Wizard.
2. Follow the ship from its harbor across the ocean to the existing island. Crew disembark, carry the chest aboard, and return. The island pedestal becomes empty and stays empty.
3. The chest opens on the harbor apron. Gold flashes; a distant dragon silhouette turns toward town. This arms the dragon encounter for after the next committed choice. The player gets one visible preparation opportunity.
4. After that next choice establishes its building and resolves ordinary deliveries, the dragon arrives. Read the Wizard's presence at this moment, not at expedition launch. A newly placed Wizard counts: its initial capability is creature calming.
5. With the Wizard: the dragon swoops toward the chest, meets a calming spell, carries the hoard to the tower, and curls around it. Dragon, gold, occasional smoke, and sleeping animation remain. The town retains access to the gold through the friendly dragon.
6. Without the Wizard: the dragon steals the chest and scorches a specific orchard beside the harbor. Trees become blackened stumps, and that orchard stops supplying fruit. The dragon departs with the gold. Other food sources and choices still work.

Late irrigation and gardeners can restore production in the orchard, leaving a visible charred trunk. They cannot retroactively tame the departed dragon or recover the stolen gold. This distinguishes recoverable damage from a missed encounter.

The dragon burns the designated ground even if no orchard has grown there yet. That ground must be restored before its orchard can develop. It never selects a random building or deletes the player's choice.

If the expedition first happens on choice ten, its warning and encounter resolve in the closing sequence after the final building is present; no eleventh click is required. Earlier warnings always resolve after exactly the following choice, even if another animation was skipped.

## Mountain preparation and eruption

The mountain is visibly volcanic from the opening: crater, faint smoke, exposed fissures. It is not made volcanic by choosing the Dwarves.

The Dwarves establish a mine, tools allow excavation, and surveyed outflow paths allow reinforced diversion channels and a collection basin. Merely having a mine entrance does not protect the town. Show dwarves physically shaping the mountain, uncovering a glowing seam, and building the channels.

Proposed pacing: stronger smoke and tremors after choice six, eruption after choice eight. Two remaining choices after the eruption permit recovery or a finale. This is an explicit chapter event, previewed by world cues and a compact next-event indicator; exact pacing needs playtesting.

Prepared outcome:

- Camera follows lava from crater through the authored dwarf channels into a safe basin.
- Transport remains open; glowing channels and cooled black rock persist.
- The exposed seam yields an Ember Core, collected by a dwarf cart after the surge subsides.
- A geothermal furnace makes the prepared mine more useful, rather than merely avoiding a penalty.

Unprepared outcome:

- Lava takes one authored downhill route across the mountain wagon pass.
- The pass closes, visibly halting mountain freight and any caravan reward still waiting behind it. Footpaths and ocean access survive.
- The crystal remains visible behind the lava; no core is delivered during the eruption.
- Later mining equipment can excavate a bypass after the flow cools and recover the core. The black lava field and ruined original road remain as history.

Recovery must use locally obtainable tools; never require the mountain delivery blocked by this same lava. Do not implement simulated destructive lava across arbitrary terrain. Author and validate the safe and damaging paths, their affected route, and their persistent geometry.

Mining alone does not scientifically prevent an eruption. In this fantasy world the dwarf engineering visibly controls the small authored lava flow; the eruption occurs in both branches.

## Roads and the missing artifact

An old shrine with a glass lens is visible beyond an unfinished wagon crossing. Connecting the route with a wagon-capable bridge permits a restoration caravan to reach it.

Follow the first caravan across the completed bridge, show its crew lifting the Sky Lens from the shrine, then follow its return. A visibly empty mount remains. Arrival deposits the lens on a town display stand.

Use the mountain pass as one required segment of this route: if lava blocks it before collection, the caravan waits at a safe turnout and delivers only after the bypass exists. A lens already delivered is not removed by the eruption. This gives Roads a useful discovery and makes lava affect a real mechanic.

No Market requirement is necessary for this first expedition: the settlement supplies its crew. Ordinary trade can use the established route afterward.

## Three items and the late building

Suggested artifact set:

| Artifact | Where it already exists | Acquisition | Functional role |
| --- | --- | --- | --- |
| Sky Lens | Roadside shrine | Wagon expedition | Focuses the tower beam |
| Hoard Gold | Island chest | Ship expedition; retained if dragon tamed | Conductive rune rings and dragon nest |
| Ember Core | Volcanic crystal seam | Prepared eruption harvest or later mine recovery | Powers the tower mechanism |

The Wizard tower is the clearest first destination for this set: the core supplies energy, gold forms the rune circuit, and the lens focuses it. Three empty sockets on its model communicate missing parts. An incomplete set grants visible component installations; a complete set activates the summit beacon. Keep a substantial gold pile for the dragon even after a small share is used in the rune rings.

An early Wizard can tame the dragon and install artifacts as they arrive. A Wizard chosen last can immediately install previously collected artifacts; if the dragon is still approaching, it can also tame it in that final sequence. If the dragon already left with the gold, placing the Wizard later does not undo that history.

Do not make the three items magically upgrade whichever building happens to be tenth. Their function belongs to a specific recipe. Every other possible final building must likewise evaluate all existing supplies immediately on arrival: a late mill receives existing timber, gears, irrigation, and grain; a late market receives existing roads and surplus. Nothing needs a later click merely to check prerequisites.

If we later add artifact finales for other buildings, each needs its own functional recipe and authored result, rather than a universal “last building +3” award.

## Resolution and cinematic rules

For each committed choice:

1. Capture events already due from earlier choices.
2. Establish the selected place and resolve currently available supplies to a stable state.
3. Resolve due encounters and chapter events; apply creature, item, damage, and route outcomes.
4. Resolve the deliveries and building developments those outcomes enable.
5. Arm newly triggered encounters for the following choice. On the final choice, drain those pending encounters through a finite closing sequence.
6. Save the complete deterministic result and ordered cinematic beats before playback.

When eruption and dragon are due together, show the eruption first, then the dragon. Neither event can fire twice. They affect separate designated sites. New artifact deliveries can upgrade an existing or just-placed tower in the same turn without repeating construction.

Store artifact custody explicitly: island, ship, town, friendly dragon, departed dragon, or installed. Never treat “once collected” as “currently available.” Treat installation as an irreversible local transformation of the item, preserving the relevant completed recipe fact.

Cinematic beats follow cause and effect: establish source, travel, interaction, delivery, transformation, then a wide view of the consequence. Reuse current automatic camera, pause, skip, restart, and reduced-motion behavior. Give each major scene a modest duration; avoid one full camera orbit for every component.

## Existing implementation and needed changes

Current mappings: Wizard is `observatory`; the dwarf landmark and working mine follow `roads`; ocean ships belong to `river`; Sandship is the separate `workshop` landmark. The treasure expedition uses the ocean ship.

The current dwarf/roads coupling must become explicit: Roads can establish access to the dwarf camp, but mining and lava engineering need their own capability states and visible developments. Merely raising a road number must not silently prepare the volcano. The card and its preview must communicate that it introduces the road builders and dwarf camp if the ten-card roster is retained.

The replacement evaluator uses named capability requirements, once-only events, artifact custody, terrain/route state, and immediate development resolution. Scalar levels select authored geometry but are not the source of truth for whether a ship is seaworthy, the volcano is prepared, or gold is available.

New authored assets include chest and carry animation, dragon and calming interaction, orchard damage/restoration, volcanic crater, two lava routes, dwarf diversion works, artifact shrine and caravan collection, and tower sockets/beacon. Existing ships, dwarf carts, crews, and camera systems are reusable starting points, not proof these event scenes are already supported.

## Acceptance scenarios

- Early expedition without Wizard: stolen gold, scorched orchard, no friendly dragon.
- Wizard placed on the warning's next choice: tame outcome, dragon and accessible hoard at tower.
- Wizard after theft: functioning tower with missing gold, no retroactive tame outcome.
- Prepared eruption: open pass, core delivery, safe persistent lava works.
- Unprepared eruption: blocked mountain caravan, intact sea route; locally supplied recovery opens bypass and delivers waiting items.
- Lens collected before eruption remains owned afterward.
- Final Wizard with lens/core and a pending dragon: immediate component installation, tame encounter, gold installation, beacon ending.
- Final ordinary building develops from all earlier supplies without needing an eleventh choice.
- Expedition on the final turn and simultaneous due events terminate correctly.
- Skip, reload, restart, reduced motion, and normal playback agree on items, scars, access, creatures, and building state.

Validate these against the replacement dependency graph before assigning numeric stages or claiming any complete route works. The runtime capability rules replace all 28 former pair collaborations; tests cover named scenarios and randomized complete orders.
