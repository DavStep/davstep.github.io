/** Design reference only. Does not import or change the live game. */
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const IDS = ['settlers', 'forest', 'workshop', 'roads', 'quarry', 'archive', 'waterworks', 'walls', 'market', 'observatory'];
const I = Object.fromEntries(IDS.map((id, index) => [id, index]));
const ALL = (1 << IDS.length) - 1;
const ENGINEERED = 1, RESERVOIR = 2, WIDE_GATES = 4, FOLKLORE = 8;
const has = (state, id) => Boolean(state.mask & (1 << I[id]));
const at = (state, id, level = 2) => state.levels[I[id]] >= level;

export function emptyState() {
  return { mask: 0, flags: 0, levels: IDS.map(() => 0), quarryTest: 'pending', floodTest: 'pending' };
}

// Every predicate is monotone over a prefix. A narrow gate cannot be added
// after trade opens: opening trade already required Roads2, which reserves
// wide gates if Walls is subsequently selected.
function settle(state) {
  const chosen = id => has(state, id);
  const ready = (id, level = 2) => at(state, id, level);
  let changed = true, passes = 0;
  const raise = (id, level, condition) => {
    if (chosen(id) && condition && state.levels[I[id]] < level) {
      state.levels[I[id]] = level;
      changed = true;
    }
  };
  while (changed) {
    changed = false;
    assert.ok(++passes <= 31, 'Non-terminating progression closure');
    raise('forest', 2, chosen('settlers'));
    raise('workshop', 2, ready('forest'));
    raise('roads', 2, ready('workshop'));
    raise('quarry', 2, ready('workshop') && ready('roads'));
    raise('archive', 2, chosen('settlers') && ready('roads'));
    raise('waterworks', 2, ready('workshop') && ready('quarry'));
    raise('walls', 2, ready('quarry') && ready('workshop'));
    raise('market', 2, ready('roads') && (!chosen('walls') || Boolean(state.flags & WIDE_GATES)));
    raise('observatory', 2, ready('workshop') && ready('market'));
    raise('settlers', 2, ready('forest') && (ready('waterworks') || ready('market')));

    raise('settlers', 3, ready('settlers') && ready('quarry') && ready('waterworks', 3) && ready('walls'));
    raise('forest', 3, ready('forest') && ready('waterworks', 3));
    raise('workshop', 3, ready('workshop') && ready('quarry') && ready('waterworks'));
    raise('roads', 3, ready('roads') && Boolean(state.flags & ENGINEERED) && ready('quarry') && ready('archive'));
    raise('quarry', 3, ready('quarry') && ready('workshop', 3) && ready('archive') && ready('forest'));
    raise('archive', 3, ready('archive') && ready('quarry', 3) && ready('observatory'));
    raise('waterworks', 3, ready('waterworks') && Boolean(state.flags & RESERVOIR) && ready('workshop', 3) && ready('forest'));
    raise('walls', 3, ready('walls') && Boolean(state.flags & WIDE_GATES) && ready('archive') && ready('waterworks', 3) && ready('observatory'));
    raise('market', 3, ready('market') && ready('waterworks') && ready('walls') && ready('roads', 3) && ready('observatory'));
    raise('observatory', 3, ready('observatory') && ready('archive') && ready('workshop', 3) && ready('roads', 3));
  }
}

