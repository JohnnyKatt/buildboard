import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';  // match the actual filename/case of the full app (App.js)

const root = createRoot(document.getElementById('root'));
root.render(<App />);