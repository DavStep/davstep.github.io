import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { evaluate, IDEAS, chooseIdea, newGameSave, parseGameSave, type Idea } from '../src/town/game';
import { requirements } from '../src/town/action-rules';
import { ACTIONS, eventWaves, forecast, GUIDED_ORDER, nextSuggestion } from '../src/town/action-story';
import { decisionMarkup, journalMarkup } from '../src/town/decision-panel';
import { ReactionEffects, eventFocus } from '../src/town/reaction-effects';

test('every rendered reaction has its prerequisites in an earlier wave', () => {
  const orders: Idea[][] = [[...GUIDED_ORDER], [...IDEAS].reverse(), ['walls', ...IDEAS.filter(i => i !== 'walls')]];
  let seed = 7128;
  for (let n = 0; n < 80; n++) {
    const order = [...IDEAS];
    for (let i = order.length - 1; i > 0; i--) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; const j = seed % (i + 1); [order[i], order[j]] = [order[j], order[i]]; }
    orders.push(order);
  }
  for (const order of orders) {
    let before = evaluate([]);
    for (let turn = 1; turn <= order.length; turn++) {
      const after = evaluate(order.slice(0, turn)), shown = { ...before.levels };
      assert.equal(after.events.filter(e => e.level === 1).length, 1);
      for (const wave of eventWaves(after)) {
        for (const event of wave) {
          assert.equal(event.level, shown[event.idea] + 1);
          for (const req of requirements(event.idea, event.level)) assert.ok(shown[req.idea] >= req.level, `${event.idea} happened before ${req.idea}`);
        }
        for (const event of wave) shown[event.idea] = event.level;
      }
      assert.deepEqual(shown, after.levels, 'skipping and normal playback converge');
      before = after;
    }
    assert.equal(before.perfect, true, 'every early decision remains recoverable');
  }
});

test('preview is read-only and exactly predicts the committed result', () => {
  const save = newGameSave();
  for (const idea of GUIDED_ORDER) {
    const before = evaluate(save.order), serialized = JSON.stringify(save);
    assert.equal(nextSuggestion(before), idea);
    const predicted = forecast(before, idea);
    assert.equal(JSON.stringify(save), serialized);
    assert.match(decisionMarkup(before, idea), new RegExp(ACTIONS[idea].verb));
    assert.deepEqual(chooseIdea(save, idea), predicted);
    assert.deepEqual(evaluate(parseGameSave(JSON.stringify(save)).order), predicted);
  }
  assert.equal(nextSuggestion(evaluate(save.order)), undefined);
  assert.match(journalMarkup(evaluate(save.order)), /forged tools for the crossings/);
});

test('expansion needs actual water, harvests, defenses and surveys, never an idea count', () => {
  const noWater = evaluate(IDEAS.filter(i => i !== 'river'));
  assert.ok(Object.values(noWater.levels).every(level => level < 4));
  const noWalls = evaluate(IDEAS.filter(i => i !== 'walls'));
  assert.ok(Object.values(noWalls.levels).every(level => level < 5));
  const noSurveys = evaluate(IDEAS.filter(i => i !== 'observatory'));
  assert.ok(Object.values(noSurveys.levels).every(level => level < 7));
  assert.equal(evaluate(IDEAS).perfect, true);
});

test('causal effects support every action and release resources on interruption', () => {
  const scene = new THREE.Scene(), fx = new ReactionEffects(scene);
  for (const idea of IDEAS) {
    const event = { idea, level: 2, wave: 1, sources: requirements(idea, 2) };
    fx.begin(event); fx.update(.2);
    assert.equal(fx.group.visible, true);
    fx.reveal(); fx.update(.2);
    let disposed = 0;
    fx.group.traverse(node => { if (node instanceof THREE.Mesh || node instanceof THREE.Line) node.geometry.addEventListener('dispose', () => disposed++); });
    fx.clear();
    assert.ok(disposed > 0);
    assert.equal(fx.group.visible, false);
  }
  assert.notDeepEqual(eventFocus({ idea: 'workshop', level: 4 }), eventFocus({ idea: 'workshop', level: 2 }));
  fx.dispose(); assert.equal(scene.children.length, 0);
});
