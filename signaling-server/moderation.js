const { getRoom } = require('./rooms.js');

const ROOM_SIZE = 6;

function flagParticipant(roomID, reporterSocketId, targetSocketId) {
    const room = getRoom(roomID);
    if (!room) return { flagCount: 0, threshold: 0, shouldKick: false };

    if (!room.flags) {
        room.flags = {};
    }
    if (!room.flags[targetSocketId]) {
        room.flags[targetSocketId] = new Set();
    }

    room.flags[targetSocketId].add(reporterSocketId);

    const flagCount = room.flags[targetSocketId].size;
    const threshold = Math.max(2, Math.floor(ROOM_SIZE / 2) + 1);
    const shouldKick = flagCount >= threshold;

    return { flagCount, threshold, shouldKick };
}

function clearFlags(roomID, targetSocketId) {
    const room = getRoom(roomID);
    if (room && room.flags) {
        delete room.flags[targetSocketId];
    }
}

function canMute(roomID, requesterSocketId) {
    const room = getRoom(roomID);
    if (!room) return false;
    return room.host === requesterSocketId;
}

module.exports = {
    flagParticipant,
    clearFlags,
    canMute
};
