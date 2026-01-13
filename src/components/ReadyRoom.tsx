import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';

interface ReadyRoomProps {
  socket: Socket;
  currentUserId?: string; // To identify "You"
}

// Consistent with Campfire.tsx
const CHARACTERS = ["🦊", "🐻", "🐼", "🐨", "🐸", "🐷", "🐯", "🦁", "🐧", "🦉"];

const ReadyRoom: React.FC<ReadyRoomProps> = ({ socket, currentUserId }) => {
  const [participantsCount, setParticipantsCount] = useState(0);
  const [readyCount, setReadyCount] = useState(0);
  const [isReady, setIsReady] = useState(false);
  // Store usernames: socketId -> name
  const [usernames, setUsernames] = useState<{ [key: string]: string }>({});
  const totalNeeded = 2;

  useEffect(() => {
    socket.on('room-update', (data: { participants: number, readyCount: number, usernames?: { [key: string]: string } }) => {
      console.log('[READYROOM] room-update:', data);
      setParticipantsCount(data.participants);
      setReadyCount(data.readyCount);
      if (data.usernames) {
        setUsernames(data.usernames);
      }
    });

    return () => {
      socket.off('room-update');
    };
  }, [socket]);

  const handleToggleReady = () => {
    const nextReady = !isReady;
    console.log('[READYROOM] Toggling ready to:', nextReady);
    setIsReady(nextReady);
    socket.emit('toggle-ready', nextReady);
  };

  // Turn usernames object into array for rendering
  // We want to be stable, so let's sort by socketId or keys
  const participantIds = Object.keys(usernames).sort();

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
        {Array.from({ length: totalNeeded }).map((_, i) => {
          const userId = participantIds[i]; // May be undefined if not full
          const isOccupied = i < participantsCount;
          const name = userId ? (usernames[userId] || 'Anonymous') : '';
          // Determine if this specific slot is ready?
          // The server sends aggregate readyCount, not per-user ready status (except implicitly).
          // NOTE: Per-user ready status is not fully exposed by server yet in 'room-update', only count.
          // We'll just show the generic ready check if count > i for now, or improve server later.
          // For now, let's just show Avatar + Name if occupied.

          return (
            <div key={i} className={`slot glass ${isOccupied ? 'occupied' : ''}`}>
              {isOccupied ? (
                <div className="participant-info">
                  <div className="avatar-med">
                    <span className="char">{CHARACTERS[i % CHARACTERS.length]}</span>
                  </div>
                  <span className="name-tag">
                    {userId === socket.id ? `${name} (You)` : name}
                  </span>
                  {/* 
                           Visual indication of readiness could go here if we had per-user ready data.
                           For now, the aggregate text below handles it.
                        */}
                </div>
              ) : (
                <div className="spinner"></div>
              )}
            </div>
          );
        })}
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
          gap: 3rem;
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
          display: flex;
          justify-content: center;
          gap: 2rem;
          width: 100%;
          max-width: 500px;
          flex-wrap: wrap;
        }
        .slot {
          width: 140px;
          height: 160px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: var(--transition);
          position: relative;
          opacity: 0.3;
          border-radius: 12px;
          background: rgba(255,255,255,0.03);
        }
        .slot.occupied {
          opacity: 1;
          border-color: rgba(255,255,255,0.2);
          background: rgba(255,255,255,0.08);
        }
        .participant-info {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0.8rem;
            width: 100%;
        }
        .avatar-med {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 2.5rem;
        }
        .name-tag {
            font-size: 0.9rem;
            font-weight: 600;
            color: white;
            text-align: center;
            max-width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            padding: 0 0.5rem;
        }
        
        .spinner {
          width: 30px;
          height: 30px;
          border: 3px solid rgba(255,255,255,0.1);
          border-top-color: hsl(var(--text-secondary));
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}} />
    </div>
  );
};

export default ReadyRoom;
