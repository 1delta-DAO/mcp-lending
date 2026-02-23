import React from 'react';
import ReactDOM from 'react-dom/client';
import ChatContainer from './ChatContainer';
import './index.css';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <ChatContainer />
  </React.StrictMode>
);