export function choose(previous, id) {
  assert.ok(Object.hasOwn(I, id), `Unknown choice ${id}`);
  assert.ok(!has(previous, id), `Repeated choice ${id}`);
  const state = { ...previous, levels: [...previous.levels], mask: previous.mask | (1 << I[id]) };
  // Capture layout from the fully settled PRE-choice state, never after
  // the new choice has supplied its own missing prerequisite.
  if (id === 'roads' && at(previous, 'workshop')) state.flags |= ENGINEERED;
  if (id === 'waterworks' && at(previous, 'archive')) state.flags |= RESERVOIR;
  if (id === 'walls' && at(previous, 'roads')) state.flags |= WIDE_GATES;
  if (id === 'archive' && !at(previous, 'roads')) state.flags |= FOLKLORE;
  state.levels[I[id]] = 1;
  settle(state);
  // Trials use the settled capabilities of this turn. A blueprint arriving
  // in the same reaction wave can prevent a trial; layout reservations above
  // cannot be rewritten. Neither trial removes basic operation or levels.
  if (state.quarryTest === 'pending' && at(state, 'quarry')) {
    state.quarryTest = at(state, 'archive') ? 'protected' : 'slipped';
  }
  if (state.floodTest === 'pending' && at(state, 'waterworks')) {
    state.floodTest = at(state, 'archive') ? 'protected' : 'overtopped';
  }
  for (let index = 0; index < IDS.length; index++) {
    assert.ok(state.levels[index] >= previous.levels[index], 'Levels must not fall');
    assert.ok(state.levels[index] >= 0 && state.levels[index] <= 3);
    assert.equal(state.levels[index] > 0, Boolean(state.mask & (1 << index)));
  }
  if (at(state, 'roads', 3)) assert.ok(state.flags & ENGINEERED);
  if (at(state, 'waterworks', 3)) assert.ok(state.flags & RESERVOIR);
  if (at(state, 'walls', 3)) assert.ok(state.flags & WIDE_GATES);
  return state;
}

export function describe(state) {
  const finished = state.mask === ALL;
  const maxCount = state.levels.filter(level => level === 3).length;
  const secret = finished && Boolean(state.flags & FOLKLORE) && !(state.flags & ENGINEERED)
    && at(state, 'roads') && at(state, 'archive') && at(state, 'observatory')
    && at(state, 'forest', 3) && at(state, 'market');
  const quarryRecovered = state.quarryTest === 'slipped' && at(state, 'archive') && at(state, 'workshop');
  const floodRecovered = state.floodTest === 'overtopped' && at(state, 'archive') && at(state, 'workshop');
  return {
    levels: Object.fromEntries(IDS.map((id, index) => [id, state.levels[index]])),
    layouts: {
      roads: has(state, 'roads') ? state.flags & ENGINEERED ? 'engineered' : 'packbridge' : 'unbuilt',
      waterworks: has(state, 'waterworks') ? state.flags & RESERVOIR ? 'reservoir' : 'run-of-river' : 'unbuilt',
      walls: has(state, 'walls') ? state.flags & WIDE_GATES ? 'wagon-gates' : 'wicket' : 'unbuilt',
      folklore: Boolean(state.flags & FOLKLORE),
    },
    events: {
      quarry: { firstOutcome: state.quarryTest, recovered: quarryRecovered, slipScarReclaimed: quarryRecovered && at(state, 'quarry', 3) },
      flood: { firstOutcome: state.floodTest, recovered: floodRecovered },
      drought: !finished ? 'pending' : at(state, 'waterworks', 3) ? 'protected' : at(state, 'market') ? 'buffered' : 'shortage',
    },
    finished, maxCount, perfect: finished && maxCount === IDS.length, secret,
  };
}

export function simulate(order) {
  let state = emptyState();
  const turns = [];
  for (const id of order) {
    const before = state;
    state = choose(state, id);
    turns.push({ turn: turns.length + 1, chosen: id,
      upgrades: IDS.flatMap((key, index) => state.levels[index] > before.levels[index]
        ? [{ id: key, from: before.levels[index], to: state.levels[index] }] : []),
      ...describe(state) });
  }
  return { order, turns, result: describe(state) };
}

