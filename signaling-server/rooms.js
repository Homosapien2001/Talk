const ROOM_SIZE = 6;
const rooms = new Map();

function createRoom(roomID, hostSocketId) {
    const seats = Array.from({ length: ROOM_SIZE }, (_, seatIndex) => ({
        seatIndex,
        socketId: null,
        username: null
    }));

    const room = {
        roomID,
        host: hostSocketId,
        seats,
        readyStates: {},
        flags: {}
    };

    rooms.set(roomID, room);
    return room;
}

function getRoom(roomID) {
    return rooms.get(roomID);
}

function getRoomBySocket(socketId) {
    for (const room of rooms.values()) {
        if (room.seats.some(seat => seat.socketId === socketId)) {
            return room;
        }
    }
    return undefined;
}

function joinRoom(roomID, socketId, username) {
    const room = getRoom(roomID);
    if (!room) return null;

    const emptySeat = room.seats.find(seat => seat.socketId === null);
    if (!emptySeat) return null;

    emptySeat.socketId = socketId;
    emptySeat.username = username;

    return { room, seatIndex: emptySeat.seatIndex };
}

function leaveRoom(socketId) {
    const room = getRoomBySocket(socketId);
    if (!room) return null;

    const seat = room.seats.find(s => s.socketId === socketId);
    if (seat) {
        seat.socketId = null;
        seat.username = null;
    }

    const occupiedCount = room.seats.filter(s => s.socketId !== null).length;
    if (occupiedCount === 0) {
        rooms.delete(room.roomID);
    }

    return { roomID: room.roomID, updatedRoom: room };
}

function transferHost(roomID) {
    const room = getRoom(roomID);
    if (!room) return null;

    const newHostSeat = room.seats.find(s => s.socketId !== null && s.socketId !== room.host);
    if (newHostSeat) {
        room.host = newHostSeat.socketId;
        return room.host;
    }
    return null;
}

function claimSeat(roomID, socketId, seatIndex) {
    const room = getRoom(roomID);
    if (!room) return false;

    const targetSeat = room.seats.find(s => s.seatIndex === seatIndex);
    if (!targetSeat || targetSeat.socketId !== null) {
        return false;
    }

    const currentSeat = room.seats.find(s => s.socketId === socketId);
    if (currentSeat) {
        const currentUsername = currentSeat.username;
        currentSeat.socketId = null;
        currentSeat.username = null;

        targetSeat.socketId = socketId;
        targetSeat.username = currentUsername;
        return true;
    }

    return false;
}

function getAllRooms() {
    return rooms;
}

module.exports = {
    createRoom,
    getRoom,
    getRoomBySocket,
    joinRoom,
    leaveRoom,
    transferHost,
    claimSeat,
    getAllRooms
};
