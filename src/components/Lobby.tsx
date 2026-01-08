import React, { useState, useEffect } from 'react';

interface LobbyProps {
  onStart: () => void;
}

const Lobby: React.FC<LobbyProps> = ({ onStart }) => {
  const [audioLevel, setAudioLevel] = useState(0);

  // Mock audio visualizer for "Vibe Check"
  useEffect(() => {
    const interval = setInterval(() => {
      setAudioLevel(Math.random() * 100);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="view-container lobby-view">
      <header className="float">
        <h1>Talk Around the Campfire</h1>
        <p className="text-secondary">Temporary, safe, anonymous voice conversations.</p>
      </header>

      <div className="vibe-check glass">
        <h3>Vibe Check</h3>
        <p className="text-secondary">Make some noise to test your mic.</p>

        <div className="visualizer-container">
          <div
            className="visualizer-bar"
            style={{ width: `${audioLevel}%`, background: `hsl(var(--accent-orange))` }}
          ></div>
        </div>

        <div className="status-badge">
          <span className="dot pulse"></span>
          Mic Active
        </div>
      </div>

      <div className="actions">
        <button className="btn btn-primary" onClick={onStart}>
          Find a Campfire
        </button>
        <p className="hint text-secondary">You'll join a room of 2 people once everyone is ready.</p>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        .view-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3rem;
          padding: 2rem;
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
