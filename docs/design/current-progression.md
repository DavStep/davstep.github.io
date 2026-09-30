# Living-world progression, version 3

Ten one-use choices introduce places. `action-rules.ts` defines their named functions and required supplies; `world-event-logic.ts` replays development and world events. There is no canonical ordering check and no automatic reward for both sides of a pair. Starting with the Archive does not change the rules.

Most buildings have arrival, operation, expansion, and completion forms at geometry stages 1, 3, 5, and 8. The Wizard has additional artifact forms at 6 and 7. Intermediate authored stages remain available to construction animation. Stages are presentations of completed functions; capabilities are the actual prerequisites. Missing workers, timber or machinery can be supplied later. A building placed tenth develops immediately using existing supplies.

The functional chain has bootstrap paths: Settlers staff Grove; Grove supplies Workshop timber; Workshop supplies Roads tools; Roads establishes the dwarf mine, stone and ore. River operation needs crew, timber and tools, and supplies cooling for advanced Workshop machinery. Archive surveys need workers and basic tools, so dwarf diversion works can be completed before eruption. Market needs wagon access and an open pass; imported glass and tools enable the Wizard’s telescope. The Wizard can calm creatures from arrival, before it has a telescope.

## Events

| Cause | Time | Persistent result |
| --- | --- | --- |
| Working harbor with seaworthy ship | First eligible choice | Crew retrieves island gold; empty island pedestal remains |
| Gold returns | Warning immediately, encounter after next choice | Wizard present: friendly dragon and retained hoard. Absent: stolen gold and burned orchard |
| World reaches choice 6 | After developments | Volcano smoke warning; eruption explicitly announced for choice 8 |
| World reaches choice 8 | After developments, before any due dragon | Prepared dwarf channels: safe lava and Ember Core. Otherwise: lava-blocked pass |
| Blocked pass + local heavy tools and surveys | A later choice than eruption | Bypass and core recovery; old lava scar remains |
| Burned orchard + Grove, irrigation and tools | A later choice than burning | Fruit production returns; charred history remains |
| Wagon access and open pass | First eligible choice | Caravan retrieves shrine Sky Lens; waits if lava interrupts first delivery |
| Wizard and available artifacts | Same choice as delivery or Wizard arrival | Lens, core and retained gold install in sockets; complete working telescope/calendar plus set powers beacon |

If the expedition occurs on choice ten, its dragon encounter resolves in the closing sequence with the tenth building already present. An approaching dragon can be calmed by a Wizard placed during the preparation choice. A departed dragon cannot be tamed retroactively. Gold cannot be installed before taming, so the item cannot be hidden from the encounter by early installation.

Development forms remain constructed after a disaster; current functions such as fruit supply or mountain trade stop while the relevant terrain is damaged. No event deletes a selected card or blocks the remaining choices. Pass recovery depends on local resources, not the caravan it needs to release.

## Example complete routes

Both of these achieve 80/80 and the Dragon’s Beacon ending; they are examples, not special-cased solutions:

- Settlers → Grove → Workshop → Roads → Archive → Rivers → Wizard → Market → Windmill → Walls.
- Settlers → Grove → Workshop → Roads → Walls → Market → Windmill → Archive → Rivers → Wizard.

Many other orders succeed. The special ending requires a complete run with a lit beacon, tamed dragon and contained eruption. The final journal also describes damaged/repaired worlds and pending development requirements.

## Playback and saves

Every choice resolves atomically and saves before cinematic playback. The timeline interleaves building developments and events; adjacent stages at one site merge, but artifact delivery never moves behind the upgrade it enables. The renderer reads each event’s before/after snapshots and samples an absolute progress value. It cannot mutate gameplay state.

Version 3 uses `davstep.choice-planet.v3`; development `?playtest=1` uses a separate suffix. Previous save keys remain untouched. Restart resets world history and decisions while preserving this ruleset’s best scores/discoveries. Reload reconstructs the final world without replaying event cinematics.
