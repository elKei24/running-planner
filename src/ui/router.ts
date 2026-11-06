import { signal } from '@preact/signals';

export type Route = 'week' | 'plan' | 'log' | 'events' | 'settings';

function parse(hash: string): Route {
  const name = hash.replace(/^#\/?/, '').split('?')[0];
  switch (name) {
    case 'plan':
    case 'log':
    case 'events':
    case 'settings':
      return name;
    default:
      return 'week';
  }
}

export const route = signal<Route>(parse(typeof location !== 'undefined' ? location.hash : ''));

export function navigate(to: Route): void {
  if (typeof location !== 'undefined') location.hash = to === 'week' ? '#/' : `#/${to}`;
  route.value = to;
}

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    route.value = parse(location.hash);
  });
}
