import React, { useEffect, useCallback, useState, useRef } from "react";
import ReactPlayer from "react-player";
import peer from "../services/peer";
import socket from "../api/sockets";
import { useRole } from "../context/RoleContext";
import AiProctoring from "../api/AiProctoring";

// Improved video call component based on CP implementation
const MiniVideoCall = ({ roomId, showDebug = true }) => {
  const [remoteSocketId, setRemoteSocketId] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [myStream, setMyStream] = useState(null);
  const [callStatus, setCallStatus] = useState("idle"); // idle, connecting, connected, failed
  const [debugMessages, setDebugMessages] = useState([]);
  const [permissionError, setPermissionError] = useState(false);
  const [alerts, setAlerts] = useState([]);

  const { role } = useRole();
  const connectionAttempts = useRef(0);
  const aiStartedRef = useRef(false);
  const aiVideoRef = useRef(null);
  const canvasRef = useRef(null);
  const retryTimerRef = useRef(null);

  // Helper function to add debug messages
  const addDebugMessage = useCallback((message) => {
    if (showDebug) {
      console.log(`[MiniVideoCall] ${message}`);
      // Limit messages to important ones and truncate long messages
      const truncatedMsg = message.length > 40 ? message.substring(0, 40) + "..." : message;
      setDebugMessages(prev => [...prev.slice(-2), truncatedMsg]); // Show only last 2 messages
    } else {
      // Still log to console but don't update state for UI rendering
      console.log(`[MiniVideoCall] ${message}`);
    }
  }, [showDebug]);

  // Handle AI proctoring alerts if you're the interviewer
  useEffect(() => {
    if (role === "Interviewer") {
      const handleAlert = (data) => {
        addDebugMessage(`Alert received: ${data.type} - ${data.message}`);
        // Add alert to the list with unique id and auto-remove after 5 seconds
        const alertId = Date.now();
        setAlerts(prev => [...prev, { id: alertId, ...data }]);
        setTimeout(() => {
          setAlerts(prev => prev.filter(a => a.id !== alertId));
        }, 5000);
      };

      socket.on("alert", handleAlert);
      return () => socket.off("alert", handleAlert);
    }
  }, [role, addDebugMessage]);

  // Start AI proctoring for interviewee
  useEffect(() => {
    if (role === "Interviewee" && myStream && !aiStartedRef.current && aiVideoRef.current && canvasRef.current) {
      try {
        aiVideoRef.current.srcObject = myStream;
        aiVideoRef.current.onloadeddata = () => {
          addDebugMessage("Starting AI proctoring");
          AiProctoring(aiVideoRef.current, roomId, canvasRef.current);
          aiStartedRef.current = true;
        };
        aiVideoRef.current.play();
      } catch (err) {
        addDebugMessage(`Failed to start AI proctoring: ${err.message}`);
      }
    }
  }, [role, myStream, roomId, addDebugMessage]);

  // Initialize local media stream on component mount
  useEffect(() => {
    const initializeStream = async () => {
      try {
        addDebugMessage("Requesting user media");
        setPermissionError(false);
        
        // Try to get audio and video
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: true, 
            video: true 
          });
          setMyStream(stream);
          window.localStream = stream;
          addDebugMessage("Audio and video stream initialized");
        } catch (err) {
          // If that fails, try just audio
          addDebugMessage("Full media failed, trying audio only");
          try {
            const audioStream = await navigator.mediaDevices.getUserMedia({ 
              audio: true, 
              video: false 
            });
            setMyStream(audioStream);
            window.localStream = audioStream;
            addDebugMessage("Audio-only stream initialized");
          } catch (audioErr) {
            // If both fail, we have a permission problem
            throw audioErr;
          }
        }
      } catch (error) {
        // Handle permission errors in a user-friendly way
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          setPermissionError(true);
          addDebugMessage(`Camera/microphone permission denied`);
        } else {
          addDebugMessage(`Media error: ${error.message}`);
        }
        console.error("Error accessing media devices:", error);
      }
    };

    initializeStream();
    
    return () => {
      // Clean up media stream on unmount
      if (myStream) {
        myStream.getTracks().forEach(track => {
          track.stop();
          addDebugMessage(`Stopping ${track.kind} track`);
        });
      }
      if (aiStartedRef.current) {
        addDebugMessage("Stopping AI proctoring");
        aiStartedRef.current = false;
        if (aiVideoRef.current) {
          aiVideoRef.current.srcObject = null;
        }
      }
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
      if (peer.peer) {
        peer.closeConnection();
      }
    };
  }, [addDebugMessage]);

  // Function to retry getting media after permission error
  const retryGetMedia = async () => {
    try {
      addDebugMessage("Retrying media request");
      setPermissionError(false);
      
      // Try with both audio and video first
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: true, 
          video: true 
        });
        setMyStream(stream);
        window.localStream = stream;
        addDebugMessage("Full media access successful on retry");
      } catch (err) {
        // If video fails, try just audio
        const audioStream = await navigator.mediaDevices.getUserMedia({ 
          audio: true, 
          video: false 
        });
        setMyStream(audioStream);
        window.localStream = audioStream;
        addDebugMessage("Audio-only access successful on retry");
      }
      
      // If we have a remote peer, try to re-establish connection
      if (remoteSocketId) {
        handleCallUser(remoteSocketId);
      }
    } catch (error) {
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setPermissionError(true);
        addDebugMessage(`Permission denied again`);
      } else {
        addDebugMessage(`Media error on retry: ${error.message}`);
      }
      console.error("Error on retry:", error);
    }
  };

  // Handle when a user joins the room
  const handleUserJoined = useCallback(({ id }) => {
    addDebugMessage(`Remote user joined: ${id.slice(0, 5)}...`);
    setRemoteSocketId(id);
    setCallStatus("connecting");
    handleCallUser(id);
  }, [addDebugMessage]);

  // Initiate call to another user
  const handleCallUser = useCallback(async (id) => {
    try {
      addDebugMessage("Initiating call");
      connectionAttempts.current += 1;
      
      // Always ensure a fresh peer connection for each call attempt
      if (!peer.peer || peer.peer.signalingState === "closed" || peer.peer.connectionState === "failed") {
        peer.createPeerConnection();
        addDebugMessage("Created new peer connection");
      }
      
      // Ensure we have media stream before proceeding
      let stream = myStream;
      if (!stream) {
        addDebugMessage("No existing stream, requesting media for call");
        try {
          // Try with audio + video first
          stream = await navigator.mediaDevices.getUserMedia({ 
            audio: true, 
            video: true 
          });
          addDebugMessage("Got audio+video for call");
        } catch (err) {
          // Fallback to audio only if video fails
          addDebugMessage("Video unavailable, trying audio only");
          try {
            stream = await navigator.mediaDevices.getUserMedia({ 
              audio: true, 
              video: false 
            });
            addDebugMessage("Got audio-only for call");
          } catch (audioErr) {
            // If audio also fails, we can still proceed (receive only)
            addDebugMessage("All media requests failed, continuing receive-only");
            // Continue without local stream, we'll be receive-only
          }
        }
        
        // If we got any stream, set it
        if (stream) {
          setMyStream(stream);
        }
      }
      
      // Create and send an offer (even if we have no local stream)
      const offer = await peer.getOffer();
      socket.emit("user:call", { to: id, offer });
      addDebugMessage("Call offer sent");
    } catch (error) {
      addDebugMessage(`Call error: ${error.message}`);
      console.error("Error initiating call:", error);
      setCallStatus("failed");
      
      // Retry connection if we haven't tried too many times
      if (connectionAttempts.current < 3) {
        addDebugMessage(`Retry attempt ${connectionAttempts.current+1}/3 in 2s`);
        retryTimerRef.current = setTimeout(() => {
          handleCallUser(id);
        }, 2000);
      } else {
        addDebugMessage("Max retry attempts reached");
      }
    }
  }, [myStream, addDebugMessage]);

  // Handle incoming call
  const handleIncomingCall = useCallback(async ({ from, offer }) => {
    try {
      addDebugMessage(`Incoming call from: ${from.slice(0, 5)}...`);
      setRemoteSocketId(from);
      setCallStatus("connecting");
      
      // Create a new peer connection for each call
      if (!peer.peer || peer.peer.signalingState === "closed" || peer.peer.connectionState === "failed") {
        peer.createPeerConnection();
        addDebugMessage("Created new peer connection for incoming call");
      }
      
      // Ensure we have media stream before proceeding
      let stream = myStream;
      if (!stream) {
        addDebugMessage("No existing stream, requesting media for incoming call");
        try {
          // Try with audio + video first
          stream = await navigator.mediaDevices.getUserMedia({ 
            audio: true, 
            video: true 
          });
          addDebugMessage("Got audio+video for incoming call");
        } catch (err) {
          // Fallback to audio only if video fails
          addDebugMessage("Video unavailable, trying audio only");
          try {
            stream = await navigator.mediaDevices.getUserMedia({ 
              audio: true, 
              video: false 
            });
            addDebugMessage("Got audio-only for incoming call");
          } catch (audioErr) {
            // If audio also fails, we can still proceed (receive only)
            addDebugMessage("All media requests failed, continuing receive-only");
            // Continue without local stream, we'll be receive-only
          }
        }
        
        // If we got any stream, set it
        if (stream) {
          setMyStream(stream);
        }
      }
      
      // Create and send an answer (even if we have no local stream)
      const answer = await peer.getAnswer(offer);
      socket.emit("call:accepted", { to: from, ans: answer });
      addDebugMessage("Call accepted, answer sent");
    } catch (error) {
      addDebugMessage(`Incoming call error: ${error.message}`);
      console.error("Error accepting call:", error);
      setCallStatus("failed");
      
      // For incoming calls, we don't auto-retry - the caller will retry if needed
    }
  }, [myStream, addDebugMessage]);

  // Send local media streams to the peer connection
  const sendStreams = useCallback(() => {
    if (!peer.peer) {
      addDebugMessage("No peer connection available when trying to send streams");
      return;
    }
    
    if (myStream) {
      addDebugMessage("Adding local tracks to connection");
      
      // Get existing senders to avoid duplicating tracks
      const existingSenders = peer.peer.getSenders();
      
      // Add each track from our local stream
      myStream.getTracks().forEach((track) => {
        const alreadyAdded = existingSenders.some((sender) => sender.track === track);
        if (!alreadyAdded) {
          addDebugMessage(`Adding ${track.kind} track`);
          peer.peer.addTrack(track, myStream);
        }
      });
    } else {
      addDebugMessage("No local stream available, continuing in receive-only mode");
    }
  }, [myStream, addDebugMessage]);

  // Handle when our call is accepted
  const handleCallAccepted = useCallback(({ from, ans }) => {
    addDebugMessage("Call accepted, setting remote description");
    peer.setLocalDescription(ans);
    sendStreams();
    
    // Request the remote peer to send their streams
    socket.emit("initiate:send:streams", { to: from });
    addDebugMessage("Requested remote streams");
  }, [sendStreams, addDebugMessage]);

  // Handle negotiation needed events
  const handleNegoNeeded = useCallback(async () => {
    if (remoteSocketId) {
      addDebugMessage("Negotiation needed, creating new offer");
      const offer = await peer.getOffer();
      socket.emit("peer:nego:needed", { offer, to: remoteSocketId });
    }
  }, [remoteSocketId, addDebugMessage]);

  // Set up negotiation event listener
  useEffect(() => {
    if (peer.peer) {
      peer.peer.addEventListener("negotiationneeded", handleNegoNeeded);
      
      // Add connection state change listener for debugging
      peer.peer.addEventListener("connectionstatechange", () => {
        addDebugMessage(`Connection state: ${peer.peer.connectionState}`);
        if (peer.peer.connectionState === 'connected') {
          setCallStatus("connected");
          connectionAttempts.current = 0; // Reset attempts counter on success
        } else if (peer.peer.connectionState === 'failed') {
          setCallStatus("failed");
          
          // If the connection fails after being established, we might want to retry
          if (remoteSocketId && connectionAttempts.current < 3) {
            addDebugMessage("Connection failed, trying to re-establish");
            retryTimerRef.current = setTimeout(() => {
              handleCallUser(remoteSocketId);
            }, 2000);
          }
        }
      });
    }
    
    return () => {
      if (peer.peer) {
        peer.peer.removeEventListener("negotiationneeded", handleNegoNeeded);
      }
    };
  }, [handleNegoNeeded, addDebugMessage, remoteSocketId, handleCallUser]);

  // Handle incoming negotiation requests
  const handleNegoNeedIncoming = useCallback(async ({ from, offer }) => {
    addDebugMessage("Received negotiation request");
    const ans = await peer.getAnswer(offer);
    socket.emit("peer:nego:done", { to: from, ans });
    addDebugMessage("Negotiation response sent");
  }, [addDebugMessage]);

  // Handle final negotiation step
  const handleNegoNeedFinal = useCallback(async ({ ans }) => {
    addDebugMessage("Completing negotiation");
    await peer.setLocalDescription(ans);
  }, [addDebugMessage]);

  // Set up track event listener to receive remote streams
  useEffect(() => {
    if (!peer.peer) return;
    
    const handleTrackEvent = (ev) => {
      addDebugMessage(`Received ${ev.track.kind} track from remote peer`);
      setRemoteStream(ev.streams[0]);
      setCallStatus("connected");
    };
    
    peer.peer.addEventListener("track", handleTrackEvent);
    
    return () => {
      if (peer.peer) {
        peer.peer.removeEventListener("track", handleTrackEvent);
      }
    };
  }, [addDebugMessage]);

  // Handle request to send streams
  const handleIntervieweeSendStream = useCallback(({ from }) => {
    addDebugMessage("Remote peer requested our streams");
    
    // Check connection state and try sending streams
    const sendStreamIfReady = () => {
      if (peer.peer && (peer.peer.connectionState === 'connected' || 
          peer.peer.iceGatheringState === 'complete')) {
        sendStreams();
        if (peer.peer) {
          peer.peer.removeEventListener("icegatheringstatechange", sendStreamIfReady);
        }
      } else {
        // Retry after a short delay
        retryTimerRef.current = setTimeout(sendStreamIfReady, 500);
      }
    };
    
    if (peer.peer) {
      peer.peer.addEventListener("icegatheringstatechange", sendStreamIfReady);
    }
    sendStreamIfReady();
  }, [sendStreams, addDebugMessage]);

  // Handle remote peer ending the call
  const handleRemoteCallEnd = useCallback(() => {
    addDebugMessage("Remote peer left the call");
    if (myStream) {
      myStream.getTracks().forEach(track => track.stop());
    }
    peer.closeConnection();
    setMyStream(null);
    setRemoteStream(null);
    setRemoteSocketId(null);
    setCallStatus("idle");
  }, [addDebugMessage]);

  // Register socket event listeners
  useEffect(() => {
    addDebugMessage(`Setting up for ${role} in room ${roomId}`);
    
    socket.on("user:joined", handleUserJoined);
    socket.on("incoming:call", handleIncomingCall);
    socket.on("call:accepted", handleCallAccepted);
    socket.on("peer:nego:needed", handleNegoNeedIncoming);
    socket.on("peer:nego:final", handleNegoNeedFinal);
    socket.on("send:streams", handleIntervieweeSendStream);
    socket.on("endCall", handleRemoteCallEnd);
    
    // Ping presence to ensure connection is established
    const timer = setTimeout(() => {
      if (role === "Interviewer") {
        socket.emit("interviewer:ready", { roomId });
        addDebugMessage(`Announced interviewer presence in ${roomId}`);
      } else {
        socket.emit("interviewee:ready", { roomId });
        addDebugMessage(`Announced interviewee presence in ${roomId}`);
      }
    }, 1000);
    
    return () => {
      clearTimeout(timer);
      socket.off("user:joined", handleUserJoined);
      socket.off("incoming:call", handleIncomingCall);
      socket.off("call:accepted", handleCallAccepted);
      socket.off("peer:nego:needed", handleNegoNeedIncoming);
      socket.off("peer:nego:final", handleNegoNeedFinal);
      socket.off("send:streams", handleIntervieweeSendStream);
      socket.off("endCall", handleRemoteCallEnd);
      
      // Clean up peer connection
      if (peer.peer) {
        peer.closeConnection();
        addDebugMessage("Closed peer connection on unmount");
      }
    };
  }, [
    roomId,
    role,
    handleUserJoined,
    handleIncomingCall,
    handleCallAccepted,
    handleNegoNeedIncoming,
    handleNegoNeedFinal,
    handleIntervieweeSendStream,
    handleRemoteCallEnd,
    addDebugMessage
  ]);

  return (
    <div className="relative w-full bg-black/30 rounded-md p-2 mb-2">
      {permissionError ? (
        <div className="w-full p-3 bg-red-900/50 rounded-md mb-2">
          <div className="text-white text-xs mb-2 font-medium">
            Camera or microphone permission denied
          </div>
          <p className="text-white/80 text-xs mb-2">
            This app needs access to your camera and microphone for video calls.
          </p>
          <div className="flex gap-2">
            <button 
              onClick={retryGetMedia}
              className="bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded text-xs"
            >
              Try Again
            </button>
            <a 
              href="https://support.google.com/chrome/answer/2693767?hl=en" 
              target="_blank" 
              rel="noopener noreferrer"
              className="bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded text-xs"
            >
              How to fix
            </a>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <div className="w-1/2 h-16 relative bg-black/20 rounded-md overflow-hidden">
              {myStream ? (
                <ReactPlayer
                  url={myStream}
                  playing
                  muted
                  width="100%"
                  height="100%"
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full animate-pulse bg-zinc-800 flex items-center justify-center text-xs text-zinc-400">
                  Loading camera...
                </div>
              )}
              <div className="absolute bottom-0 left-0 text-[0.6rem] bg-black/50 px-1 text-white">
                You ({role})
              </div>
            </div>
            
            <div className="w-1/2 h-16 relative bg-black/20 rounded-md overflow-hidden">
              {remoteStream ? (
                <ReactPlayer
                  url={remoteStream}
                  playing
                  width="100%"
                  height="100%"
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-xs text-zinc-400">
                  <div className={`${callStatus === 'connecting' ? 'animate-pulse' : ''}`}>
                    {callStatus === 'idle' && "Waiting for peer..."}
                    {callStatus === 'connecting' && "Connecting..."}
                    {callStatus === 'failed' && "Connection failed"}
                  </div>
                </div>
              )}
              <div className="absolute bottom-0 left-0 text-[0.6rem] bg-black/50 px-1 text-white">
                {role === "Interviewer" ? "Interviewee" : "Interviewer"}
              </div>
            </div>
          </div>

          {/* AI Proctoring Alerts for Interviewer */}
          {role === "Interviewer" && alerts.length > 0 && (
            <div className="mt-2 text-xs">
              {alerts.map(alert => (
                <div 
                  key={alert.id} 
                  className="mb-1 py-1 px-2 bg-yellow-600/50 text-white rounded-sm flex items-center"
                >
                  <span className="w-3 h-3 bg-yellow-500 rounded-full mr-1.5 animate-pulse"></span>
                  {alert.message}
                </div>
              ))}
            </div>
          )}
          
          {/* Hidden elements for AI Proctoring */}
          {role === "Interviewee" && (
            <div className="hidden">
              <video
                ref={aiVideoRef}
                className="hidden"
                muted
                autoPlay
                playsInline
              />
              <canvas
                ref={canvasRef}
                className="hidden"
              />
            </div>
          )}
        </>
      )}
      
      {/* Optional debug UI - only shown when showDebug is true */}
      {showDebug && process.env.NODE_ENV !== 'production' && debugMessages.length > 0 && (
        <div className="mt-1 text-[0.6rem] text-zinc-500 max-h-8 overflow-y-auto">
          {debugMessages.map((msg, i) => (
            <div key={i} className="truncate">{msg}</div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MiniVideoCall; 