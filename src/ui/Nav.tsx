import { route } from './router';
import type { Route } from './router';

/** Small 24×24 stroke icons; styled by nav.tabs a svg. */
const ICONS: Record<Route, preact.JSX.Element> = {
  week: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
      <path d="M8 15h3" />
    </svg>
  ),
  plan: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 20h18" />
      <path d="M5 16V11M10 16V7M15 16v-5M20 16V4" />
    </svg>
  ),
  log: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 4h14v16H5z" />
      <path d="M8.5 12.5l2.3 2.3L15.5 10" />
    </svg>
  ),
  events: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 21V4" />
      <path d="M5 4h13l-2.5 4 2.5 4H5" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="15" cy="7" r="2.5" />
      <circle cx="9" cy="17" r="2.5" />
    </svg>
  ),
};

const items: Array<{ id: Route; label: string; href: string }> = [
  { id: 'week', label: 'Week', href: '#/' },
  { id: 'plan', label: 'Plan', href: '#/plan' },
  { id: 'log', label: 'Log', href: '#/log' },
  { id: 'events', label: 'Events', href: '#/events' },
  { id: 'settings', label: 'Settings', href: '#/settings' },
];

export function Nav() {
  return (
    <nav class="tabs" aria-label="Main">
      {items.map((it) => (
        <a key={it.id} href={it.href} class={route.value === it.id ? 'active' : ''} aria-current={route.value === it.id ? 'page' : undefined}>
          {ICONS[it.id]}
          {it.label}
        </a>
      ))}
    </nav>
  );
}

/** The brand mark: a running track seen from above, with the athlete as a lime dot. */
export function Mark() {
  return (
    <svg class="mark" viewBox="0 0 32 32" aria-hidden="true">
      <rect class="track" x="3" y="7" width="26" height="18" rx="9" fill="none" stroke-width="2.2" />
      <rect class="track" x="9" y="12.5" width="14" height="7" rx="3.5" fill="none" stroke-width="1.4" />
      <circle class="dot" cx="24" cy="10.5" r="3.4" stroke-width="1.4" />
    </svg>
  );
}