export const SCENARIOS = {
  perfect: ['settlers', 'forest', 'workshop', 'roads', 'archive', 'quarry', 'waterworks', 'walls', 'market', 'observatory'],
  earlyObservatory: ['settlers', 'forest', 'workshop', 'roads', 'market', 'observatory', 'archive', 'quarry', 'waterworks', 'walls'],
  secret: ['settlers', 'forest', 'archive', 'roads', 'workshop', 'quarry', 'waterworks', 'walls', 'market', 'observatory'],
  secondSecret: ['archive', 'forest', 'roads', 'settlers', 'workshop', 'quarry', 'waterworks', 'market', 'observatory', 'walls'],
  earlyWater: ['settlers', 'forest', 'workshop', 'roads', 'waterworks', 'quarry', 'archive', 'walls', 'market', 'observatory'],
  plansBeforeWaterCommission: ['settlers', 'forest', 'workshop', 'waterworks', 'roads', 'archive', 'quarry', 'walls', 'market', 'observatory'],
  earlyWalls: ['settlers', 'forest', 'workshop', 'walls', 'roads', 'archive', 'quarry', 'waterworks', 'market', 'observatory'],
  earlyQuarry: ['settlers', 'forest', 'workshop', 'roads', 'quarry', 'archive', 'waterworks', 'walls', 'market', 'observatory'],
  earlyTower: ['observatory', 'settlers', 'forest', 'workshop', 'roads', 'archive', 'quarry', 'waterworks', 'walls', 'market'],
  packbridgeWithoutStories: ['settlers', 'forest', 'roads', 'workshop', 'archive', 'quarry', 'waterworks', 'walls', 'market', 'observatory'],
  shortage: ['walls', 'waterworks', 'market', 'roads', 'observatory', 'quarry', 'workshop', 'archive', 'forest', 'settlers'],
};

function validateScenarios() {
  const scenarios = Object.fromEntries(Object.entries(SCENARIOS).map(([name, order]) => [name, simulate(order)]));
  const result = name => scenarios[name].result;
  assert.ok(result('perfect').perfect);
  assert.ok(result('earlyObservatory').perfect);
  assert.equal(scenarios.earlyObservatory.turns[5].levels.observatory, 2);
  assert.ok(result('secret').secret && !result('secret').perfect);
  assert.equal(result('secret').maxCount, 7);
  assert.ok(result('secondSecret').secret);
  assert.equal(result('earlyWater').levels.waterworks, 2);
  assert.equal(result('earlyWater').events.flood.firstOutcome, 'overtopped');
  assert.equal(result('earlyWater').events.flood.recovered, true);
  assert.equal(result('earlyWater').events.drought, 'buffered');
  assert.equal(result('plansBeforeWaterCommission').levels.waterworks, 2);
  assert.equal(result('plansBeforeWaterCommission').layouts.waterworks, 'run-of-river');
  assert.equal(result('plansBeforeWaterCommission').events.flood.firstOutcome, 'protected');
  assert.equal(result('earlyWalls').levels.market, 1);
  assert.equal(result('earlyWalls').levels.walls, 2);
  assert.equal(result('earlyWalls').levels.observatory, 1);
  assert.equal(result('earlyQuarry').events.quarry.firstOutcome, 'slipped');
  assert.equal(result('earlyQuarry').events.quarry.slipScarReclaimed, true);
  assert.ok(result('earlyQuarry').perfect); // Historical mishaps can heal fully.
  assert.ok(result('earlyTower').perfect);
  assert.equal(scenarios.earlyTower.turns[0].levels.observatory, 1);
  assert.equal(result('packbridgeWithoutStories').secret, false);
  assert.equal(result('shortage').events.drought, 'shortage');
  assert.throws(() => simulate(['roads', 'roads']));
  assert.throws(() => simulate(['not-an-option']));
  assert.deepEqual(simulate(SCENARIOS.secret), simulate([...SCENARIOS.secret]), 'Replay must be deterministic');
  return scenarios;
}

