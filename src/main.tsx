import { render } from 'preact';
import { App } from './ui/App';
import { initStore } from './store/state';
import './ui/styles.css';

initStore();
render(<App />, document.getElementById('app')!);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  import('virtual:pwa-register')
    .then(({ registerSW }) => registerSW({ immediate: true }))
    .catch(() => {
      /* offline support is optional */
    });
}
