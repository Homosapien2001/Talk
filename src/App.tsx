import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import useAppStore from './store/appStore';
import { EVENTS } from '../shared/events';

import Auth from './components/Auth';
import Lobby from './components/Lobby';
import Queue from './components/Queue';
import WalkIn from './components/WalkIn';
import Session from './components/Session';
import PostSession from './components/PostSession';

function App() {
  const { view, user, socket, setView, setSocket, setUser, setSession } = useAppStore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser({
          uid: currentUser.uid,
          displayName: currentUser.displayName || 'Anonymous',
          email: currentUser.email || ''
        });
      } else {
        setUser(null);
        setView('auth');
      }
    });

    return () => unsubscribe();
  }, [setUser, setView]);

  useEffect(() => {
    if (user) {
      const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';
      const newSocket = io(SOCKET_URL);
      setSocket(newSocket);

      newSocket.on(EVENTS.START_SESSION, (data) => {
        setSession(data);
        setView('walkin');
      });

      newSocket.on(EVENTS.SESSION_DISSOLVED, () => {
        setView('post');
      });

      return () => {
        newSocket.disconnect();
        setSocket(null);
      };
    } else {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
    }
  }, [user, setSocket, setSession, setView]);

  return (
    <div className="app">
      {view === 'auth' && <Auth />}
      {view === 'lobby' && <Lobby />}
      {view === 'queue' && <Queue />}
      {view === 'walkin' && <WalkIn />}
      {view === 'session' && <Session />}
      {view === 'post' && <PostSession onReturn={() => setView('lobby')} />}

      <div className="bg-glow"></div>
    </div>
  );
}

export default App;
