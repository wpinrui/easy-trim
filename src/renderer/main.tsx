import React from 'react';
import { createRoot } from 'react-dom/client';
import { FluentProvider, webDarkTheme } from '@fluentui/react-components';
import { App } from './App';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('#root missing');
createRoot(container).render(
  <React.StrictMode>
    <FluentProvider theme={webDarkTheme} style={{ height: '100%' }}>
      <App />
    </FluentProvider>
  </React.StrictMode>
);
