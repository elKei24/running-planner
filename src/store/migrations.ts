import { SCHEMA_VERSION } from '@/domain/types';
import type { PlannerState } from '@/domain/types';
import { validateState, ValidationError } from './schema';

type Migration = (raw: Record<string, unknown>) => Record<string, unknown>;

/**
 * Migrations are keyed by the version they migrate *from*. Each takes the raw
 * JSON object at version n and returns it at version n+1. Keep them pure.
 */
export const migrations: Record<number, Migration> = {
  // Example for the future:
  // 1: (raw) => ({ ...raw, version: 2, athlete: { ...(raw.athlete as object), newField: 0 } }),
};

/** Bring any persisted/imported document up to the current schema and validate it. */
export function migrate(raw: unknown): PlannerState {
  if (typeof raw !== 'object' || raw === null) throw new ValidationError('state: expected an object');
  let doc = { ...(raw as Record<string, unknown>) };
  let version = typeof doc.version === 'number' ? doc.version : 1;
  if (version > SCHEMA_VERSION) {
    throw new ValidationError(`This file was created by a newer version of the app (schema ${version}).`);
  }
  while (version < SCHEMA_VERSION) {
    const step = migrations[version];
    if (!step) throw new ValidationError(`No migration from schema version ${version}`);
    doc = step(doc);
    version = typeof doc.version === 'number' ? doc.version : version + 1;
  }
  return validateState({ ...doc, version: SCHEMA_VERSION });
}
