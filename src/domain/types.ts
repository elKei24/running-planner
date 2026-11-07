import type { LocalDate, Weekday } from './dates';

/** Persisted schema version. Bump together with a migration in store/migrations.ts. */
export const SCHEMA_VERSION = 2;

export type Units = 'km' | 'mi';

export interface Prefs {
  /** Display units. Everything is stored in km; this only affects formatting. */
  units: Units;
}

export type Priority = 'B' | 'C';

/**
 * How to use the available weeks. 'steady' ramps evenly to the peak by the end of the
 * peak phase; 'fast' reaches peak volume in ~16 weeks, maintains, then runs a 12-week
 * marathon block (only differs from 'steady' beyond 24 weeks).
 */
export type BuildStrategy = 'steady' | 'fast';

export interface ReferenceRace {
  distanceKm: number;
  timeSec: number;
}

export interface Athlete {
  /** Average weekly volume over the last few weeks before the plan started. */
  weeklyKmRecent: number;
  /** Longest single run in the last few weeks before the plan started. */
  longestRecentRunKm: number;
  /** Number of running days per week the athlete wants to train (3..7). */
  daysPerWeek: number;
  longRunDay: Weekday;
  /** Peak weekly volume the plan should build towards. */
  peakWeeklyKm: number;
  /** A recent race used to derive training paces (optional). */
  referenceRace?: ReferenceRace;
  /** Defaults to 'steady' when absent. */
  buildStrategy?: BuildStrategy;
}

export interface Goal {
  date: LocalDate;
  distanceKm: number;
  /** Optional target finish time in seconds. */
  targetTimeSec?: number;
  name?: string;
}

export type BlockReason = 'vacation' | 'injury' | 'illness' | 'other';

export type PlanEvent =
  | { id: string; kind: 'race'; date: LocalDate; distanceKm: number; priority: Priority; name?: string }
  | { id: string; kind: 'block'; from: LocalDate; to: LocalDate; reason: BlockReason; note?: string }
  | { id: string; kind: 'availability'; weekOf: LocalDate; days: Weekday[] };

export type RaceEvent = Extract<PlanEvent, { kind: 'race' }>;
export type BlockEvent = Extract<PlanEvent, { kind: 'block' }>;
export type AvailabilityEvent = Extract<PlanEvent, { kind: 'availability' }>;

export interface LogEntry {
  id: string;
  date: LocalDate;
  distanceKm: number;
  durationSec?: number;
  /** Rate of perceived exertion, 1..10. */
  rpe?: number;
  note?: string;
  /** True when the athlete explicitly marked the day as skipped. */
  skipped?: boolean;
}

export interface PlannerState {
  version: number;
  /** Date the plan was created; days before it are not planned. */
  createdAt: LocalDate;
  /**
   * Fitness replay starts at this week. Defaults to createdAt; re-baselining
   * (editing the athlete's current numbers) moves it to the current week.
   */
  baselineDate?: LocalDate;
  athlete: Athlete;
  goal: Goal;
  events: PlanEvent[];
  log: LogEntry[];
  prefs: Prefs;
}

export type Phase = 'base' | 'build' | 'maintain' | 'peak' | 'taper';

export type SessionType =
  | 'rest'
  | 'easy'
  | 'recovery'
  | 'long'
  | 'tempo'
  | 'intervals'
  | 'marathonPace'
  | 'race';

export interface PaceRange {
  /** seconds per km */
  minSecPerKm: number;
  maxSecPerKm: number;
}

export interface Session {
  id: string;
  date: LocalDate;
  type: SessionType;
  distanceKm: number;
  title: string;
  description: string;
  pace?: PaceRange;
  phase: Phase;
  /** Set when this session is a race from the event list or the goal race. */
  raceEventId?: string;
  /** Marked when an event (race/block) changed what would otherwise be planned. */
  adjusted?: boolean;
}

export interface Week {
  index: number;
  startDate: LocalDate;
  phase: Phase;
  /** Planned volume for the week, in km (sessions sum to this, give or take rounding). */
  targetKm: number;
  isStepBack: boolean;
  isRaceWeek: boolean;
  sessions: Session[];
  notes: string[];
}

export interface PaceZones {
  vdot: number;
  easy: PaceRange;
  marathon: PaceRange;
  threshold: PaceRange;
  interval: PaceRange;
  /** Predicted time for the goal distance at the current fitness. */
  predictedGoalTimeSec: number;
}

export interface WeeklyLoad {
  startDate: LocalDate;
  km: number;
  runs: number;
  longestKm: number;
  /** Load the fitness model expected for this week (0 when unknown). */
  expectedKm: number;
}

export interface FitnessEstimate {
  /** Sustainable weekly volume the plan builds from. */
  levelKm: number;
  /** Longest run the athlete has done recently (cap for next long run). */
  longRunKm: number;
  /** Actual weekly loads up to (excluding) the anchor week. */
  history: WeeklyLoad[];
  /** How the level was determined. */
  source: 'declared' | 'log';
  /** Consecutive completed weeks, ending last week, with less than half the expected load. */
  layoffWeeks: number;
}

export type WarningLevel = 'info' | 'warn' | 'danger';

export interface PlanWarning {
  level: WarningLevel;
  message: string;
}

export interface Schedule {
  weeks: Week[];
  warnings: PlanWarning[];
  paces?: PaceZones;
  fitness: FitnessEstimate;
  /** Monday of the week containing `today`. */
  anchorDate: LocalDate;
}
