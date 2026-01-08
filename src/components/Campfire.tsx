import React, { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import Peer from 'simple-peer';

interface CampfireProps {
  socket: Socket;
  sessionData: {
    roomID: string;
    peers: string[];
    duration: number;
  };
  onLeave: () => void;
}

const ROLES = [
  { title: "The Starter", description: "Kick things off with a simple question or thought.", instruction: "You go first. Ask something light." },
  { title: "The Listener", description: "Your job is to ask follow-up questions.", instruction: "Listen closely and dig deeper." },
];

const CHARACTERS = ["🦊", "🐻", "🐼", "🐨", "🐸", "🐷", "🐯", "🦁", "🐧", "🦉"];

const Campfire: React.FC<CampfireProps> = ({ socket, sessionData, onLeave }) => {
  const [currentPeers, setCurrentPeers] = useState(sessionData.peers);
  const sortedPeers = [...currentPeers].sort();

  const myIndex = sortedPeers.indexOf(socket.id || '');
  const roleIndex = myIndex >= 0 ? myIndex % ROLES.length : 0;
  const role = ROLES[roleIndex];

  const [joined, setJoined] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [flagged, setFlagged] = useState<string[]>([]);
  const [speakingPeers, setSpeakingPeers] = useState<{ [key: string]: number }>({});
  const [timeLeft, setTimeLeft] = useState(sessionData.duration);
  const [isEnding, setIsEnding] = useState(false);

  const peersRef = useRef<{ [key: string]: any }>({});
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);


  useEffect(() => {
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

    return () => {
      clearInterval(timer);
      socket.off('session-ending');
      socket.off('session-dissolved');
      socket.off('participant-removed');
      socket.off('signal');

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      Object.values(peersRef.current).forEach(peer => peer.destroy());
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(e => console.error('[CAMPFIRE] Error closing AudioContext:', e));
      }
    };
  }, [onLeave, socket]);

  const setupVisualizer = (id: string, stream: MediaStream, isRemote: boolean = false) => {
    try {
      if (!audioContextRef.current) return;
      const ctx = audioContextRef.current;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      if (isRemote) {
        const gainNode = ctx.createGain();
        gainNode.gain.value = 1.0;
        source.connect(gainNode);
        gainNode.connect(ctx.destination);
      }

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateVolume = () => {
        if (!audioContextRef.current || audioContextRef.current.state === 'closed') return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let j = 0; j < bufferLength; j++) {
          sum += dataArray[j];
        }
        const average = sum / bufferLength;
        setSpeakingPeers(prev => ({ ...prev, [id]: average }));
        requestAnimationFrame(updateVolume);
      };
      updateVolume();
    } catch (e) {
      console.error(`[CAMPFIRE] Failed to setup visualizer for ${id}:`, e);
    }
  };

  const handleJoin = async () => {
    try {
      const CtxClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new CtxClass();
      audioContextRef.current = ctx;
      if (ctx.state === 'suspended') await ctx.resume();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false
      });
      localStreamRef.current = stream;
      setJoined(true);

      setupVisualizer(socket.id as string, stream);

      sessionData.peers.forEach(peerId => {
        if (peerId === socket.id) return;

        const isInitiator = (socket.id as string) < peerId;
        const peer = new Peer({ initiator: isInitiator, trickle: false, stream });

        peer.on('signal', (signal: any) => {
          socket.emit('signal', { to: peerId, signal });
        });

        peer.on('stream', (remoteStream: MediaStream) => {
          console.log(`[CAMPFIRE] Stream received from ${peerId}`);
          setupVisualizer(peerId, remoteStream, true);

          let audio = document.getElementById(`audio-${peerId}`) as HTMLAudioElement;
          if (!audio) {
            audio = document.createElement('audio');
            audio.id = `audio-${peerId}`;
            audio.autoplay = true;
            (audio as any).playsInline = true;
            audio.style.width = '1px';
            audio.style.height = '1px';
            audio.style.position = 'fixed';
            audio.style.bottom = '0';
            document.body.appendChild(audio);
          }
          audio.srcObject = remoteStream;
          audio.volume = 1.0;
          audio.muted = false;
          audio.play().catch(e => {
            console.warn(`[CAMPFIRE] Audio element play failed for ${peerId}`, e);
            setAudioBlocked(true);
          });
        });

        peersRef.current[peerId] = peer;
      });

      socket.on('signal', (data: { from: string, signal: any }) => {
        const peer = peersRef.current[data.from];
        if (peer) peer.signal(data.signal);
      });

    } catch (err: any) {
      console.error("[CAMPFIRE] handleJoin error:", err);
      // Log the stack trace to the alert for debugging
      const stack = err?.stack || 'No stack trace';
      alert(`Could not join campfire.\nError: ${err?.message}\n\nStack: ${stack}`);
      setJoined(false);
    }
  };

  const toggleFlag = (peerId: string) => {
    socket.emit('flag-participant', { roomID: sessionData.roomID, targetPeerID: peerId });
    setFlagged(prev => prev.includes(peerId) ? prev.filter(p => p !== peerId) : [...prev, peerId]);
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`view-container campfire-view ${isEnding ? 'fading' : ''}`}>

      {!joined ? (
        <div className="audio-barrier">
          <div className="barrier-content glass float">
            <div className="icon-large">🔥</div>
            <h3>Campfire is Ready</h3>
            <p>Ready to join the whisper of the group?</p>
            <button className="btn btn-primary pulse" style={{ width: '100%' }} onClick={handleJoin}>
              Join with Audio
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="top-bar">
            <div className="session-info glass">
              <div className="role-card">
                <span className="label">Your Role</span>
                <h3>{role.title}</h3>
                <p className="instruction text-secondary">{role.description}</p>
              </div>
            </div>
            <div className="timer-container glass">
              <span className="label">Fire remains</span>
              <div className={`timer ${isEnding ? 'warning' : ''}`}>{formatTime(timeLeft)}</div>
            </div>
          </div>

          <div className="participants-ring">
            <div className={`fire-pit ${isEnding ? 'dying' : ''}`}>
              <div className="logs">
                <div className="log"></div>
                <div className="log"></div>
                <div className="log"></div>
              </div>
              <div className="fire-core"></div>
              <div className="sparks">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="spark" style={{
                    left: `${Math.random() * 100}%`,
                    animationDelay: `${Math.random() * 2}s`,
                    width: `${2 + Math.random() * 3}px`
                  }} />
                ))}
              </div>
            </div>
            {sortedPeers.map((peerId, i) => {
              const isMe = peerId === socket.id;
              const displayIndex = (i - myIndex + sortedPeers.length) % sortedPeers.length;
              const volume = speakingPeers[peerId] || 0;
              const isSpeaking = volume > 8;

              return (
                <div key={peerId} className="participant-node" style={{ transform: `rotate(${displayIndex * (360 / sortedPeers.length)}deg) translateY(-140px) rotate(-${displayIndex * (360 / sortedPeers.length)}deg)` }}>
                  <div className={`avatar ${isSpeaking ? 'speaking' : ''}`}>
                    <span className="cartoon-char">{CHARACTERS[i % CHARACTERS.length]}</span>
                    {isMe && <span className="you-label">You</span>}
                    {!isMe && <span className="peer-label">{`P${i + 1}`}</span>}
                  </div>
                  {!isMe && (
                    <button className={`flag-btn ${flagged.includes(peerId) ? 'active' : ''}`} onClick={() => toggleFlag(peerId)}>!</button>
                  )}
                </div>
              );
            })}
          </div>

          {audioBlocked && (
            <div className="audio-barrier">
              <div className="barrier-content glass float">
                <div className="icon-large">🔊</div>
                <h3>Audio is Blocked</h3>
                <button className="btn btn-primary pulse" onClick={() => {
                  audioContextRef.current?.resume();
                  document.querySelectorAll('audio').forEach(a => a.play());
                  setAudioBlocked(false);
                }}>Unmute</button>
              </div>
            </div>
          )}

          <div className="controls">
            <button className="btn btn-ghost" onClick={onLeave}>Leave Softly</button>
          </div>
        </>
      )}

      <style dangerouslySetInnerHTML={{
        __html: `
        .campfire-view { position: relative; height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: space-between; padding-top: 10rem; padding-bottom: 2rem; overflow: hidden; background: radial-gradient(circle at center, #1a0a05 0%, #050505 100%); }
        .top-bar { position: absolute; top: 1.5rem; left: 0; right: 0; display: flex; justify-content: center; gap: 1rem; padding: 0 1rem; z-index: 10; pointer-events: none; }
        .session-info, .timer-container { pointer-events: auto; padding: 1rem 1.5rem; border-radius: 1.5rem; background: rgba(255,255,255,0.05); backdrop-filter: blur(15px); border: 1px solid rgba(255,255,255,0.1); width: 100%; max-width: 400px; }
        .timer-container { width: auto; min-width: 120px; text-align: center; }
        .role-card .label { font-size: 0.7rem; color: hsla(var(--accent-orange), 0.7); font-weight: 700; margin-bottom: 0.2rem; display: block; text-transform: uppercase; letter-spacing: 0.05em; }
        .role-card h3 { margin: 0; color: hsl(var(--accent-orange)); font-size: 1.2rem; }
        .role-card .instruction { margin: 0; font-size: 0.85rem; opacity: 0.8; }
        .timer { font-family: monospace; font-size: 1.5rem; color: hsl(var(--accent-orange)); font-weight: 700; }
        .participants-ring { position: relative; width: 340px; height: 340px; display: flex; align-items: center; justify-content: center; margin-top: auto; margin-bottom: auto; }
        .fire-pit { position: relative; width: 100px; height: 100px; display: flex; align-items: flex-end; justify-content: center; }
        
        .logs { position: absolute; bottom: 0; width: 100%; height: 40px; display: flex; justify-content: center; gap: 6px; z-index: 2; }
        .log { height: 16px; width: 60px; background: linear-gradient(to bottom, #5d4037, #3e2723); border-radius: 6px; border: 1px solid #2d1b18; box-shadow: inset 0 0 8px rgba(0,0,0,0.6), 0 2px 4px rgba(0,0,0,0.4); }
        .log:nth-child(1) { transform: rotate(-15deg) translateY(5px); }
        .log:nth-child(2) { transform: rotate(5deg) translateY(0); width: 65px; }
        .log:nth-child(3) { transform: rotate(20deg) translateY(8px); position: absolute; left: 15px; }

        .fire-core { 
          width: 60px; height: 75px; 
          background: radial-gradient(circle at 50% 10%, #fff 0%, #ffdf00 25%, #ff8c00 50%, #ff4500 100%); 
          border-radius: 50% 50% 35% 35%; 
          filter: blur(5px); 
          box-shadow: 0 0 15px #ff4500, 0 0 50px rgba(255,140,0,0.4), 0 -20px 40px rgba(255,223,0,0.3);
          animation: flicker 0.1s infinite alternate;
          position: relative;
          z-index: 3;
          bottom: 15px;
          transition: all 3s ease-out;
        }

        .fire-pit.dying .fire-core {
          width: 20px;
          height: 25px;
          background: radial-gradient(circle at 50% 30%, #ff8c00 0%, #ff4500 60%, #8b0000 100%);
          filter: blur(3px);
          box-shadow: 0 0 8px #ff4500, 0 0 20px rgba(255,69,0,0.2);
          animation: dying-flicker 0.3s infinite alternate;
          bottom: 5px;
        }

        .fire-pit.dying .spark {
          animation: float-spark 4s infinite ease-out;
          opacity: 0.3;
        }

        .fire-pit.dying .log {
          background: linear-gradient(to bottom, #3e2723, #1a0e0a);
          box-shadow: inset 0 0 8px rgba(255,69,0,0.3), 0 0 10px rgba(255,140,0,0.2);
        }

        @keyframes dying-flicker {
          0% { transform: scale(1) rotate(-2deg); filter: blur(3px) brightness(0.6); opacity: 0.8; }
          100% { transform: scale(0.9) rotate(2deg); filter: blur(4px) brightness(0.4); opacity: 0.6; }
        }

        .sparks { position: absolute; top: -100px; left: 0; width: 100%; height: 200px; pointer-events: none; z-index: 4; }
        .spark {
          position: absolute;
          bottom: 20px;
          height: 3px;
          background: #ffdf00;
          border-radius: 50%;
          opacity: 0;
          filter: blur(1px);
          box-shadow: 0 0 6px #ffdf00;
          animation: float-spark 2s infinite ease-out;
        }

        @keyframes float-spark {
          0% { transform: translateY(0) translateX(0) scale(1); opacity: 0; }
          10% { opacity: 1; }
          100% { transform: translateY(-120px) translateX(20px) scale(0); opacity: 0; }
        }

        @keyframes flicker {
          0% { transform: scale(1) rotate(-1deg) skewX(-2deg); filter: blur(6px) brightness(1); }
          100% { transform: scale(1.08) rotate(1deg) skewX(2deg); filter: blur(5px) brightness(1.3); }
        }

        .participant-node { position: absolute; display: flex; flex-direction: column; align-items: center; gap: 0.8rem; }
        .avatar { width: 65px; height: 65px; display: flex; align-items: center; justify-content: center; position: relative; transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        .cartoon-char { font-size: 3.2rem; filter: drop-shadow(0 0 8px rgba(0,0,0,0.6)); transition: transform 0.2s; }
        .avatar.speaking { transform: scale(1.3) translateY(-10px); z-index: 100; }
        .avatar.speaking .cartoon-char { filter: drop-shadow(0 0 15px hsla(var(--accent-orange), 0.9)); }
        .you-label, .peer-label { position: absolute; bottom: -1rem; font-size: 0.7rem; font-weight: 800; color: #fff; background: rgba(0,0,0,0.7); padding: 2px 10px; border-radius: 20px; white-space: nowrap; border: 1px solid rgba(255,255,255,0.15); box-shadow: 0 4px 10px rgba(0,0,0,0.3); }
        .audio-barrier { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.9); z-index: 1000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(20px); }
        .barrier-content { padding: 3rem; max-width: 400px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 1.5rem; border: 1px solid hsla(var(--accent-orange), 0.3); border-radius: 2rem; background: rgba(24,24,27,0.8); }
        .icon-large { font-size: 3rem; }
      ` }} />
    </div>
  );
};

export default Campfire;
