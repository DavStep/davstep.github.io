import './portfolio.css';
import './theme';

// Paint the portfolio first, then share one renderer between the hero and the game.
let townModule: Promise<typeof import('./town/main')> | undefined;
let opening = false;
const heroWorld = document.querySelector<HTMLElement>('#hero-world-view')!;
const heroObserver = new IntersectionObserver(entries => {
  if (!entries[0].isIntersecting) return;
  heroObserver.disconnect();
  window.setTimeout(async () => {
    try {
      townModule ??= import('./town/main');
      const town = await townModule;
      if (!opening && !document.body.classList.contains('game-playing')) town.showHeroWorld();
    } catch { townModule = undefined; /* The static world remains available. */ }
  }, 150);
});
heroObserver.observe(heroWorld);
async function openTown() {
  if (opening || document.body.classList.contains('game-playing')) return;
  opening = true;
  const buttons = document.querySelectorAll<HTMLButtonElement>('[data-play-town]');
  const status = document.querySelector<HTMLElement>('#town-load-status')!;
  buttons.forEach(button => button.setAttribute('aria-busy', 'true'));
  status.hidden = false;
  status.textContent = 'Opening the little world…';
  try {
    townModule ??= import('./town/main');
    const town = await townModule;
    status.hidden = true;
    town.startGame();
  } catch (error) {
    townModule = undefined;
    status.textContent = 'The town could not open this time. You can try again, or keep exploring my work below.';
    console.error('Could not open the town', error);
  } finally {
    opening = false;
    buttons.forEach(button => button.removeAttribute('aria-busy'));
  }
}
document.querySelectorAll<HTMLButtonElement>('[data-play-town]').forEach(button => button.addEventListener('click', () => { void openTown(); }));
const copyDiscord = document.querySelector<HTMLButtonElement>('[data-copy-discord]')!;
copyDiscord.addEventListener('click', async () => {
  const status = document.querySelector<HTMLElement>('#contact-status')!;
  try {
    await navigator.clipboard.writeText('step_dev');
    status.textContent = 'Discord name copied.';
  } catch {
    status.textContent = 'Find me on Discord: step_dev';
  }
});
window.addEventListener('popstate', () => { if (location.hash === '#town' || location.hash.startsWith('#town/')) void openTown(); });
// Direct game links and diagnostic runs still open the full town.
if (location.hash === '#town' || location.hash.startsWith('#town/') || new URLSearchParams(location.search).has('playtest')) void openTown();
