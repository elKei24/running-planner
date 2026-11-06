import { downloadText, exportJson } from '@/io/json';
import { loadError, persistFailed, state, todayDate } from '@/store/state';
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
      {s && persistFailed.value && (
        <div class="alert danger" role="alert">
          <div class="row between">
            <span>
              This browser is not saving your data (storage is blocked or full). Changes will be lost when you close the tab. Export a backup now and
              re-import it in a browser that allows site data.
            </span>
            <button class="btn small" type="button" onClick={() => downloadText(`running-planner-${todayDate.value}.json`, exportJson(s))}>
              Export backup
            </button>
          </div>
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
