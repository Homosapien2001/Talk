import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from './firebase';
import Auth from './components/Auth';
import Lobby from './components/Lobby';
import ReadyRoom from './components/ReadyRoom';
import Campfire from './components/Campfire';
import PostSession from './components/PostSession';

type ViewState = 'lobby' | 'ready' | 'campfire' | 'post-session';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [view, setView] = useState<ViewState>('lobby');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [sessionData, setSessionData] = useState<{ roomID: string, peers: string[], duration: number, host?: string } | null>(null);

  // Handle authentication state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Initialize socket only when authenticated
  useEffect(() => {
    if (!user) {
      // Close socket if user logs out
      if (socket) {
        socket.close();
        setSocket(null);
      }
      return;
    }

    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    newSocket.on('start-session', (data: { roomID: string, peers: string[], duration?: number, host?: string }) => {
      console.log('[APP] Received start-session:', data);
      setSessionData({
        roomID: data.roomID,
        peers: data.peers,
        duration: data.duration || 15 * 60 * 1000,
        host: data.host
      });
      setView('campfire');
    });

    newSocket.on('session-dissolved', () => {
      setView('post-session');
    });

    return () => {
      newSocket.close();
    };
  }, [user]);

  const handleStartFinding = () => {
    if (socket) {
      socket.emit('join-queue', { username: user?.displayName || 'Anonymous' });
      setView('ready');
    }
  };

  const handleLeaveSession = () => {
    setView('post-session');
  };

  // Show loading state while checking auth
  if (authLoading) {
    return (
      <div className="app" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        color: 'hsl(var(--text-primary))'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div className="loading-spinner" style={{
            width: '40px',
            height: '40px',
            border: '4px solid rgba(255, 255, 255, 0.1)',
            borderTopColor: 'hsl(var(--accent-orange))',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 16px'
          }}></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Show Auth component if not authenticated
  if (!user) {
    return <Auth />;
  }

  // Show main app if authenticated
  return (
    <div className="app">
      {view === 'lobby' && <Lobby onStart={handleStartFinding} />}
      {view === 'ready' && socket && <ReadyRoom socket={socket} />}
      {view === 'campfire' && socket && sessionData && (
        <Campfire
          socket={socket}
          sessionData={sessionData}
          onLeave={handleLeaveSession}
          userName={user.displayName || 'Anonymous'}
        />
      )}
      {view === 'post-session' && <PostSession onReturn={() => setView('lobby')} />}

      {/* Visual background details */}
      <div className="bg-glow"></div>
    </div>
  );
}

export default App;
