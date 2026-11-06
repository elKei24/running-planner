import { plan } from '../src/planner/plan';
import type { PlannerState } from '../src/domain/types';

const state: PlannerState = {
  version: 1,
  createdAt: '2026-11-04',
  athlete: { weeklyKmRecent: 40, longestRecentRunKm: 16, daysPerWeek: 5, longRunDay: 6, peakWeeklyKm: 75, referenceRace: { distanceKm: 10, timeSec: 48 * 60 } },
  goal: { date: '2027-03-14', distanceKm: 42.195, targetTimeSec: 3 * 3600 + 45 * 60, name: 'Spring Marathon' },
  events: [
    { id: 'r1', kind: 'race', date: '2027-01-24', distanceKm: 21.0975, priority: 'B', name: 'Tune-up half' },
    { id: 'b1', kind: 'block', from: '2026-12-24', to: '2026-12-28', reason: 'vacation' },
  ],
  log: [],
};
const s = plan(state, process.argv[2] ?? '2026-11-06');
console.log('level', s.fitness.levelKm, 'long', s.fitness.longRunKm, 'vdot', s.paces?.vdot.toFixed(1), 'pred', s.paces && (s.paces.predictedGoalTimeSec/60).toFixed(0), 'min');
console.log('paces', JSON.stringify(s.paces));
for (const w of s.weeks) {
  const line = w.sessions.map((x) => `${x.type.slice(0,4)}:${x.distanceKm}`).join(' ');
  console.log(String(w.index).padStart(2), w.startDate, w.phase.padEnd(5), String(w.targetKm).padStart(5), w.isStepBack ? 'SB' : '  ', line, w.notes.join(' | '));
}
console.log(s.warnings);
