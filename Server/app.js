import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

const app = express();
const SOCKET_PORT = 3000;

const rooms = {};
let gameRoomId="";

const server = createServer(app);
const io = new Server(server, { cors: { origin: "*", credentials: true } });

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join-room", ({ roomId, role, name }) => {
    console.log(`Attempting to join room ${roomId} as ${role} (${name || 'unnamed'})`);
    
    if (!rooms[roomId]) {
      console.log(`Creating new room: ${roomId}`);
      rooms[roomId] = { 
        interviewer: null, 
        interviewee: null,
        interviewerName: null,
        intervieweeName: null,
        pasteAllowed: false, // Disable paste by default
        whiteboardActions: [] // Store whiteboard actions
      };
    }

    // Leave any existing rooms this socket is part of
    Object.keys(rooms).forEach((existingRoom) => {
      if (rooms[existingRoom].interviewer === socket.id || rooms[existingRoom].interviewee === socket.id) {
        if (rooms[existingRoom].interviewer === socket.id) {
          console.log(`User ${socket.id} leaving room ${existingRoom} as interviewer`);
          rooms[existingRoom].interviewer = null;
          rooms[existingRoom].interviewerName = null;
        }
        if (rooms[existingRoom].interviewee === socket.id) {
          console.log(`User ${socket.id} leaving room ${existingRoom} as interviewee`);
          rooms[existingRoom].interviewee = null;
          rooms[existingRoom].intervieweeName = null;
        }
        socket.leave(existingRoom);
      }
    });

    if (role === "Interviewer") {
      if (rooms[roomId].interviewer) {
        console.log(`Room ${roomId} already has an interviewer`);
        socket.emit("room-error", "Interviewer is already in the room.");
        return;
      }
      console.log(`Setting ${socket.id} as interviewer in room ${roomId}`);
      rooms[roomId].interviewer = socket.id;
      rooms[roomId].interviewerName = name || 'Interviewer';
    } else if (role === "Interviewee") {
      if (!rooms[roomId].interviewer) {
        console.log(`No interviewer in room ${roomId}, rejecting interviewee ${socket.id}`);
        socket.emit("room-error", "Interviewer is not present, wait!");
        return;
      }
      if (rooms[roomId].interviewee) {
        console.log(`Room ${roomId} already has an interviewee`);
        socket.emit("room-error", "Interviewee is already in the room.");
        return;
      }
      console.log(`Setting ${socket.id} as interviewee in room ${roomId}`);
      socket.broadcast.to(roomId).emit("user:joined",{id:socket.id});//for starting webrtc connection
      rooms[roomId].interviewee = socket.id;
      rooms[roomId].intervieweeName = name || 'Interviewee';
      
      // Send current paste restriction settings to the interviewee (always disabled)
      socket.emit("toggle-paste-restriction", { allow: false });
      console.log(`[Server] Sending initial paste setting to interviewee: blocked`);
    }

    socket.data.roomId = roomId;
    socket.data.role = role;
    socket.data.name = name || role;
    socket.join(roomId);
    
    // Send room-joined event with additional data
    socket.emit("room-joined", { 
      roomId,
      role,
      roomInfo: {
        hasInterviewer: !!rooms[roomId].interviewer,
        hasInterviewee: !!rooms[roomId].interviewee
      }
    });
    
    console.log(`${role} (${name || 'unnamed'}) joined room ${roomId} successfully`);
    
    // Log the current state of the room
    console.log(`Room ${roomId} state:`, {
      interviewer: rooms[roomId].interviewer,
      interviewee: rooms[roomId].interviewee,
      interviewerName: rooms[roomId].interviewerName,
      intervieweeName: rooms[roomId].intervieweeName
  });
  });

  // webrtc implementations
  socket.on("user:call", ({ to, offer }) => {
    console.log(`WebRTC: ${socket.id} is calling ${to}`);
    io.to(to).emit("incoming:call", { from: socket.id, offer });
  });

  socket.on("call:accepted", ({ to, ans }) => {
    console.log(`WebRTC: ${socket.id} accepted call from ${to}`);
    io.to(to).emit("call:accepted", { from: socket.id, ans });
  });

  // Track which users have been notified about each other to prevent duplicate notifications
  const notifiedPairs = new Map();

  // Helper function to check if a notification has been sent between two users
  const hasBeenNotified = (user1, user2) => {
    const pairKey = [user1, user2].sort().join('_');
    return notifiedPairs.has(pairKey);
  };

  // Helper function to mark a pair as notified
  const markAsNotified = (user1, user2) => {
    const pairKey = [user1, user2].sort().join('_');
    notifiedPairs.set(pairKey, true);
    
    // Remove the notification record after 2 minutes to allow reconnection
    setTimeout(() => {
      notifiedPairs.delete(pairKey);
    }, 2 * 60 * 1000);
  };

  // Handle interviewer ready notification
  socket.on("interviewer:ready", ({ roomId }) => {
    console.log(`Interviewer ${socket.id} is ready in room ${roomId}`);
    
    // Find the interviewee in this room
    if (rooms[roomId] && rooms[roomId].interviewee) {
      const intervieweeId = rooms[roomId].interviewee;
      
      // Check if we've already notified this pair
      if (hasBeenNotified(socket.id, intervieweeId)) {
        console.log(`Already notified ${socket.id} and ${intervieweeId} about each other`);
        return;
      }
      
      console.log(`Found interviewee ${intervieweeId} - notifying about interviewer ${socket.id}`);
      
      // Notify the interviewee that an interviewer is ready to connect
      io.to(intervieweeId).emit("user:joined", { id: socket.id });
      
      // Also notify interviewer about interviewee for bidirectional connection
      socket.emit("user:joined", { id: intervieweeId });
      
      // Mark this pair as notified
      markAsNotified(socket.id, intervieweeId);
    } else {
      console.log(`No interviewee found in room ${roomId} for interviewer ${socket.id}`);
    }
  });

  // Handle interviewee ready notification to facilitate connection
  socket.on("interviewee:ready", ({ roomId }) => {
    console.log(`Interviewee ${socket.id} is ready in room ${roomId}`);
    
    // Find the interviewer in this room
    if (rooms[roomId] && rooms[roomId].interviewer) {
      const interviewerId = rooms[roomId].interviewer;
      
      // Check if we've already notified this pair
      if (hasBeenNotified(socket.id, interviewerId)) {
        console.log(`Already notified ${socket.id} and ${interviewerId} about each other`);
        return;
      }
      
      console.log(`Found interviewer ${interviewerId} - notifying about interviewee ${socket.id}`);
      
      // Notify the interviewer that an interviewee is ready to connect
      io.to(interviewerId).emit("user:joined", { id: socket.id });
      
      // Also notify interviewee about interviewer
      socket.emit("user:joined", { id: interviewerId });
      
      // Mark this pair as notified
      markAsNotified(socket.id, interviewerId);
    } else {
      console.log(`No interviewer found in room ${roomId} for interviewee ${socket.id}`);
      // Send an error to the interviewee
      socket.emit("room-error", "Cannot connect: No interviewer found in this room.");
    }
  });

  socket.on("peer:nego:needed", ({ to, offer }) => {
    console.log(`WebRTC negotiation: ${socket.id} -> ${to}`);
    io.to(to).emit("peer:nego:needed", { from: socket.id, offer });
  });

  socket.on("peer:nego:done", ({ to, ans }) => {
    console.log(`WebRTC negotiation done: ${socket.id} -> ${to}`);
    io.to(to).emit("peer:nego:final", { from: socket.id, ans });
  });

  socket.on("initiate:send:streams",({to})=>{{
    console.log(`WebRTC stream request: ${socket.id} -> ${to}`);
    io.to(to).emit("send:streams", { from: socket.id});
  }})

  socket.on("call:ended", ({ to }) => {
    console.log(`WebRTC call ended: ${socket.id} -> ${to}`);
    io.to(to).emit("endCall");
  });

  socket.on('update-code', ({ newCode, roomId }) => {
        socket.broadcast.to(roomId).emit('send-code', newCode);
    });

    // Handle language selection updates
    socket.on("update-language", ({ language, roomId }) => {
      socket.broadcast.to(roomId).emit("send-language", language);
    });

    // Handle messaging in the interview room
    socket.on("send-message", ({ message, roomId, senderUserName }) => {
        const fullMessage = { text: message.text, sender: socket.id, senderUserName };
        socket.broadcast.to(roomId).emit("receive-message", fullMessage);
    });

    // Handle interviewer sending a question with test cases
    socket.on("send-question", ({ question, testCases, roomId }) => {
        console.log(`Question sent in room ${roomId}:`, question);
        io.to(roomId).emit("receive-question", { question, testCases });
    });

    // Handle interviewer deleting a question
    socket.on("delete-question", ({ roomId }) => {
        console.log(`Question deleted in room ${roomId}`);
        io.to(roomId).emit("receive-delete-question");
    });

    socket.on("send-output",({testCases,roomId})=>{
        console.log(`Updating output in ${roomId}`);
        socket.broadcast.to(roomId).emit("update-output",testCases);
    });


  // Game Mode: Join room
  socket.on("join-game-room", ({ roomId }) => {
    socket.join(roomId);
    // socket.data.gameRoomId = roomId;
    // console.log(`(GameMode) ${socket.id} joined room ${roomId}`);
    socket.broadcast.to(roomId).emit("user:joined",{id:socket.id});//for  starting webrtc connection
    
  });

  // Game Mode: Player updates their code
  socket.on("update-player-code", ({ code, roomId }) => {
    socket.to(roomId).emit("receive-opponent-code", { code });
  });

  // Game Mode: Run code and return output to sender
  socket.on("update-output", ({ output, roomId }) => {
    // Replace with your actual Judge0 or code runner integration
    
    socket.to(roomId).emit("receive-run-output", { output });
  });

  // Game Mode: Send input/output to opponent
  socket.on("update-player-input", ({ input, roomId }) => {
    socket.to(roomId).emit("opponent-input", { input });
  });

  // Game Mode: Send question to opponent
  socket.on("send-question-game", ({ question, roomId }) => {
    console.log(`(GameMode) Question sent in room ${roomId}: ${question}`);
    socket.to(roomId).emit("receive-question-game", { question });
  });
  

  // Game Mode: Leave Room
  socket.on("leave-game-room", ({ roomId }) => {
    console.log(`(GameMode) ${socket.id} left room ${roomId}`);
    socket.leave(roomId);
    socket.to(roomId).emit("opponent-left");
  });

  socket.on("start-timer", ({ roomId, timeLeft }) => {
    socket.to(roomId).emit("start-timer", { timeLeft });
  });

  socket.on("stop-timer", ({ roomId }) => {
    socket.to(roomId).emit("stop-timer");
  });
  
  socket.on("reset-timer", ({ roomId }) => {
    socket.to(roomId).emit("reset-timer");
  });

  socket.on("clear-question", ({ roomId })=>{
    socket.to(roomId).emit("clear-question");
  });
  
  // Handle toggle paste restriction
  socket.on("toggle-paste-restriction", ({ roomId, allow }) => {
    console.log(`[Server] Paste restriction in room ${roomId} set to: ${allow ? 'allowed' : 'blocked'}`);
    
    // Validate parameters
    if (roomId === undefined) {
      console.error('[Server] Missing roomId in toggle-paste-restriction event');
      return;
    }
    
    if (allow === undefined) {
      console.error('[Server] Missing allow parameter in toggle-paste-restriction event');
      return;
    }
    
    // Store the setting in the room object for future joiners
    if (rooms[roomId]) {
      rooms[roomId].pasteAllowed = allow;
      console.log(`[Server] Updated room ${roomId} paste setting to ${allow ? 'allowed' : 'blocked'}`);
    } else {
      console.error(`[Server] Room ${roomId} not found, cannot update paste setting`);
    }
    
    try {
      // Find the interviewee in this room to send the toggle to
      if (rooms[roomId] && rooms[roomId].interviewee) {
        const intervieweeId = rooms[roomId].interviewee;
        console.log(`[Server] Sending paste restriction toggle to interviewee ${intervieweeId} in room ${roomId}`);
        
        // Send toggle directly to the interviewee
        io.to(intervieweeId).emit("toggle-paste-restriction", { allow });
        
        // Confirm to sender
        socket.emit("paste-restriction-update", { 
          success: true, 
          allow: allow, 
          message: `Paste ${allow ? 'allowed' : 'blocked'} for interviewee`
        });
        
        // Also broadcast to everyone in the room for consistency
        io.to(roomId).emit("paste-restriction-broadcast", {
          allow: allow,
          setBy: socket.id,
          timestamp: new Date().toISOString()
        });
      } else {
        console.warn(`[Server] No interviewee found in room ${roomId} for paste restriction toggle`);
        
        // Broadcast to room anyway
        io.to(roomId).emit("toggle-paste-restriction", { allow });
        
        // Notify sender of potential issue
        socket.emit("paste-restriction-update", { 
          success: false, 
          allow: allow, 
          message: "Warning: No interviewee found in room, setting may not be applied"
        });
      }
    } catch (error) {
      console.error(`[Server] Error handling paste restriction toggle: ${error.message}`);
      socket.emit("paste-restriction-update", { 
        success: false, 
        allow: allow, 
        message: `Error: ${error.message}`
      });
    }
  });
  
  // Handle AI proctoring alerts from the interviewee
  socket.on("alert", ({ message, type, roomId }) => {
    console.log(`AI Proctoring Alert: ${type} - ${message}`);
    
    // First try using the provided roomId, then fall back to socket data, then try socket.rooms
    let targetRoomId = roomId || socket.data.roomId;
    
    // If no roomId found yet, extract from socket.rooms (first item is the socket's own room)
    if (!targetRoomId && socket.rooms && socket.rooms.size > 1) {
      targetRoomId = Array.from(socket.rooms)[1]; // Get the room (skip socket.id)
    }
    
    if (!targetRoomId) {
      console.warn(`No room found for alert from socket ${socket.id}`);
      return;
    }
    
    // Find the interviewer in this room to send the alert to
    if (rooms[targetRoomId] && rooms[targetRoomId].interviewer) {
      const interviewerId = rooms[targetRoomId].interviewer;
      console.log(`Sending alert to interviewer ${interviewerId} in room ${targetRoomId}`);
      
      // Send alert directly to the interviewer
      io.to(interviewerId).emit("alert", {
      from: socket.id,
      message,
      type,
    });
  } else {
      console.warn(`No interviewer found in room ${targetRoomId} for alert from ${socket.id}`);
      
      // Fallback to room broadcast if no interviewer is specifically identified
      socket.to(targetRoomId).emit("alert", {
        from: socket.id,
        message,
        type,
      });
    }
  });

  // Handle whiteboard updates
  socket.on("whiteboard-update", ({ action, roomId }) => {
    // Validate inputs
    if (!roomId || !action || !action.type) {
      console.error('Invalid whiteboard update data:', { action, roomId });
      return;
    }
    
    console.log(`Whiteboard update in room ${roomId}: ${action.type} action`);
    
    // Special handling for clear actions
    if (action.type === 'clear') {
      console.log(`Received clear canvas action for room ${roomId} from ${socket.id}`);
      
      // Store the action in the room's whiteboard state
      if (rooms[roomId]) {
        if (!rooms[roomId].whiteboardActions) {
          rooms[roomId].whiteboardActions = [];
        }
        
        // For clear actions, we reset the history
        rooms[roomId].whiteboardActions = [action];
        console.log(`Reset whiteboard history for room ${roomId} with clear action`);
      }
      
      // Broadcast to ALL clients in the room (including sender for confirmation)
      io.to(roomId).emit("whiteboard-update", { action });
      return;
    }
    
    // Handle regular draw actions
    if (action.type === 'draw') {
      // Store the action in the room's whiteboard state (limit to last 1000 actions to avoid memory issues)
      if (rooms[roomId]) {
        if (!rooms[roomId].whiteboardActions) {
          rooms[roomId].whiteboardActions = [];
        }
        
        rooms[roomId].whiteboardActions.push(action);
        
        // Limit the number of stored actions to prevent memory issues
        if (rooms[roomId].whiteboardActions.length > 1000) {
          rooms[roomId].whiteboardActions.shift();
        }
      }
      
      // Broadcast to all clients in the room including the sender
      io.to(roomId).emit("whiteboard-update", { action });
    }
  });
  
  // Handle whiteboard activation
  socket.on("whiteboard-activated", ({ roomId }) => {
    console.log(`Whiteboard activation request received for room ${roomId} by user ${socket.id}`);
    
    // Check if the room exists
    if (!rooms[roomId]) {
      console.log(`Room ${roomId} does not exist for whiteboard activation`);
      return;
    }
    
    // Notify other users in the room that whiteboard has been activated
    socket.to(roomId).emit("whiteboard-activated", { 
      activatedBy: socket.id,
      timestamp: new Date().toISOString()
    });
    
    // Ensure the whiteboard actions array exists
    if (!rooms[roomId].whiteboardActions) {
      rooms[roomId].whiteboardActions = [];
      console.log(`Initialized empty whiteboard actions array for room ${roomId}`);
    }
    
    // Send existing whiteboard state to the user who just activated it
    try {
      if (rooms[roomId].whiteboardActions.length > 0) {
        console.log(`Sending whiteboard history (${rooms[roomId].whiteboardActions.length} actions) to user ${socket.id}`);
        socket.emit("whiteboard-history", { 
          actions: rooms[roomId].whiteboardActions,
          roomId
        });
      } else {
        console.log(`No whiteboard history to send for room ${roomId}`);
      }
    } catch (error) {
      console.error(`Error sending whiteboard history for room ${roomId}:`, error);
    }
    
    console.log(`Whiteboard activated in room ${roomId} by user ${socket.id}`);
  });

  // Handle notes sharing
  socket.on("send-notes", ({ notes, roomId }) => {
    socket.to(roomId).emit("receive-notes", { notes, roomId });
    console.log(`Notes updated in room ${roomId}`);
  });
  
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    for (const room in rooms) {
      if (rooms[room].interviewer === socket.id) rooms[room].interviewer = null;
      if (rooms[room].interviewee === socket.id) rooms[room].interviewee = null;
    }
  });
});

server.listen(SOCKET_PORT, () => {
  console.log(`Socket Server -> http://localhost:${SOCKET_PORT}`);
});
