import React, { useEffect } from 'react';
import Campfire3D from './Campfire3D';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';

interface LobbyProps {
  onStart: () => void;
}

const Lobby: React.FC<LobbyProps> = ({ onStart }) => {


  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="view-container lobby-view">
      <header className="float">
        <h1>Talk Around the Campfire</h1>
        <p className="text-secondary">Temporary, safe, anonymous voice conversations.</p>
      </header>

      <div className="vibe-check">
        <h3>Setting the Vibe</h3>
        <p className="text-secondary">Warming up the campfire...</p>

        <div style={{ margin: '1rem 0' }}>
          <Campfire3D />
        </div>
      </div>

      <div className="actions">
        <button className="btn btn-primary" onClick={onStart}>
          Find a Campfire
        </button>
        <p className="hint text-secondary">You'll join a room of 2 people once everyone is ready.</p>
      </div>

      <button
        className="btn btn-ghost"
        onClick={handleLogout}
        style={{ position: 'absolute', top: '20px', right: '20px' }}
      >
        Logout
      </button>

      <style dangerouslySetInnerHTML={{
        __html: `
        .view-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          overflow-y: auto;
          max-height: 100vh;
          justify-content: center;
          gap: 1.5rem;
          padding: 1rem;
          text-align: center;
        }
        .vibe-check {
          padding: 2rem;
          width: 100%;
          max-width: 400px;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .visualizer-container {
          height: 8px;
          background: rgba(255,255,255,0.1);
          border-radius: 4px;
          overflow: hidden;
        }
        .visualizer-bar {
          height: 100%;
          transition: width 0.1s ease-out;
        }
        .status-badge {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 0.8rem;
          color: hsl(var(--success));
        }
        .dot {
          width: 8px;
          height: 8px;
          background: currentColor;
          border-radius: 50%;
        }
        .hint {
          font-size: 0.9rem;
          margin-top: 1rem;
        }
        .bg-glow {
            position: absolute;
            bottom: -10%;
            left: 50%;
            transform: translateX(-50%);
            width: 80vw;
            height: 40vh;
            background: radial-gradient(circle, hsla(var(--accent-orange), 0.1) 0%, transparent 70%);
            z-index: -1;
            filter: blur(60px);
        }
      `}} />
    </div>
  );
};

export default Lobby;
