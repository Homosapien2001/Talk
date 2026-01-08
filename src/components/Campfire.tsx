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

const Campfire: React.FC<CampfireProps> = ({ socket, sessionData, onLeave }) => {
  const [currentPeers, setCurrentPeers] = useState(sessionData.peers);
  const sortedPeers = [...currentPeers].sort();

  const myIndex = sortedPeers.indexOf(socket.id || '');
  const roleIndex = myIndex >= 0 ? myIndex % ROLES.length : 0;
  const role = ROLES[roleIndex];

  const [joined, setJoined] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [debugStatus, setDebugStatus] = useState('Waiting to join...');
  const [flagged, setFlagged] = useState<string[]>([]);
  const [speakingPeers, setSpeakingPeers] = useState<{ [key: string]: number }>({});
  const [timeLeft, setTimeLeft] = useState(sessionData.duration);
  const [isEnding, setIsEnding] = useState(false);

  const peersRef = useRef<{ [key: string]: any }>({});
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const updateDebug = () => {
      const ctx = audioContextRef.current;
      const tracks = localStreamRef.current?.getAudioTracks() || [];
      const trackStatuses = tracks.map(t => `${t.label}: ${t.enabled ? 'ON' : 'OFF'} (${t.readyState})`).join(', ');
      setDebugStatus(`Ctx: ${ctx?.state || 'N/A'} | Joined: ${joined} | Peers: ${currentPeers.length} | Tracks: ${trackStatuses}`);
    };
    const interval = setInterval(updateDebug, 1000);
    return () => clearInterval(interval);
  }, [joined, currentPeers]);

  const playTestTone = () => {
    if (!audioContextRef.current) return;
    const ctx = audioContextRef.current;
    if (ctx.state === 'suspended') ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
    console.log('[CAMPFIRE] Test tone played');
  };

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
        gainNode.gain.value = 2.5;
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
      <div className="debug-overlay" style={{ position: 'fixed', top: 10, left: 10, fontSize: '10px', color: '#fff', opacity: 0.7, zIndex: 2000, background: 'rgba(0,0,0,0.5)', padding: '2px 5px', borderRadius: '4px' }}>
        {debugStatus}
      </div>

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
            <button className="btn btn-ghost" onClick={playTestTone} style={{ marginRight: '1rem', fontSize: '0.7rem' }}>
              🔊 Test Speakers
            </button>
            <button className="btn btn-ghost" onClick={onLeave}>Leave Softly</button>
          </div>
        </>
      )}

      <style dangerouslySetInnerHTML={{
        __html: `
        .campfire-view { position: relative; height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: hidden; background: radial-gradient(circle at center, #1a0a05 0%, #050505 100%); }
        .top-bar { position: absolute; top: 2rem; left: 0; right: 0; display: flex; justify-content: space-between; padding: 0 2rem; z-index: 10; }
        .session-info, .timer-container { padding: 1rem 1.5rem; border-radius: 1.5rem; background: rgba(255,255,255,0.05); backdrop-filter: blur(10px); }
        .role-card .label { font-size: 0.7rem; color: hsla(var(--accent-orange), 0.7); font-weight: 700; margin-bottom: 0.2rem; display: block; }
        .role-card h3 { margin: 0; color: hsl(var(--accent-orange)); font-size: 1.2rem; }
        .timer { font-family: monospace; font-size: 1.5rem; color: hsl(var(--accent-orange)); }
        .participants-ring { position: relative; width: 300px; height: 300px; display: flex; align-items: center; justify-content: center; }
        .fire-core { width: 60px; height: 60px; background: radial-gradient(circle at center, #ff8c00 0%, #ff4500 100%); border-radius: 50%; filter: blur(10px); }
        .participant-node { position: absolute; display: flex; flex-direction: column; align-items: center; gap: 0.5rem; }
        .avatar { width: 50px; height: 50px; border-radius: 50%; border: 2px solid hsla(var(--foreground), 0.1); background: rgba(255,255,255,0.05); }
        .avatar.speaking { border-color: hsl(var(--accent-orange)); box-shadow: 0 0 20px hsla(var(--accent-orange), 0.5); }
        .you-label, .peer-label { position: absolute; top: -1.2rem; font-size: 0.7rem; color: hsla(var(--foreground), 0.5); }
        .audio-barrier { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.9); z-index: 1000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(20px); }
        .barrier-content { padding: 3rem; max-width: 400px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 1.5rem; border: 1px solid hsla(var(--accent-orange), 0.3); border-radius: 2rem; background: rgba(24,24,27,0.8); }
        .icon-large { font-size: 3rem; }
      ` }} />
    </div>
  );
};

export default Campfire;
