# River excavation

River is the ninth displayed card, adding a tenth choice without removing an existing option. The northern river is the natural water source; the player builds the channel toward the mill and extends it around the castle.

- Level 1: stakes survey the channel. Missing workers or tools leave it waiting.
- Level 2: Settlers 1 and Workshop 2 supply the crew. Shovel strokes and flying soil accompany a progressive terrain cut for 4.4 seconds. Water then advances downstream for 2.8 seconds with foam at its leading edge and the existing animated ripple shader.
- MAX: Roads 2 and Market 2 extend the channel from the northern inlet around the castle. The same excavation-then-flow sequence follows the inlet and the circular route. Road levels control bridges and gatehouses.

A sealed wall blocks River upgrades. Water-dependent windmill, crops, orchard, wildlife and port progression now read River instead of inferring water from Windmill. Every eligible option still levels up automatically after each choice.

Dedicated crews reuse the authored resident shapes with articulated shovel arms. Their work ranges keep them off the source water and away from the cistern. Terrain vertex route coordinates are cached; cutting updates only the affected terrain vertices in 64 steps. Crew/soil/foam cease when construction completes. Skip, reduced motion and save loading settle immediately; restart restores dry terrain and clears crews. GPU resources owned by the sequence are released independently of shared town materials.

Validation: progression, old saves, upstream excavation, distinct dig/fill phases, reduced motion, restart and resource tests; production build; browser card selection and completed 10/10 state. Blender review frames export actual geometry and draw ranges using `--river-seconds=2.2` / `5.8`. Their neutral lighting does not reproduce the browser's animated water shader.