function enumerate() {
  // Dynamic programming enumerates every order's weight, merging prefixes
  // only when ALL future-relevant state (including trial history) is equal.
  const memo = new Map();
  const coverage = IDS.map(() => new Set([0]));
  let transitions = 0;
  const visit = state => {
    state.levels.forEach((level, i) => coverage[i].add(level));
    const key = [state.mask, state.flags, state.quarryTest, state.floodTest, state.levels.join('')].join(':');
    if (memo.has(key)) return memo.get(key);
    const summary = { orders: 0, perfect: 0, secret: 0, both: 0,
      drought: { protected: 0, buffered: 0, shortage: 0 }, maxHistogram: Array(11).fill(0) };
    if (state.mask === ALL) {
      const result = describe(state);
      summary.orders = 1;
      summary.perfect = Number(result.perfect);
      summary.secret = Number(result.secret);
      summary.both = Number(result.perfect && result.secret);
      summary.drought[result.events.drought] = 1;
      summary.maxHistogram[result.maxCount] = 1;
    } else {
      for (const id of IDS) if (!has(state, id)) {
        transitions++;
        const child = visit(choose(state, id));
        for (const field of ['orders', 'perfect', 'secret', 'both']) summary[field] += child[field];
        for (const field of ['protected', 'buffered', 'shortage']) summary.drought[field] += child.drought[field];
        child.maxHistogram.forEach((count, index) => { summary.maxHistogram[index] += count; });
      }
    }
    memo.set(key, summary);
    return summary;
  };
  const result = visit(emptyState());
  assert.equal(result.orders, 3_628_800);
  assert.ok(result.perfect > 1 && result.secret > 1);
  assert.equal(result.both, 0);
  assert.equal(result.maxHistogram.reduce((a, b) => a + b, 0), result.orders);
  assert.equal(Object.values(result.drought).reduce((a, b) => a + b, 0), result.orders);
  coverage.forEach((levels, index) => assert.deepEqual([...levels].sort(), [0, 1, 2, 3], `${IDS[index]} has an unreachable level`));
  return { ...result, uniqueStates: memo.size, transitions,
    levelCoverage: Object.fromEntries(IDS.map((id, index) => [id, [...coverage[index]].sort()])) };
}

function independentOrderCheck() {
  // Independent oracle: use only choice POSITIONS, never levels, choose(),
  // settle(), or memoized state. Roads operates after the last of S/F/W/R;
  // surveys after the last of those and A. At completion all other
  // recoverable services exist unless the commercial gate is too narrow.
  const positions = Array(IDS.length).fill(-1);
  const result = { orders: 0, perfect: 0, secret: 0 };
  const permute = (depth, mask) => {
    if (depth === IDS.length) {
      result.orders++;
      const toolsReady = Math.max(positions[I.settlers], positions[I.forest], positions[I.workshop]);
      const roadsReady = Math.max(toolsReady, positions[I.roads]);
      const surveysReady = Math.max(roadsReady, positions[I.archive]);
      const engineered = positions[I.roads] > toolsReady;
      const reservoir = positions[I.waterworks] > surveysReady;
      const wideGates = positions[I.walls] > roadsReady;
      const folklore = positions[I.archive] < roadsReady;
      if (engineered && reservoir && wideGates) result.perfect++;
      if (!engineered && reservoir && wideGates && folklore) result.secret++;
      return;
    }
    for (let index = 0; index < IDS.length; index++) if (!(mask & (1 << index))) {
      positions[index] = depth;
      permute(depth + 1, mask | (1 << index));
    }
  };
  permute(0, 0);
  return result;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const scenarios = validateScenarios();
  const exhaustive = process.argv.includes('--exhaustive') ? enumerate() : null;
  const independent = exhaustive ? independentOrderCheck() : null;
  if (independent) for (const field of ['orders', 'perfect', 'secret']) {
    assert.equal(exhaustive[field], independent[field], `Independent positional count disagrees: ${field}`);
  }
  const report = { rulesVersion: 'town-redesign-1', scenarios,
    exhaustive, independent };
  const outputIndex = process.argv.indexOf('--output');
  if (outputIndex !== -1) {
    assert.ok(process.argv[outputIndex + 1], 'Missing output path');
    writeFileSync(process.argv[outputIndex + 1], JSON.stringify(report, null, 2) + '\n');
  }
  console.log(JSON.stringify({
    scenarios: Object.fromEntries(Object.entries(scenarios).map(([name, value]) => [name, value.result])),
    exhaustive: report.exhaustive,
    independent,
  }, null, 2));
}
