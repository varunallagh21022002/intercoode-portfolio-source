import { io } from "socket.io-client";

const SOCKET_PORT = 3000;
const socket = io(`http://localhost:${SOCKET_PORT}`, { 
  transports: ["websocket"],
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 10000
});

// Set up connection event handlers for better debugging
socket.on("connect", () => {
  console.log("Socket connected successfully with ID:", socket.id);
});

socket.on("connect_error", (error) => {
  console.error("Socket connection error:", error.message);
});

socket.on("disconnect", (reason) => {
  console.warn("Socket disconnected:", reason);
  
  if (reason === "io server disconnect") {
    // Server disconnected us, try to reconnect
    socket.connect();
  }
});

socket.on("reconnect", (attemptNumber) => {
  console.log(`Socket reconnected after ${attemptNumber} attempts`);
});

socket.on("reconnect_error", (error) => {
  console.error("Socket reconnection error:", error.message);
});

export default socket;