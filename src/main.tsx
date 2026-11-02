import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/inter';
import CityLoader from './CityLoader';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <CityLoader />
  </React.StrictMode>,
);
