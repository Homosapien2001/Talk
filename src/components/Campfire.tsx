import React, { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import Peer from 'simple-peer';

interface CampfireProps {
  socket: Socket;
  sessionData: { roomID: string, peers: string[], duration: number };
  onLeave: () => void;
}

const ROLES = [
  { title: 'The Starter', instruction: 'Kick things off with a simple question or thought.' },
  { title: 'The Listener', instruction: 'Hold space for others. Validating with a "hmm" or "yeah" is plenty.' },
  { title: 'The Speaker', instruction: 'Share a small, honest fragment of your day.' },
  { title: 'The Connector', instruction: 'Try to find a small common thread between two things said.' }
];

const Campfire: React.FC<CampfireProps> = ({ socket, sessionData, onLeave }) => {
  console.log('[CAMPFIRE] Initializing with peers:', sessionData.peers);
  const [currentPeers, setCurrentPeers] = useState(sessionData.peers);
  const sortedPeers = [...currentPeers].sort();

  if (!socket.id) {
    console.log('[CAMPFIRE] Waiting for socket.id...');
    return <div className="view-container"><h2>Connecting to the group...</h2></div>;
  }

  const myIndex = sortedPeers.indexOf(socket.id);
  // Safety check for role indexing
  const roleIndex = myIndex >= 0 ? myIndex % ROLES.length : 0;
  const role = ROLES[roleIndex];

  const [audioEnabled, setAudioEnabled] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [flagged, setFlagged] = useState<string[]>([]);
  const [speakingPeers, setSpeakingPeers] = useState<{ [key: string]: number }>({});
  const [timeLeft, setTimeLeft] = useState(sessionData.duration);
  const [isEnding, setIsEnding] = useState(false);
  const peersRef = useRef<{ [key: string]: any }>({});
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    // Session Timer Interval
    const timer = setInterval(() => {
      setTimeLeft(prev => Math.max(0, prev - 1000));
    }, 1000);

    socket.on('session-ending', (data: { remaining: number }) => {
      setIsEnding(true);
      setTimeLeft(data.remaining);
    });

    socket.on('session-dissolved', () => {
      onLeave();
    });

    socket.on('participant-removed', (data: { peerId: string, newPeers: string[] }) => {
      if (peersRef.current[data.peerId]) {
        peersRef.current[data.peerId].destroy();
        delete peersRef.current[data.peerId];
        document.getElementById(`audio-${data.peerId}`)?.remove();
      }
      setCurrentPeers(data.newPeers);
    });

    const initVoice = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          },
          video: false
        });
        localStreamRef.current = stream;
        setAudioEnabled(true);

        // Setup local visualizer
        setupVisualizer(socket.id as string, stream);

        // Create connections to all other peers
        sessionData.peers.forEach(peerId => {
          if (peerId === socket.id) return;

          const isInitiator = (socket.id as string) < peerId;
          const peer = new Peer({
            initiator: isInitiator,
            trickle: false,
            stream: stream,
          });

          peer.on('signal', (signal: any) => {
            socket.emit('signal', { to: peerId, signal });
          });

          peer.on('stream', (remoteStream: MediaStream) => {
            console.log(`[CAMPFIRE] Received remote stream from ${peerId}`);
            // Visualize AND play remote stream
            setupVisualizer(peerId, remoteStream, true);

            // Create and append audio element with robust attributes
            let audio = document.getElementById(`audio-${peerId}`) as HTMLAudioElement;
            if (!audio) {
              audio = document.createElement('audio');
              audio.id = `audio-${peerId}`;
              // Critical for mobile and browser autoplay policies
              audio.autoplay = true;
              (audio as any).playsInline = true;
              audio.style.position = 'absolute';
              audio.style.opacity = '0';
              audio.style.pointerEvents = 'none';
              document.body.appendChild(audio);
            }
            audio.srcObject = remoteStream;

            audio.play().catch(e => {
              console.warn(`[CAMPFIRE] Autoplay blocked for ${peerId}:`, e);
              setAudioBlocked(true);
            });
          });

          peersRef.current[peerId] = peer;
        });

        socket.on('signal', (data: { from: string, signal: any }) => {
          const peer = peersRef.current[data.from];
          if (peer) peer.signal(data.signal);
        });
      } catch (err) {
        console.error("[CAMPFIRE] Failed to get local stream", err);
      }
    };

    const setupVisualizer = (id: string, stream: MediaStream, isRemote: boolean = false) => {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      // If it's a remote stream, also route it to the speakers via the AudioContext
      if (isRemote) {
        source.connect(ctx.destination);
        console.log(`[CAMPFIRE] Routed remote stream ${id} to AudioContext destination`);
      }

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateVolume = () => {
        if (!localStreamRef.current) return; // Cleanup check
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        setSpeakingPeers(prev => ({ ...prev, [id]: average }));
        requestAnimationFrame(updateVolume);
      };
      updateVolume();
    };

    initVoice();

    return () => {
      // Cleanup
      clearInterval(timer);
      localStreamRef.current?.getTracks().forEach(track => track.stop());
      Object.keys(peersRef.current).forEach(id => {
        document.getElementById(`audio-${id}`)?.remove();
        peersRef.current[id].destroy();
      });
      socket.off('signal');
      socket.off('session-ending');
      socket.off('session-dissolved');
      socket.off('participant-removed');
      audioContextRef.current?.close();
    };
  }, [socket, sessionData]);

  const toggleFlag = (id: string) => {
    setFlagged(prev => {
      const isFlagging = !prev.includes(id);
      if (isFlagging) {
        socket.emit('flag-participant', id);
        return [...prev, id];
      } else {
        return prev.filter(p => p !== id);
      }
    });
  };

  const handleManualLeave = () => {
    socket.emit('leave-room');
    onLeave();
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`view-container campfire-view ${isEnding ? 'fading' : ''}`}>
      <div className="top-bar">
        <div className="session-info glass">
          <div className="role-card">
            <span className="label">Your Role</span>
            <h3>{role.title}</h3>
            <p className="instruction text-secondary">{role.instruction}</p>
          </div>
        </div>

        <div className="timer-container glass">
          <span className="label">Fire remains</span>
          <div className={`timer ${isEnding ? 'warning' : ''}`}>
            {formatTime(timeLeft)}
          </div>
        </div>
      </div>

      <div className="participants-ring">
        <div className={`fire-core pulse ${isEnding ? 'dying' : ''}`}></div>
        <div className="embers">
          {[...Array(6)].map((_, i) => (
            <span key={i} className="ember" style={{
              left: `${20 + Math.random() * 60}%`,
              animationDelay: `${i * 0.8}s`,
              animationDuration: `${2 + Math.random() * 2}s`
            }}></span>
          ))}
        </div>
        {sortedPeers.map((peerId, i) => {
          const isMe = peerId === socket.id;
          const displayIndex = (i - myIndex + sortedPeers.length) % sortedPeers.length; // Center "me" at the top-ish
          const volume = speakingPeers[peerId] || 0;
          const isSpeaking = volume > 20;

          return (
            <div
              key={peerId}
              className="participant-node"
              style={{ transform: `rotate(${displayIndex * (360 / sortedPeers.length)}deg) translateY(-140px) rotate(-${displayIndex * (360 / sortedPeers.length)}deg)` }}
            >
              <div
                className={`avatar glass ${isSpeaking ? 'speaking' : ''}`}
                style={{
                  boxShadow: isSpeaking ? `0 0 ${volume / 2}px hsla(var(--accent-orange), ${volume / 100})` : 'none',
                  transform: isSpeaking ? `scale(${1 + volume / 500})` : 'scale(1)'
                }}
              >
                {isMe && <span className="you-label">You</span>}
              </div>
              {!isMe && (
                <button
                  className={`flag-btn ${flagged.includes(peerId) ? 'active' : ''}`}
                  onClick={() => toggleFlag(peerId)}
                  title="Silent Flag"
                >
                  !
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="controls">
        {audioBlocked && (
          <button className="btn btn-primary pulse" onClick={() => {
            const audios = document.querySelectorAll('audio');
            audios.forEach(a => a.play().catch(console.error));
            if (audioContextRef.current) {
              audioContextRef.current.resume().then(() => {
                console.log('[CAMPFIRE] AudioContext resumed');
                setAudioBlocked(false);
              });
            } else {
              setAudioBlocked(false);
            }
          }}>
            Tap to Hear Group
          </button>
        )}
        <button className="btn btn-ghost" onClick={handleManualLeave}>
          Leave Softly
        </button>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        .campfire-view {
          justify-content: space-between;
          padding: 2rem;
          transition: background 5s ease;
        }
        .campfire-view.fading {
          background: radial-gradient(circle, #1a1005 0%, #050505 100%);
        }
        .top-bar {
          display: flex;
          justify-content: space-between;
          width: 100%;
          gap: 1rem;
        }
        .session-info {
          padding: 1.2rem 1.5rem;
          flex: 1;
          max-width: 350px;
        }
        .timer-container {
            padding: 1.2rem 1.5rem;
            text-align: right;
            min-width: 120px;
        }
        .timer {
            font-size: 1.5rem;
            font-weight: bold;
            color: hsl(var(--accent-orange));
            font-family: monospace;
        }
        .timer.warning {
            color: hsl(var(--danger));
            animation: pulse 1s infinite;
        }
        .fire-core.dying {
            filter: grayscale(1) brightness(0.5);
            box-shadow: 0 0 20px rgba(0,0,0,0.5);
        }
        .embers {
            position: absolute;
            width: 100px;
            height: 100px;
            pointer-events: none;
        }
        .ember {
            position: absolute;
            bottom: 0;
            width: 4px;
            height: 4px;
            background: hsl(var(--accent-orange));
            border-radius: 50%;
            filter: blur(1px);
            opacity: 0;
            animation: floatUp linear infinite;
        }
        @keyframes floatUp {
            0% { transform: translateY(0) scale(1); opacity: 0; }
            20% { opacity: 0.8; }
            80% { opacity: 0.8; }
            100% { transform: translateY(-100px) scale(0); opacity: 0; }
        }
        .dying {
            transform: scale(0.3);
            opacity: 0.5;
            filter: blur(20px);
        }
        .role-card h3 {
          color: hsl(var(--accent-orange));
          margin: 0.2rem 0;
          font-size: 1.2rem;
        }
        .instruction {
          font-size: 0.9rem;
          font-style: italic;
        }
        .label {
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          opacity: 0.6;
        }
        .participants-ring {
          position: relative;
          width: 300px;
          height: 300px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .fire-core {
          width: 60px;
          height: 60px;
          background: radial-gradient(circle, hsl(var(--accent-orange)) 0%, transparent 70%);
          border-radius: 50%;
          filter: blur(10px);
        }
        .participant-node {
          position: absolute;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
        }
        .avatar {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }
        .you-label {
          font-size: 0.6rem;
          color: hsl(var(--accent-orange));
          font-weight: bold;
        }
        .flag-btn {
          background: transparent;
          border: none;
          color: rgba(255,255,255,0.2);
          cursor: pointer;
          font-weight: bold;
          font-size: 1rem;
          padding: 5px;
          transition: var(--transition);
        }
        .flag-btn:hover {
          color: hsl(var(--danger));
        }
        .flag-btn.active {
          color: hsl(var(--danger));
          opacity: 1;
        }
        .controls {
          width: 100%;
          display: flex;
          justify-content: center;
        }
      `}} />
    </div>
  );
};

export default Campfire;
