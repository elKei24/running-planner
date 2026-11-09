import type { PlanWarning } from '@/domain/types';

export function Warnings({ warnings }: { warnings: PlanWarning[] }) {
  if (warnings.length === 0) return null;
  return (
    <div class="alerts">
      {warnings.map((w, i) => (
        <div key={i} class={`alert ${w.level}`} role={w.level === 'danger' ? 'alert' : 'status'}>
          {w.message}
        </div>
      ))}
    </div>
  );
}
