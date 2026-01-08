import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import Lobby from './components/Lobby';
import ReadyRoom from './components/ReadyRoom';
import Campfire from './components/Campfire';
import PostSession from './components/PostSession';

type ViewState = 'lobby' | 'ready' | 'campfire' | 'post-session';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

function App() {
  const [view, setView] = useState<ViewState>('lobby');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [sessionData, setSessionData] = useState<{ roomID: string, peers: string[], duration: number } | null>(null);

  useEffect(() => {
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    newSocket.on('start-session', (data: { roomID: string, peers: string[], duration?: number }) => {
      console.log('[APP] Received start-session:', data);
      setSessionData({
        roomID: data.roomID,
        peers: data.peers,
        duration: data.duration || 15 * 60 * 1000
      });
      setView('campfire');
    });

    newSocket.on('session-dissolved', () => {
      setView('post-session');
    });

    return () => {
      newSocket.close();
    };
  }, []);

  const handleStartFinding = () => {
    if (socket) {
      socket.emit('join-queue');
      setView('ready');
    }
  };

  const handleLeaveSession = () => {
    setView('post-session');
  };

  return (
    <div className="app">
      {view === 'lobby' && <Lobby onStart={handleStartFinding} />}
      {view === 'ready' && socket && <ReadyRoom socket={socket} />}
      {view === 'campfire' && socket && sessionData && (
        <Campfire
          socket={socket}
          sessionData={sessionData}
          onLeave={handleLeaveSession}
        />
      )}
      {view === 'post-session' && <PostSession onReturn={() => setView('lobby')} />}

      {/* Visual background details */}
      <div className="bg-glow"></div>
    </div>
  );
}

export default App;
