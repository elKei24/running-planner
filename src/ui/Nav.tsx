import { route } from './router';
import type { Route } from './router';

const items: Array<{ id: Route; label: string; icon: string; href: string }> = [
  { id: 'week', label: 'Week', icon: '📅', href: '#/' },
  { id: 'plan', label: 'Plan', icon: '📈', href: '#/plan' },
  { id: 'log', label: 'Log', icon: '✅', href: '#/log' },
  { id: 'events', label: 'Events', icon: '🏁', href: '#/events' },
  { id: 'settings', label: 'Settings', icon: '⚙️', href: '#/settings' },
];

export function Nav() {
  return (
    <nav class="tabs" aria-label="Main">
      {items.map((it) => (
        <a key={it.id} href={it.href} class={route.value === it.id ? 'active' : ''} aria-current={route.value === it.id ? 'page' : undefined}>
          <span class="icon" aria-hidden="true">{it.icon}</span>
          {it.label}
        </a>
      ))}
    </nav>
  );
}
