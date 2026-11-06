import type { LocalDate, Weekday } from './dates';

/** Persisted schema version. Bump together with a migration in store/migrations.ts. */
export const SCHEMA_VERSION = 1;

export type Priority = 'B' | 'C';

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
}

export type Phase = 'base' | 'build' | 'peak' | 'taper';

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
