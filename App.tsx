import React from 'react';
import { useAuth } from './context/AuthContext';
import { LoginPage } from './components/LoginPage';
import { MainApp } from './components/MainApp';

function App() {
  const { currentUser } = useAuth();

  return (
    <div className="min-h-screen bg-base-100 text-base-content font-sans">
      {currentUser ? <MainApp /> : <LoginPage />}
    </div>
  );
}

export default App;