import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { evaluate, IDEAS, chooseIdea, newGameSave, parseGameSave, type Idea } from '../src/town/game';
import { JOINT_PROJECTS, projectStages } from '../src/town/action-rules';
import { eventWaves } from '../src/town/action-story';
import { ReactionEffects, eventFocus } from '../src/town/reaction-effects';
import { IDEA_COLORS } from '../src/town/idea-colors';

test('every rendered reaction names a placed partner from an earlier wave', () => {
  const orders: Idea[][] = [[...IDEAS], [...IDEAS].reverse(), ['walls', ...IDEAS.filter(i => i !== 'walls')]];
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
          for (const source of event.sources) assert.ok(shown[source.idea] >= source.level, `${event.idea} happened before ${source.idea}`);
          if (event.project) assert.ok(JOINT_PROJECTS.some(project => project.id === event.project && project.ideas.includes(event.idea)));
        }
        for (const event of wave) shown[event.idea] = event.level;
      }
      assert.deepEqual(shown, after.levels, 'skipping and normal playback converge');
      before = after;
    }
    assert.equal(before.perfect, before.faults.length === 0, 'all collaborations are required for MAX');
    assert.equal(before.score, Object.values(before.levels).reduce((sum, level) => sum + level, 0));
  }
});

test('each direct choice commits once and survives reload', () => {
  const save = newGameSave();
  for (const idea of IDEAS) {
    const predicted = evaluate([...save.order, idea]);
    const state = chooseIdea(save, idea);
    assert.deepEqual(state, predicted);
    assert.equal(state.events.filter(event => event.level === 1).length, 1);
    assert.throws(() => chooseIdea(save, idea));
    assert.deepEqual(evaluate(parseGameSave(JSON.stringify(save)).order), state);
  }
});

test('each project rewards both partners and a missed project cannot be rebuilt', () => {
  for (const idea of IDEAS) {
    const rewards = JOINT_PROJECTS.filter(project => project.ideas.includes(idea))
      .reduce((sum, project) => sum + projectStages(project, idea), 0);
    assert.equal(rewards, 7, `${idea} should have seven upgrades after arrival`);
  }
  const missed = evaluate(['roads', 'settlers', ...IDEAS.filter(i => i !== 'roads' && i !== 'settlers')]);
  assert.ok(missed.faults.some(fault => fault.project === 'street-plan'));
  assert.ok(!missed.projects.includes('street-plan'));
  assert.ok(missed.levels.roads < 8);
  assert.ok(missed.levels.settlers < 8);
});

test('causal effects support every action and release resources on interruption', () => {
  const scene = new THREE.Scene(), fx = new ReactionEffects(scene);
  for (const idea of IDEAS) {
    const event = { idea, level: 2, wave: 1, sources: [] };
    fx.begin(event); fx.update(.2);
    assert.equal(fx.group.visible, true);
    fx.reveal(); fx.update(.2);
    let disposed = 0;
    fx.group.traverse(node => { if (node instanceof THREE.Mesh || node instanceof THREE.Line) node.geometry.addEventListener('dispose', () => disposed++); });
    fx.clear();
    assert.ok(disposed > 0);
    assert.equal(fx.group.visible, false);
  }
  assert.deepEqual(eventFocus({ idea: 'workshop', level: 4 }), eventFocus({ idea: 'workshop', level: 2 }), 'local upgrades stay focused on the town');
  assert.notDeepEqual(eventFocus({ idea: 'river', level: 4 }), eventFocus({ idea: 'river', level: 2 }), 'regional channels keep their own focus');
  fx.begin({idea:'grove',level:2,wave:1,sources:[]},'river');fx.reveal();
  const ring=fx.group.getObjectByProperty('type','Mesh') as THREE.Mesh;
  assert.equal((ring.material as THREE.MeshBasicMaterial).color.getHex(),IDEA_COLORS.river,'partner upgrades retain the clicked idea color');
  fx.clear();
  fx.dispose(); assert.equal(scene.children.length, 0);
});
