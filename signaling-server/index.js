const { Server } = require('socket.io');
const {
    createRoom,
    getRoom,
    getRoomBySocket,
    joinRoom,
    leaveRoom,
    transferHost,
    claimSeat,
    getAllRooms
} = require('./rooms.js');
const {
    flagParticipant,
    clearFlags,
    canMute
} = require('./moderation.js');

const ROOM_SIZE = 6;
const SESSION_DURATION_MS = 15 * 60 * 1000;

// Re-declaring events here to use standard JS, matching shared/events.ts
const EVENTS = {
    JOIN_QUEUE: 'JOIN_QUEUE',
    ROOM_UPDATE: 'ROOM_UPDATE',
    START_SESSION: 'START_SESSION',
    SIGNAL: 'SIGNAL',
    LEAVE_ROOM: 'LEAVE_ROOM',
    TOGGLE_READY: 'TOGGLE_READY',
    MUTE_PARTICIPANT: 'MUTE_PARTICIPANT',
    MAKE_MUTE: 'MAKE_MUTE',
    FLAG_PARTICIPANT: 'FLAG_PARTICIPANT',
    PARTICIPANT_REMOVED: 'PARTICIPANT_REMOVED',
    SESSION_ENDING: 'SESSION_ENDING',
    SESSION_DISSOLVED: 'SESSION_DISSOLVED',
    SEAT_CLAIMED: 'SEAT_CLAIMED',
    SEAT_UPDATE: 'SEAT_UPDATE',
    HOST_TRANSFERRED: 'HOST_TRANSFERRED',
};

const io = new Server(process.env.PORT || 3001, {
    cors: {
        origin: process.env.CORS_ORIGIN || '*',
    }
});

io.on('connection', (socket) => {

    socket.on(EVENTS.JOIN_QUEUE, ({ username }) => {
        let existingRoom = getRoomBySocket(socket.id);
        if (existingRoom) {
            leaveRoom(socket.id);
        }

        let targetRoom = null;
        for (const room of getAllRooms().values()) {
            if (room.seats.some(s => s.socketId === null)) {
                targetRoom = room;
                break;
            }
        }

        if (!targetRoom) {
            targetRoom = createRoom(Date.now().toString(), socket.id);
        }

        const joinResult = joinRoom(targetRoom.roomID, socket.id, username);
        if (!joinResult) {
            socket.emit('queue-full');
            return;
        }

        socket.join(targetRoom.roomID);
        io.to(targetRoom.roomID).emit(EVENTS.ROOM_UPDATE, { seats: targetRoom.seats, host: targetRoom.host });
    });

    socket.on(EVENTS.SEAT_CLAIMED, ({ seatIndex }) => {
        const room = getRoomBySocket(socket.id);
        if (!room) return;

        const success = claimSeat(room.roomID, socket.id, seatIndex);
        if (!success) {
            socket.emit('seat-taken');
        } else {
            io.to(room.roomID).emit(EVENTS.SEAT_UPDATE, { seats: room.seats });
        }
    });

    socket.on(EVENTS.TOGGLE_READY, (isReady) => {
        const room = getRoomBySocket(socket.id);
        if (!room) return;

        room.readyStates[socket.id] = isReady;

        const occupiedSeats = room.seats.filter(s => s.socketId !== null);
        const readyCount = occupiedSeats.filter(s => room.readyStates[s.socketId] === true).length;

        io.to(room.roomID).emit(EVENTS.ROOM_UPDATE, { seats: room.seats, host: room.host });

        if (occupiedSeats.length === ROOM_SIZE && readyCount === ROOM_SIZE) {
            io.to(room.roomID).emit(EVENTS.START_SESSION, {
                roomID: room.roomID,
                seats: room.seats,
                host: room.host,
                duration: SESSION_DURATION_MS
            });

            setTimeout(() => {
                io.to(room.roomID).emit(EVENTS.SESSION_ENDING, { remaining: 2 * 60 * 1000 });
            }, SESSION_DURATION_MS - 2 * 60 * 1000);

            setTimeout(() => {
                io.to(room.roomID).emit(EVENTS.SESSION_DISSOLVED);
                const currentRoom = getRoom(room.roomID);
                if (currentRoom) {
                    getAllRooms().delete(room.roomID);
                }
            }, SESSION_DURATION_MS);
        }
    });

    socket.on(EVENTS.SIGNAL, ({ to, signal }) => {
        io.to(to).emit(EVENTS.SIGNAL, { from: socket.id, signal });
    });

    socket.on(EVENTS.MUTE_PARTICIPANT, ({ roomID, targetId, muted }) => {
        if (!canMute(roomID, socket.id)) return;
        io.to(targetId).emit(EVENTS.MAKE_MUTE, { muted });
    });

    socket.on(EVENTS.FLAG_PARTICIPANT, ({ roomID, targetPeerID }) => {
        const { shouldKick } = flagParticipant(roomID, socket.id, targetPeerID);
        if (shouldKick) {
            io.to(targetPeerID).emit(EVENTS.SESSION_DISSOLVED);
            const leaveResult = leaveRoom(targetPeerID);
            clearFlags(roomID, targetPeerID);
            if (leaveResult) {
                io.to(roomID).emit(EVENTS.PARTICIPANT_REMOVED, {
                    socketId: targetPeerID,
                    seats: leaveResult.updatedRoom.seats
                });
            }
        }
    });

    socket.on(EVENTS.LEAVE_ROOM, () => {
        handleDisconnect();
    });

    socket.on('disconnect', () => {
        handleDisconnect();
    });

    function handleDisconnect() {
        const leaveResult = leaveRoom(socket.id);
        if (!leaveResult) return;

        const { roomID, updatedRoom } = leaveResult;
        const occupiedCount = updatedRoom.seats.filter(s => s.socketId !== null).length;
        if (occupiedCount === 0) return;

        io.to(roomID).emit(EVENTS.PARTICIPANT_REMOVED, {
            socketId: socket.id,
            seats: updatedRoom.seats
        });

        if (updatedRoom.host === socket.id) {
            const newHost = transferHost(roomID);
            if (newHost) {
                io.to(roomID).emit(EVENTS.HOST_TRANSFERRED, { newHost });
            }
        }
    }
});
