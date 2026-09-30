# Shared implementation contract

Originating chat owns game.ts, action-rules.ts, world-event-types.ts, world-event-logic.ts, main.ts, action-story.ts, rule tests, saves and HUD. Visual chat owns new models/cinematics/tests/assets. Prefer a standalone renderer instantiated from main.ts with town.scene; planet-scene.ts is the projection adapter, not the scene owner. Coordinate edits to scene.ts or planet-landscape.ts if needed.

`src/town/world-event-types.ts` is the shared authority, now present. Please import its types; do not copy them. WorldEvent holds kind, title, description, optional artifact, before and after WorldEventState. WorldEventState has artifact custody, installed sockets, dragon, volcano, mountainPass, orchard, minePrepared and caravan states. `capabilities` contains named supply/function facts; levels remain the geometry presentation range 0–8.

Please export `PlanetWorldEvents` from `src/town/planet-world-events.ts`:

```ts
constructor(parent: THREE.Scene, mobile: boolean)
setState(world: WorldEventState, levels: Levels): void // immediate deterministic projection, including opening objects
begin(event: WorldEvent, levels: Levels): void
sample(progress: number): { x: number; z: number; height: number } | null // 0..1; advance full scene choreography; return camera focus in source town coordinates
finish(): void // clear transient state; apply event.after, idempotent
cancel(): void // clear cinematic only; caller then setState(authoritative world, levels)
update(dt: number, reducedMotion: boolean): void // ambient persistent motion, dt zero when paused
dispose(): void
```

Export `worldEventDuration(kind: WorldEventKind): number` (milliseconds) for cinematic pacing. Sampling must work at arbitrary normalized times without incrementally firing gameplay actions. Native sphere meshes must be marked `userData.planetNative = true` as appropriate for projection exclusion. Source-town camera points must agree with actual native sphere placement.

Parent integrates begin/sample/finalization into main.ts requestAnimationFrame and handles camera, hidden-tab/panel pause, skip/restart and reduced motion. No localStorage, rule evaluation, DOM, or asynchronous gameplay triggers in visual renderer. If camera needs extra fields, send proposal first.

GameState will have `world`, `worldEvents` (this choice), `history` (all world events), and `timeline` (development and world events in actual causal order). Ordinary development is grouped between world events, so the tower does not complete before artifact delivery. On restore, setState final world without begin.

Current model/transport edits predate this task and must be preserved. Need real persistent route blocking and orchard state in base landscape too; coordinate minimal hooks rather than parallel rewrites. Visual team should implement hooks in its modules and tell parent integration needs.

The visual chat can use GPT-6 Astra Medium subagents and Blender MCP as explicitly authorized by the user. It owns serializing Blender changes across its team.
