import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import './tggsp.css';
import './v012.css';
import './v014.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>
);
