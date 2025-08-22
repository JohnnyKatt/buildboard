import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx'; // must match the actual filename/case

const root = createRoot(document.getElementById('root'));
root.render(<App />);