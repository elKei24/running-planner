import type { SessionType } from './types';

/**
 * Rate of perceived exertion on a 1–10 scale (Borg CR10, worded for runners).
 * The "talk test" column is the most reliable cue for most people.
 */
export const RPE_SCALE: ReadonlyArray<{ value: number; label: string; meaning: string }> = [
  { value: 1, label: 'Very light', meaning: 'Walking or shuffling. Could go on all day.' },
  { value: 2, label: 'Light', meaning: 'Relaxed jog. Full sentences, nose breathing possible.' },
  { value: 3, label: 'Easy', meaning: 'Comfortable, conversational. The bread-and-butter easy run.' },
  { value: 4, label: 'Moderate', meaning: 'Still chatting in sentences, but you notice the effort.' },
  { value: 5, label: 'Somewhat hard', meaning: 'Steady, marathon-ish effort. Short sentences only.' },
  { value: 6, label: 'Hard', meaning: 'Controlled discomfort. A few words at a time.' },
  { value: 7, label: 'Very hard', meaning: 'Threshold / tempo. One or two words, you want it to end.' },
  { value: 8, label: 'Very, very hard', meaning: 'Interval effort. No talking, breathing is the limit.' },
  { value: 9, label: 'Extremely hard', meaning: 'Near maximal. Sustainable only for a couple of minutes.' },
  { value: 10, label: 'Maximal', meaning: 'All-out. Race finish or a final sprint.' },
];

export function rpeLabel(value: number): string {
  return RPE_SCALE.find((r) => r.value === value)?.label ?? '';
}

/** The RPE range a session type should feel like, as [min, max]. */
export function expectedRpe(type: SessionType): [number, number] | undefined {
  switch (type) {
    case 'recovery':
      return [1, 2];
    case 'easy':
    case 'long':
      return [2, 4];
    case 'marathonPace':
      return [5, 6];
    case 'tempo':
      return [6, 7];
    case 'intervals':
      return [8, 9];
    case 'race':
      return [8, 10];
    case 'rest':
      return undefined;
  }
}
