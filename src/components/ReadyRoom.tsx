import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';

interface ReadyRoomProps {
  socket: Socket;
}

const ReadyRoom: React.FC<ReadyRoomProps> = ({ socket }) => {
  const [participantsCount, setParticipantsCount] = useState(0);
  const [readyCount, setReadyCount] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const totalNeeded = 2;

  useEffect(() => {
    socket.on('room-update', (data: { participants: number, readyCount: number }) => {
      setParticipantsCount(data.participants);
      setReadyCount(data.readyCount);
    });

    return () => {
      socket.off('room-update');
    };
  }, [socket]);

  const handleToggleReady = () => {
    const nextReady = !isReady;
    setIsReady(nextReady);
    socket.emit('toggle-ready', nextReady);
  };

  return (
    <div className="view-container ready-view">
      <div className="status-header">
        <h2>Finding a Group...</h2>
        <div className="participant-counter glass">
          <span className="count">{participantsCount}/{totalNeeded}</span>
          <span className="text-secondary">Participants Found</span>
        </div>
      </div>

      <div className="readiness-grid">
        {Array.from({ length: totalNeeded }).map((_, i) => (
          <div key={i} className={`slot glass ${i < participantsCount ? 'occupied' : ''} ${i < readyCount ? 'ready' : ''}`}>
            {i < participantsCount ? (
              <div className="avatar-placeholder"></div>
            ) : (
              <div className="spinner"></div>
            )}
          </div>
        ))}
      </div>

      <div className="ready-action">
        <button
          className={`btn ${isReady ? 'btn-ghost' : 'btn-primary'}`}
          onClick={handleToggleReady}
        >
          {isReady ? 'Ready!' : 'I am Ready'}
        </button>
        <p className="hint text-secondary">
          {participantsCount < totalNeeded
            ? 'Waiting for more people...'
            : `${readyCount}/${totalNeeded} people are ready. Session starts soon.`}
        </p>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        .ready-view {
          gap: 4rem;
        }
        .participant-counter {
          padding: 0.5rem 1rem;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          margin-top: 1rem;
        }
        .count {
          font-weight: 700;
          color: hsl(var(--accent-orange));
        }
        .readiness-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 2rem;
          width: 100%;
          max-width: 300px;
        }
        .slot {
          aspect-ratio: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: var(--transition);
          position: relative;
          opacity: 0.3;
        }
        .slot.occupied {
          opacity: 1;
        }
        .slot.ready {
          border-color: hsl(var(--success));
          background: hsla(var(--success), 0.1);
        }
        .slot.ready::after {
          content: '✓';
          position: absolute;
          bottom: 5px;
          right: 5px;
          color: hsl(var(--success));
          font-weight: bold;
        }
        .avatar-placeholder {
          width: 60%;
          height: 60%;
          background: rgba(255,255,255,0.1);
          border-radius: 50%;
        }
        .spinner {
          width: 20px;
          height: 20px;
          border: 2px solid rgba(255,255,255,0.1);
          border-top-color: hsl(var(--text-secondary));
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .disabled {
          opacity: 0.5;
          cursor: not-allowed;
          pointer-events: none;
        }
      `}} />
    </div>
  );
};

export default ReadyRoom;
