export interface Seat {
    seatIndex: number;
    socketId: string | null;
    username: string | null;
}

export interface RoomState {
    roomID: string;
    seats: Seat[];
    host: string;
    duration: number;
}

export interface SessionData {
    roomID: string;
    seats: Seat[];
    host: string;
    duration: number;
}

export type Role = 'moderator' | 'camper';

export type PeerMap = Record<string, { username: string; seatIndex: number; volume: number }>;

export const ROOM_SIZE = 6;
export const SESSION_DURATION_MS = 15 * 60 * 1000;
