import type { PlannerState } from '@/domain/types';
import { migrate } from '@/store/migrations';

export function exportJson(state: PlannerState): string {
  return JSON.stringify({ ...state, exportedAt: new Date().toISOString(), app: 'running-planner' }, null, 2);
}

export function importJson(text: string): PlannerState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('The file is not valid JSON.');
  }
  if (typeof parsed === 'object' && parsed !== null) {
    const { exportedAt: _e, app: _a, ...rest } = parsed as Record<string, unknown>;
    return migrate(rest);
  }
  return migrate(parsed);
}

/** Trigger a browser download of a text file. */
export function downloadText(filename: string, text: string, mime = 'application/json'): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
