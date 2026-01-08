const { Server } = require("socket.io");
const http = require("http");

const server = http.createServer();
const io = new Server(server, {
    cors: {
        origin: process.env.CORS_ORIGIN || "*",
        methods: ["GET", "POST"]
    }
});

const ROOM_SIZE = 2;
let rooms = {}; // roomID -> { participants: [], readyStates: {} }

io.on("connection", (socket) => {
    console.log("User connected:", socket.id);
    let currentRoomID = null;

    const leaveRoom = (id) => {
        const targetRoomID = id || currentRoomID;
        if (!targetRoomID) return;

        if (rooms[targetRoomID]) {
            rooms[targetRoomID].participants = rooms[targetRoomID].participants.filter(pid => pid !== socket.id);
            delete rooms[targetRoomID].readyStates[socket.id];

            if (rooms[targetRoomID].participants.length === 0) {
                console.log(`Room ${targetRoomID} is empty, cleaning up.`);
                delete rooms[targetRoomID];
            } else {
                io.to(targetRoomID).emit("room-update", {
                    participants: rooms[targetRoomID].participants.length,
                    readyCount: Object.values(rooms[targetRoomID].readyStates).filter(r => r).length
                });

                // Also notify campfire peers
                io.to(targetRoomID).emit("participant-removed", {
                    peerId: socket.id,
                    newPeers: rooms[targetRoomID].participants
                });
            }
        }
        socket.leave(targetRoomID);
        if (targetRoomID === currentRoomID) currentRoomID = null;
    };

    socket.on("join-queue", () => {
        // Cleanup: Ensure user isn't already in a room
        if (currentRoomID) {
            console.log(`Socket ${socket.id} leaving previous room ${currentRoomID}`);
            leaveRoom(currentRoomID);
        }

        let roomID = null;
        for (const id in rooms) {
            if (rooms[id].participants.length < ROOM_SIZE && !rooms[id].participants.includes(socket.id)) {
                roomID = id;
                break;
            }
        }

        if (!roomID) {
            roomID = `room_${Date.now()}`;
            rooms[roomID] = { participants: [], readyStates: {}, flags: {} };
            console.log(`Created new room: ${roomID}`);
        }

        currentRoomID = roomID;
        socket.join(roomID);
        if (!rooms[roomID].participants.includes(socket.id)) {
            rooms[roomID].participants.push(socket.id);
        }
        rooms[roomID].readyStates[socket.id] = false;

        console.log(`Socket ${socket.id} joined ${roomID}. Participants: ${rooms[roomID].participants.length}/${ROOM_SIZE}`);

        io.to(roomID).emit("room-update", {
            participants: rooms[roomID].participants.length,
            readyCount: Object.values(rooms[roomID].readyStates).filter(r => r).length
        });
    });

    socket.on("toggle-ready", (isReady) => {
        if (currentRoomID && rooms[currentRoomID]) {
            rooms[currentRoomID].readyStates[socket.id] = isReady;

            const currentReadyCount = Object.values(rooms[currentRoomID].readyStates).filter(r => r).length;

            console.log(`Room ${currentRoomID}: ${currentReadyCount}/${rooms[currentRoomID].participants.length} users ready`);

            io.to(currentRoomID).emit("room-update", {
                participants: rooms[currentRoomID].participants.length,
                readyCount: currentReadyCount
            });

            // Trigger session start if everyone is ready and room is full
            if (rooms[currentRoomID].participants.length === ROOM_SIZE && currentReadyCount === ROOM_SIZE) {
                console.log(`Room ${currentRoomID}: Everyone ready. Starting session.`);
                const sessionDuration = 15 * 60 * 1000; // 15 minutes

                io.to(currentRoomID).emit("start-session", {
                    roomID: currentRoomID,
                    peers: rooms[currentRoomID].participants,
                    duration: sessionDuration
                });

                // Session lifecycle timers
                setTimeout(() => {
                    io.to(currentRoomID).emit("session-ending", { remaining: 2 * 60 * 1000 });
                }, sessionDuration - 2 * 60 * 1000);

                setTimeout(() => {
                    io.to(currentRoomID).emit("session-dissolved");
                    // Cleanup room
                    if (rooms[currentRoomID]) {
                        delete rooms[currentRoomID];
                    }
                }, sessionDuration);
            }
        }
    });

    socket.on("flag-participant", (targetId) => {
        if (currentRoomID && rooms[currentRoomID] && rooms[currentRoomID].flags) {
            if (!rooms[currentRoomID].flags[targetId]) {
                rooms[currentRoomID].flags[targetId] = new Set();
            }
            rooms[currentRoomID].flags[targetId].add(socket.id);

            const flagCount = rooms[currentRoomID].flags[targetId].size;
            const threshold = Math.max(2, Math.floor(ROOM_SIZE / 2) + 1); // Logic: Simple majority or at least 2

            if (flagCount >= threshold) {
                // Silent Kick
                console.log(`Kicking participant ${targetId} from ${currentRoomID} due to flags (${flagCount}/${threshold})`);

                const targetSocket = io.sockets.sockets.get(targetId);
                if (targetSocket) {
                    targetSocket.emit("session-dissolved"); // Send them back to lobby
                }

                // Logic to remove them from room
                if (rooms[currentRoomID]) {
                    rooms[currentRoomID].participants = rooms[currentRoomID].participants.filter(id => id !== targetId);
                    delete rooms[currentRoomID].readyStates[targetId];
                    delete rooms[currentRoomID].flags[targetId];

                    io.to(currentRoomID).emit("participant-removed", {
                        peerId: targetId,
                        newPeers: rooms[currentRoomID].participants
                    });
                }
            }
        }
    });

    // WebRTC Signaling Relay
    socket.on("signal", (data) => {
        io.to(data.to).emit("signal", {
            from: socket.id,
            signal: data.signal
        });
    });

    socket.on("leave-room", () => leaveRoom());

    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
        leaveRoom();
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Signaling server running on port ${PORT}`);
});
