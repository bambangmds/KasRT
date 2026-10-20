import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { SekretariatProvider } from './context/SekretariatContext.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SekretariatProvider>
      <App />
    </SekretariatProvider>
  </StrictMode>,
);
