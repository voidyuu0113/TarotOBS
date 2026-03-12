import './styles.css';
import { TarotApp } from './app/App';

const root = document.getElementById('app');

if (!root) {
  throw new Error('Missing #app root element');
}

const app = new TarotApp(root);
void app.init();
