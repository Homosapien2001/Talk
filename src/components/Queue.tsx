import { useEffect, useState } from 'react';
import useAppStore from '../store/appStore';
import { EVENTS } from '../../shared/events';
import type { Seat } from '../../shared/types';
import './Queue.css';

export default function Queue() {
    const { socket, user } = useAppStore();
    const [seats, setSeats] = useState<Seat[]>([]);
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        if (!socket || !user) return;

        socket.emit(EVENTS.JOIN_QUEUE, { username: user.displayName });

        const handleRoomUpdate = (data: { seats: Seat[]; host: string }) => {
            setSeats(data.seats);
        };

        const handleSeatUpdate = (data: { seats: Seat[] }) => {
            setSeats(data.seats);
        };

        socket.on(EVENTS.ROOM_UPDATE, handleRoomUpdate);
        socket.on(EVENTS.SEAT_UPDATE, handleSeatUpdate);

        return () => {
            socket.off(EVENTS.ROOM_UPDATE, handleRoomUpdate);
            socket.off(EVENTS.SEAT_UPDATE, handleSeatUpdate);
        };
    }, [socket, user]);

    const handleToggleReady = () => {
        if (!socket) return;
        const newReady = !isReady;
        setIsReady(newReady);
        socket.emit(EVENTS.TOGGLE_READY, newReady);
    };

    const occupiedCount = seats.filter(s => s.socketId !== null).length;

    return (
        <div className="queue-container">
            <h2>Finding your campfire...</h2>
            <div className="seats-grid">
                {seats.length > 0 ? seats.map((seat, idx) => {
                    if (!seat.socketId) {
                        return <div key={idx} className="seat empty"></div>;
                    }
                    const isMe = socket && seat.socketId === socket.id;
                    return (
                        <div key={idx} className="seat occupied">
                            {isMe ? '(You)' : seat.username}
                        </div>
                    );
                }) : Array.from({ length: 6 }).map((_, idx) => (
                    <div key={idx} className="seat empty"></div>
                ))}
            </div>
            <button className={`ready-button ${isReady ? 'ready' : ''}`} onClick={handleToggleReady}>
                {isReady ? "I'm ready" : "Ready Up"}
            </button>
            <p className="hint-text">
                Filled: {occupiedCount} / 6
            </p>
        </div>
    );
}
