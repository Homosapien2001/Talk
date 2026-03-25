import { create } from 'zustand';
import type { SessionData, PeerMap } from '../../shared/types';
import { Socket } from 'socket.io-client';

interface AppState {
    view: 'auth' | 'lobby' | 'queue' | 'walkin' | 'session' | 'post';
    socket: Socket | null;
    user: { uid: string; displayName: string; email: string } | null;
    session: SessionData | null;
    mySeatIndex: number | null;
    peers: PeerMap;
    activeSpeakerId: string | null;
    isMuted: boolean;
    isMutedByHost: boolean;
    setView: (view: 'auth' | 'lobby' | 'queue' | 'walkin' | 'session' | 'post') => void;
    setSocket: (socket: Socket | null) => void;
    setUser: (user: { uid: string; displayName: string; email: string } | null) => void;
    setSession: (session: SessionData | null) => void;
    setMySeatIndex: (index: number | null) => void;
    setPeers: (peers: PeerMap) => void;
    setActiveSpeaker: (socketId: string | null) => void;
    setMuted: (val: boolean) => void;
    setMutedByHost: (val: boolean) => void;
    reset: () => void;
}

const useAppStore = create<AppState>((set) => ({
    view: 'lobby',
    socket: null,
    user: null,
    session: null,
    mySeatIndex: null,
    peers: {},
    activeSpeakerId: null,
    isMuted: false,
    isMutedByHost: false,
    setView: (view) => set({ view }),
    setSocket: (socket) => set({ socket }),
    setUser: (user) => set({ user }),
    setSession: (session) => set({ session }),
    setMySeatIndex: (mySeatIndex) => set({ mySeatIndex }),
    setPeers: (peers) => set({ peers }),
    setActiveSpeaker: (activeSpeakerId) => set({ activeSpeakerId }),
    setMuted: (isMuted) => set({ isMuted }),
    setMutedByHost: (isMutedByHost) => set({ isMutedByHost }),
    reset: () => set({
        view: 'lobby',
        session: null,
        mySeatIndex: null,
        peers: {},
        activeSpeakerId: null
    })
}));

export default useAppStore;
