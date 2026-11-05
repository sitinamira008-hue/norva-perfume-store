import { createRoot } from 'react-dom/client';
import { initPerformanceModeAttribute } from './utils/devicePerformance';
import App from './App.tsx';
import './index.css';

initPerformanceModeAttribute();

createRoot(document.getElementById('root')!).render(<App />);
