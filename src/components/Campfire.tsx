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
            <div className={`fire-core pulse ${isEnding ? 'dying' : ''}`}></div>
            {sortedPeers.map((peerId, i) => {
              const isMe = peerId === socket.id;
              const displayIndex = (i - myIndex + sortedPeers.length) % sortedPeers.length;
              const volume = speakingPeers[peerId] || 0;
              const isSpeaking = volume > 8;

              return (
                <div key={peerId} className="participant-node" style={{ transform: `rotate(${displayIndex * (360 / sortedPeers.length)}deg) translateY(-140px) rotate(-${displayIndex * (360 / sortedPeers.length)}deg)` }}>
                  <div className={`avatar glass ${isSpeaking ? 'speaking' : ''}`}>
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
        .fire-core { width: 80px; height: 80px; background: radial-gradient(circle at center, #ff8c00 0%, #ff4500 100%); border-radius: 50%; filter: blur(15px); box-shadow: 0 0 40px #ff4500; }
        .participant-node { position: absolute; display: flex; flex-direction: column; align-items: center; gap: 0.8rem; }
        .avatar { width: 65px; height: 65px; border-radius: 50%; border: 2px solid hsla(var(--foreground), 0.1); background: rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: center; position: relative; }
        .cartoon-char { font-size: 2.2rem; }
        .avatar.speaking { border-color: hsl(var(--accent-orange)); box-shadow: 0 0 30px hsla(var(--accent-orange), 0.6); transform: scale(1.1); transition: all 0.2s ease; }
        .you-label, .peer-label { position: absolute; top: -1.4rem; font-size: 0.75rem; font-weight: 600; color: hsla(var(--foreground), 0.8); background: rgba(0,0,0,0.4); padding: 2px 8px; border-radius: 10px; }
        .audio-barrier { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.9); z-index: 1000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(20px); }
        .barrier-content { padding: 3rem; max-width: 400px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 1.5rem; border: 1px solid hsla(var(--accent-orange), 0.3); border-radius: 2rem; background: rgba(24,24,27,0.8); }
        .icon-large { font-size: 3rem; }
      ` }} />
    </div>
  );
};

export default Campfire;
