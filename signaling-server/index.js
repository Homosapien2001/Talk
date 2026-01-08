const { Server } = require("socket.io");
const http = require("http");

const server = http.createServer();
const io = new Server(server, {
    cors: {
        origin: process.env.CORS_ORIGIN || "*",
        methods: ["GET", "POST"]
    }
});

const ROOM_SIZE = 8;
let rooms = {}; // roomID -> { participants: [], readyStates: {} }

io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("join-queue", () => {
        let roomID = null;

        // Find a room with space
        for (const id in rooms) {
            if (rooms[id].participants.length < ROOM_SIZE) {
                roomID = id;
                break;
            }
        }

        // Create a new room if none found
        if (!roomID) {
            roomID = `room_${Date.now()}`;
            rooms[roomID] = { participants: [], readyStates: {} };
        }

        socket.join(roomID);
        rooms[roomID].participants.push(socket.id);
        rooms[roomID].readyStates[socket.id] = false;

        console.log(`Socket ${socket.id} joined ${roomID}`);

        io.to(roomID).emit("room-update", {
            participants: rooms[roomID].participants.length,
            readyCount: Object.values(rooms[roomID].readyStates).filter(r => r).length
        });

        socket.on("toggle-ready", (isReady) => {
            if (rooms[roomID]) {
                rooms[roomID].readyStates[socket.id] = isReady;

                const currentReadyCount = Object.values(rooms[roomID].readyStates).filter(r => r).length;

                io.to(roomID).emit("room-update", {
                    participants: rooms[roomID].participants.length,
                    readyCount: currentReadyCount
                });

                // Trigger session start if everyone is ready and room is full
                if (rooms[roomID].participants.length === ROOM_SIZE && currentReadyCount === ROOM_SIZE) {
                    const sessionDuration = 15 * 60 * 1000; // 15 minutes
                    rooms[roomID].flags = {}; // Initialize flags when session starts

                    io.to(roomID).emit("start-session", {
                        roomID: roomID,
                        peers: rooms[roomID].participants,
                        duration: sessionDuration
                    });

                    // Session lifecycle timers
                    setTimeout(() => {
                        io.to(roomID).emit("session-ending", { remaining: 2 * 60 * 1000 });
                    }, sessionDuration - 2 * 60 * 1000);

                    setTimeout(() => {
                        io.to(roomID).emit("session-dissolved");
                        // Cleanup room
                        if (rooms[roomID]) {
                            delete rooms[roomID];
                        }
                    }, sessionDuration);
                }
            }
        });

        socket.on("flag-participant", (targetId) => {
            if (rooms[roomID] && rooms[roomID].flags) {
                if (!rooms[roomID].flags[targetId]) {
                    rooms[roomID].flags[targetId] = new Set();
                }
                rooms[roomID].flags[targetId].add(socket.id);

                const flagCount = rooms[roomID].flags[targetId].size;
                const threshold = 3; // Requirement: Three flags = quiet removal

                if (flagCount >= threshold) {
                    // Silent Kick
                    console.log(`Kicking participant ${targetId} from ${roomID} due to flags`);

                    const targetSocket = io.sockets.sockets.get(targetId);
                    if (targetSocket) {
                        targetSocket.emit("session-dissolved"); // Send them back to lobby
                        targetSocket.leave(roomID);
                    }

                    rooms[roomID].participants = rooms[roomID].participants.filter(id => id !== targetId);
                    delete rooms[roomID].readyStates[targetId];
                    delete rooms[roomID].flags[targetId];

                    io.to(roomID).emit("participant-removed", {
                        peerId: targetId,
                        newPeers: rooms[roomID].participants
                    });
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

        const leaveRoom = () => {
            if (rooms[roomID]) {
                rooms[roomID].participants = rooms[roomID].participants.filter(id => id !== socket.id);
                delete rooms[roomID].readyStates[socket.id];

                if (rooms[roomID].participants.length === 0) {
                    delete rooms[roomID];
                } else {
                    io.to(roomID).emit("room-update", {
                        participants: rooms[roomID].participants.length,
                        readyCount: Object.values(rooms[roomID].readyStates).filter(r => r).length
                    });

                    // Also notify campfire peers
                    io.to(roomID).emit("participant-removed", {
                        peerId: socket.id,
                        newPeers: rooms[roomID].participants
                    });
                }
            }
            socket.leave(roomID);
        };

        socket.on("leave-room", leaveRoom);

        socket.on("disconnect", () => {
            console.log("User disconnected:", socket.id);
            leaveRoom();
        });
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Signaling server running on port ${PORT}`);
});
