import type { PlannerState } from '@/domain/types';
import { migrate } from './migrations';

export const STORAGE_KEY = 'running-planner/state';

export interface Storage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function defaultStorage(): Storage | undefined {
  try {
    // Prefer the browser's window.localStorage: newer Node versions expose a
    // global `localStorage` that is undefined unless a storage file is set.
    const g = globalThis as { window?: { localStorage?: Storage }; localStorage?: Storage };
    return g.window?.localStorage ?? g.localStorage ?? undefined;
  } catch {
    return undefined;
  }
}

export interface LoadResult {
  state: PlannerState | null;
  /** Set when stored data existed but could not be read. The raw text is kept for export. */
  error?: { message: string; raw: string };
}

export function loadState(storage: Storage | null | undefined = defaultStorage()): LoadResult {
  if (!storage) return { state: null };
  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { state: null };
  }
  if (!raw) return { state: null };
  try {
    return { state: migrate(JSON.parse(raw)) };
  } catch (e) {
    return { state: null, error: { message: e instanceof Error ? e.message : String(e), raw } };
  }
}

export function saveState(state: PlannerState, storage: Storage | null | undefined = defaultStorage()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function clearState(storage: Storage | null | undefined = defaultStorage()): void {
  try {
    storage?.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
