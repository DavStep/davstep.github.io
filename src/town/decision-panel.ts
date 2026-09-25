import { ACTIONS, changedIdeas, chapter, eventTitle, explainEvent, forecast, levelLabel, nextSuggestion, turnSummary } from './action-story';
import { IDEA_INFO, evaluate, upgradeBlocker, type GameState, type Idea } from './game';
import { MILESTONES } from './milestones';

/** All text is authored locally; no player content is interpolated into markup. */
export function decisionMarkup(state: GameState, selected: Idea): string {
  const action = ACTIONS[selected], placed = state.levels[selected] > 0;
  if (placed) {
    const level = state.levels[selected];
    return `<div class="decision-heading"><span class="story-eyebrow">IN YOUR TOWN · ${levelLabel(level)}</span><h2>${MILESTONES[selected][level - 1].name}</h2></div><p>${MILESTONES[selected][level - 1].description}</p><div class="decision-need"><b>Next step</b><span>${upgradeBlocker(selected, state.levels, state.gateMask) ?? 'Complete. This district now supports the rest of the valley.'}</span></div>`;
  }
  const after = forecast(state, selected);
  const changes = changedIdeas(state, after).filter(idea => idea !== selected);
  const missing = upgradeBlocker(selected, after.levels, after.gateMask);
  return `<div class="decision-heading"><span class="story-eyebrow">${nextSuggestion(state) === selected ? 'SUGGESTED NEXT' : 'YOUR DECISION'}</span><h2>${action.verb}</h2></div><p class="decision-motive">${action.need}</p><p>${action.promise}</p><div class="decision-need"><b>${changes.length ? 'Chain reaction' : 'What happens now'}</b><span>${changes.length ? changes.map(idea => `${IDEA_INFO[idea].name} ${state.levels[idea]} → ${after.levels[idea]}`).join(' · ') : `${eventTitle(after.events[after.events.length - 1])}.`}</span></div>${missing ? `<div class="decision-wait"><b>Then it needs</b> ${missing}</div>` : ''}<button type="button" id="game-commit">${action.verb} <span aria-hidden="true">→</span></button>`;
}
export function chapterMarkup(state: GameState): string {
  const current = chapter(state);
  return `<span class="story-eyebrow">${current.name}</span><span>${current.goal}</span>`;
}
export function journalMarkup(state: GameState): string {
  if (!state.order.length) return '<p>Your town’s story starts with your first decision.</p>';
  return state.order.map((idea, index) => {
    const before = evaluate(state.order.slice(0, index));
    const after = evaluate(state.order.slice(0, index + 1));
    return `<details class="journal-turn" ${index === state.order.length - 1 ? 'open' : ''}><summary>${String(index + 1).padStart(2, '0')} · ${ACTIONS[idea].verb}</summary><p>${turnSummary(before, after)}</p><ol>${after.events.map(event => `<li><b>${eventTitle(event)}</b><span>${explainEvent(event)}</span></li>`).join('')}</ol></details>`;
  }).reverse().join('');
}
