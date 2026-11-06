import { loadError, state } from '@/store/state';
import { route } from './router';
import { Setup } from './Setup';
import { WeekView } from './WeekView';
import { PlanOverview } from './PlanOverview';
import { LogView } from './LogView';
import { EventsView } from './EventsView';
import { SettingsView } from './SettingsView';
import { Nav } from './Nav';

export function App() {
  const s = state.value;
  const err = loadError.value;
  return (
    <div class="app">
      <header class="topbar">
        <a class="brand" href="#/">
          <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" />
          Running Planner
        </a>
        {s && <Nav />}
      </header>
      {err && (
        <div class="alert danger" role="alert">
          Stored data could not be read ({err.message}). You can start over below, or recover the raw data from Settings → Data after creating a plan.
        </div>
      )}
      {!s ? <Setup /> : <Main />}
    </div>
  );
}

function Main() {
  switch (route.value) {
    case 'plan':
      return <PlanOverview />;
    case 'log':
      return <LogView />;
    case 'events':
      return <EventsView />;
    case 'settings':
      return <SettingsView />;
    default:
      return <WeekView />;
  }
}
