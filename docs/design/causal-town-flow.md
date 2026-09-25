# Ten-button order puzzle

The interaction contract is: **click an unused idea → watch the collaboration → click another**.

All ten ideas are available from the start. One click commits the choice immediately; each idea can be used once per run. Used buttons remain visible and show their current level. Earlier buildings can grow again when a later partner arrives. A completed collaboration names the joint project and shows its payoff. A reversed pair shows the missed project's name and the order to try on the next run. The chosen pair loses only that project's stages; it has no global level cap.

The first choice establishes either the valley route or the Archive-first Storybook Night route. Each has an 80/80 solution. The dock shows completed collaborations and total levels. At the end, the result lists all missed collaborations and offers a replay. The detailed rule graph and both routes are in [current-progression.md](current-progression.md).

The simulation emits one arrival followed by causal project waves. Source partners exist before their effects, and both participants advance in the same wave. The camera follows those reactions while the decision dock stays visible. The town has no exploration controls; portfolio entries remain in the Work menu. Ambient LivingWorld actors are not part of the puzzle scene.

A choice saves before playback. Skip applies its final state immediately. Restart invalidates the active animation token and clears crews and effects. Reload reconstructs the town from the saved order. Reduced motion and WebGL fallback retain event captions. Hidden tabs and open portfolio panels pause playback. `?playtest=1` in development isolates manual QA from the normal save.
