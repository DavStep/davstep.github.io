export type ProjectKey = 'outpost' | 'sandship' | 'battle' | 'wizard' | 'shmixel' | 'dwarves';
export interface ProjectInfo {
  key: ProjectKey;
  title: string;
  kicker: string;
  description: string;
  contribution: string;
  image: string;
  url?: string;
  landmark: string;
}
export const PROJECTS: ProjectInfo[] = [
  { key: 'outpost', title: 'Idle Outpost', kicker: 'ROCKBITE GAMES · CURRENT', description: 'A business at the end of the world. Trade with survivors, recruit heroes, and build something worth defending.', contribution: 'Systems, economy, progression · involved since the first prototype', image: '/assets/games/idle-outpost.webp', url: 'https://rockbitegames.com/games/idleoutpost', landmark: 'The Trading Hall' },
  { key: 'sandship', title: 'Sandship', kicker: 'ROCKBITE GAMES · SHIPPED', description: 'A moving factory in a strange desert, built around crafting and automation.', contribution: 'Crafting, automation, live operations', image: '/assets/games/sandship.webp', url: 'https://rockbitegames.com/games/sandship', landmark: 'The Machine Yard' },
  { key: 'battle', title: 'Battle Cards', kicker: 'ROCKBITE GAMES · SHIPPED', description: 'A fast PvP card battler starring heroic ducks. It grew from a game jam prototype into a full release.', contribution: 'PvP, strategy, deck building · from prototype to launch', image: '/assets/games/battle-cards.webp', url: 'https://apps.apple.com/app/id1600226027', landmark: 'The Tournament Grounds' },
  { key: 'wizard', title: 'Idle Wizard', kicker: 'BROWSER GAME · PLAYABLE NOW', description: 'A magical idle adventure I am building now. Meet Elara Starbrew and see where the story goes.', contribution: 'Independent game · in active development', image: '/assets/games/idle-wizard.webp', url: 'https://idlewizard.pages.dev/', landmark: 'The Observatory' },
  { key: 'shmixel', title: 'Shmixel', kicker: 'CREATIVE TOOL · LIVE', description: 'A pixel art editor for making little worlds of your own, right in the browser.', contribution: 'Creative tool · design and development', image: '/assets/games/shmixel-art.webp', url: 'https://davstep.github.io/shmixel/', landmark: 'The Maker Hall' },
  { key: 'dwarves', title: 'Drunk Dwarves', kicker: 'CO-OP MINING GAME · IN DEVELOPMENT', description: 'A playful mining world of rocky tunnels, strange finds, minecarts, and questionable coworkers.', contribution: 'Independent game · prototype in development', image: '/assets/games/drunk-dwarves.webp', landmark: 'The Mining Guild' },
];
export const PROJECT_BY_KEY = Object.fromEntries(PROJECTS.map(p => [p.key, p])) as Record<ProjectKey, ProjectInfo>;
