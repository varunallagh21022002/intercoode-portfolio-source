import React, { useEffect, useCallback, useState, useRef } from "react";
import ReactPlayer from "react-player";
import peer from "../services/peer";
import socket from "../api/sockets";
import { useNavigate } from "react-router-dom";
import { useRole } from "../context/RoleContext";
import AiProctoring from "../api/AiProctoring";

const VideoCall = ({ layout = "vertical", roomId }) => {
  const [remoteSocketId, setRemoteSocketId] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [myStream, setMyStream] = useState(null);
  const navigate = useNavigate();
  const calledPeers = useRef(new Set()); // Track peers we've already called

  const { role } = useRole();

  const aiStartedRef = useRef(false);
  const aiVideoRef = useRef(null);
  const canvasRef = useRef(null);

  // Start AI proctoring when the Interviewee is ready
  useEffect(() => {
    if (role === "Interviewee" && myStream && !aiStartedRef.current && aiVideoRef.current && canvasRef.current) {
      aiVideoRef.current.srcObject = myStream;
      aiVideoRef.current.onloadeddata = () => {
        AiProctoring(aiVideoRef.current, roomId);
        aiStartedRef.current = true;
      };
      aiVideoRef.current.play();
    }
  }, [role, myStream, roomId]);

  // Stop AI proctoring when the user clicks the stop button
  const handleStopAiProctoring = () => {
    aiStartedRef.current = false;
    aiVideoRef.current.srcObject = null;
    canvasRef.current.getContext('2d').clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    console.log("[AI PROCTORING] Stopped.");
  };

  // Get initial media stream on component mount
  useEffect(() => {
    const intialStreamStart = async () => {
      try {
        console.log("Getting media stream");
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: true, 
          video: true 
        });
        setMyStream(stream);
        console.log("Got media stream successfully");
      } catch (error) {
        console.error("Error getting media stream:", error);
        try {
          const audioOnlyStream = await navigator.mediaDevices.getUserMedia({ 
            audio: true, 
            video: false 
          });
          setMyStream(audioOnlyStream);
          console.log("Got audio-only stream as fallback");
        } catch (audioError) {
          console.error("Failed to get even audio-only stream:", audioError);
        }
      }
    };
    
    intialStreamStart();
    
    return () => {
      if (myStream) {
        myStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Handle when another user joins the room
  const handleUserJoined = useCallback(({ id }) => {
    console.log("User joined with ID:", id);
    setRemoteSocketId(id);
    
    // Only call if we haven't called this peer already
    if (!calledPeers.current.has(id)) {
      calledPeers.current.add(id);
    handleCallUser(id);
    }
  }, []);

  // Initiate a call to another user
  const handleCallUser = useCallback(async (id) => {
    try {
      console.log("Calling user with ID:", id);
      
      // Create fresh peer connection
        peer.createPeerConnection();
      
      // Ensure we have media stream
      let stream = myStream;
      if (!stream) {
        console.log("No stream available, requesting media permissions...");
        try {
          stream = await navigator.mediaDevices.getUserMedia({ 
            audio: true, 
            video: { 
              width: { ideal: 640 },
              height: { ideal: 480 },
              facingMode: "user"
            }
          });
          console.log("Media permissions granted successfully");
          setMyStream(stream);
        } catch (mediaError) {
          console.error("Video permission error:", mediaError.message);
          console.log("Falling back to audio only...");
          
          try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: true, 
              video: false 
        });
            console.log("Audio-only stream acquired");
        setMyStream(stream);
          } catch (audioError) {
            console.error("Audio permission error:", audioError.message);
            console.log("Continuing in receive-only mode");
          }
        }
      }
      
      // If we have a stream, add it to the peer connection
      if (stream) {
        console.log("Adding tracks to peer connection");
        peer.addTracks(stream);
      }
      
      // Create and send offer even if we don't have stream (receive-only)
      console.log("Creating peer connection offer");
      const offer = await peer.getOffer();
      socket.emit("user:call", { to: id, offer });
      
      console.log("Call initiated with offer");
    } catch (error) {
      console.error("Error initiating call:", error);
    }
  }, [myStream]);

  // Handle incoming call from another user
  const handleIncomingCall = useCallback(async ({ from, offer }) => {
    try {
      console.log("Incoming call from:", from);
      setRemoteSocketId(from);
      
      // Create fresh peer connection
      peer.createPeerConnection();
      
      // Ensure we have media stream
      let stream = myStream;
      if (!stream) {
        console.log("No stream available for incoming call, requesting permissions...");
        try {
          stream = await navigator.mediaDevices.getUserMedia({ 
            audio: true, 
            video: { 
              width: { ideal: 640 },
              height: { ideal: 480 },
              facingMode: "user"
            }
          });
          console.log("Media permissions granted for incoming call");
          setMyStream(stream);
        } catch (mediaError) {
          console.error("Video permission error on incoming call:", mediaError.message);
          try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: true, 
              video: false 
        });
            console.log("Audio-only stream acquired for incoming call");
        setMyStream(stream);
          } catch (audioError) {
            console.error("Audio permission error on incoming call:", audioError.message);
            console.log("Answering in receive-only mode");
          }
        }
      }
      
      // If we have a stream, add tracks before creating answer
      if (stream) {
        console.log("Adding tracks for incoming call");
        peer.addTracks(stream);
      }
      
      // Create and send answer
      console.log("Creating answer for incoming call");
      const answer = await peer.getAnswer(offer);
      socket.emit("call:accepted", { to: from, ans: answer });
      
      console.log("Call accepted with answer");
    } catch (error) {
      console.error("Error accepting call:", error);
    }
  }, [myStream]);

  // Handle when our call is accepted by the remote peer
  const handleCallAccepted = useCallback(({ from, ans }) => {
    console.log("Call accepted by:", from);
    
    // Set remote description with the answer SDP
    peer.setRemoteDescription(ans)
      .then(() => {
        console.log("Remote description set successfully");
    
    // Send our stream to the peer
        if (myStream) {
          console.log("Adding local tracks to connection");
          peer.addTracks(myStream);
        } else {
          console.warn("No local stream to send");
        }
    
    // Request remote stream too
        console.log("Requesting remote streams");
    socket.emit("initiate:send:streams", { to: from });
      })
      .catch(error => {
        console.error("Error setting remote description:", error);
      });
    
  }, [myStream]);

  // Handle when negotiation is needed
  const handleNegoNeeded = useCallback(async () => {
    try {
      if (remoteSocketId) {
        console.log("Negotiation needed with:", remoteSocketId);
    const offer = await peer.getOffer();
    socket.emit("peer:nego:needed", { offer, to: remoteSocketId });
      }
    } catch (error) {
      console.error("Error during negotiation:", error);
    }
  }, [remoteSocketId]);

  // Set up negotiation needed listener
  useEffect(() => {
    if (peer.peer) {
      peer.peer.addEventListener("negotiationneeded", handleNegoNeeded);
      
    return () => {
        peer.peer.removeEventListener("negotiationneeded", handleNegoNeeded);
      };
      }
  }, [handleNegoNeeded]);

  // Handle incoming negotiation request
  const handleNegoNeedIncoming = useCallback(async ({ from, offer }) => {
    try {
      console.log("Negotiation request from:", from);
    const ans = await peer.getAnswer(offer);
    socket.emit("peer:nego:done", { to: from, ans });
    } catch (error) {
      console.error("Error during negotiation:", error);
    }
  }, []);

  // Handle final negotiation step
  const handleNegoNeedFinal = useCallback(async ({ from, ans }) => {
    try {
      console.log("Final negotiation step from:", from);
      await peer.setRemoteDescription(ans);
      console.log("Remote description set for negotiation");
    } catch (error) {
      console.error("Error during final negotiation:", error);
    }
  }, []);

  // Set up track listener to receive remote stream
  useEffect(() => {
    if (!peer.peer) return;
    
    const handleTrack = (ev) => {
      console.log("Received track from remote peer:", ev.track.kind);
      
      if (ev.streams && ev.streams[0]) {
        console.log("Setting remote stream with tracks:", 
          ev.streams[0].getTracks().map(t => t.kind).join(', '));
        
        // Set remote stream and make sure UI updates
        setRemoteStream(prev => {
          if (prev && prev.id === ev.streams[0].id) {
            console.log("Stream already set, skipping");
            return prev;
          }
          console.log("Setting new remote stream");
          return ev.streams[0];
        });
      } else {
        console.warn("Track event without streams array");
        
        // Fallback approach if stream isn't directly provided
        const newStream = new MediaStream();
        newStream.addTrack(ev.track);
        console.log("Created new MediaStream for remote track");
        
        setRemoteStream(prev => {
          // If we already have a stream, add this track to it
          if (prev) {
            // Check if we already have this track
            if (!prev.getTracks().some(t => t.id === ev.track.id)) {
              prev.addTrack(ev.track);
              console.log("Added track to existing remote stream");
              // Return a new stream reference to trigger UI update
              return new MediaStream(prev.getTracks());
            }
            return prev;
          }
          return newStream;
        });
      }
    };
    
    // Remove any existing track listener first
    peer.peer.removeEventListener("track", handleTrack);
    
    // Add our track handler
    peer.peer.addEventListener("track", handleTrack);
    
    return () => {
      if (peer.peer) {
      peer.peer.removeEventListener("track", handleTrack);
      }
    };
  }, []);

  // Handle request to send our stream
  const handleIntervieweeSendStream = useCallback(({ from }) => {
    console.log("Stream request from:", from);
    
    if (!myStream) {
      console.warn("Cannot send stream - no local stream available");
      return;
    }
    
    if (!peer.peer) {
      console.warn("Cannot send stream - no peer connection");
      return;
    }
    
    // Function to send streams when connection is ready
    const sendStreamWhenReady = () => {
      // Check if peer connection is in a state where we can send
      if (peer.isConnected || 
          peer.peer.connectionState === 'connected' || 
          peer.peer.iceConnectionState === 'connected' || 
          peer.peer.iceConnectionState === 'completed') {
        
        console.log("Connection ready, adding tracks");
        peer.addTracks(myStream);
        
        // Clean up our interval
        if (sendInterval) {
          clearInterval(sendInterval);
        }
      } else {
        console.log("Connection not ready yet:", {
          peerState: peer.isConnected,
          connectionState: peer.peer.connectionState,
          iceState: peer.peer.iceConnectionState
        });
      }
    };
    
    // Try immediately
    sendStreamWhenReady();
    
    // Also set an interval to retry a few times
    const sendInterval = setInterval(() => {
      if (!peer.peer) {
        clearInterval(sendInterval);
        return;
      }
      
      sendStreamWhenReady();
    }, 1000);
    
    // Clear interval after 10 seconds (10 attempts)
    setTimeout(() => {
      if (sendInterval) {
        clearInterval(sendInterval);
        console.log("Stopped stream sending attempts after timeout");
    }
    }, 10000);
    
  }, [myStream]);

  // Handle ending the call
  const handleEndCall = useCallback(() => {
    console.log("Ending call");
    
    if (myStream) {
      myStream.getTracks().forEach((track) => {
        track.stop();
      });
    }
    
    peer.closeConnection();
    
    if (remoteSocketId) {
    socket.emit("call:ended", { to: remoteSocketId });
    }

    setMyStream(null);
    setRemoteStream(null);
    setRemoteSocketId(null);
    calledPeers.current.clear();
    
    setTimeout(() => navigate("/"), 100);
  }, [remoteSocketId, myStream, navigate]);

  // Handle when remote peer ends the call
  const handleRemoteCallEnd = useCallback(() => {
    alert("Other person left the call!");
    
    if (myStream) {
      myStream.getTracks().forEach((track) => {
        track.stop();
      });
    }
    
    peer.closeConnection();
    
    setMyStream(null);
    setRemoteStream(null);
    setRemoteSocketId(null);
    calledPeers.current.clear();
    
    setTimeout(() => navigate("/"), 100);
  }, [myStream, navigate]);

  // Set up socket event listeners
  useEffect(() => {
    console.log(`Setting up WebRTC event listeners for room ${roomId}`);
    
    // Remove any existing listeners first
    socket.off("user:joined");
    socket.off("incoming:call");
    socket.off("call:accepted");
    socket.off("peer:nego:needed");
    socket.off("peer:nego:final");
    socket.off("send:streams");
    socket.off("endCall");
    
    // Add listeners
    socket.on("user:joined", handleUserJoined);
    socket.on("incoming:call", handleIncomingCall);
    socket.on("call:accepted", handleCallAccepted);
    socket.on("peer:nego:needed", handleNegoNeedIncoming);
    socket.on("peer:nego:final", handleNegoNeedFinal);
    socket.on("send:streams", handleIntervieweeSendStream);
    socket.on("endCall", handleRemoteCallEnd);
    
    // Announce presence only once
    const timer = setTimeout(() => {
      console.log(`Announcing presence as ${role} in room ${roomId}`);
      if (role === "Interviewer") {
        socket.emit("interviewer:ready", { roomId });
      } else {
        socket.emit("interviewee:ready", { roomId });
      }
    }, 1000);

    return () => {
      console.log("Cleaning up WebRTC listeners");
      clearTimeout(timer);
      
      socket.off("user:joined", handleUserJoined);
      socket.off("incoming:call", handleIncomingCall);
      socket.off("call:accepted", handleCallAccepted);
      socket.off("peer:nego:needed", handleNegoNeedIncoming);
      socket.off("peer:nego:final", handleNegoNeedFinal);
      socket.off("send:streams", handleIntervieweeSendStream);
      socket.off("endCall", handleRemoteCallEnd);
      
      if (myStream) {
        myStream.getTracks().forEach(track => track.stop());
      }
      
      if (peer.peer) {
        peer.closeConnection();
      }
      
      calledPeers.current.clear();
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
    handleRemoteCallEnd
  ]);

  return (
    <>
        <div
          className={`relative w-full h-full bg-[hsl(0,0%,8%)] rounded-lg shadow-lg flex ${layout === "vertical" ? "flex-col gap-2" : "flex-row gap-2"} items-center justify-center `}
        >
          <div className={`flex ${layout === "vertical" ? "h-[40%] w-[100%]" : "w-1/2"} flex-col items-center  `}>
            {myStream ? (
              <>
                <ReactPlayer
                  url={myStream}
                  playing
                  muted
                  width="100%"
                  height="100%"
                  className="rounded-lg shadow-md"
                />
                <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                  You
                </div>
              </>
            ) : (
              <div className={`${layout === "vertical" ? "w-[90%] h-35" : "w-full h-35"} animate-pulse bg-zinc-800 rounded-lg flex items-center justify-center`}>
                <span className="text-xs text-zinc-400">Loading your camera...</span>
              </div>
            )}
          </div>

          <div className={`flex ${layout === "vertical" ? "h-[40%] w-[100%]" : "w-1/2"} flex-col items-center  `}>
            {remoteStream ? (
              <>
              <ReactPlayer
                url={remoteStream}
                playing
                width="100%"
                height="100%"
                className="rounded-lg shadow-md"
              />
                <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                  New
                </div>
              </>
            ) : (
              <div className={`${layout === "vertical" ? "w-[90%] h-35" : "w-full h-35"} animate-pulse bg-zinc-800 rounded-lg flex items-center justify-center`}>
                <span className="text-xs text-zinc-400">Waiting for peer... {remoteSocketId ? `(ID: ${remoteSocketId.slice(0, 5)}...)` : ''}</span>
              </div>
            )}
          </div>
          
          <button
          onClick={handleEndCall}
          className={`absolute ${layout === "vertical" ? "bottom-0 right-2" : "-bottom-7 right-2"}  px-3 py-1 bg-red-700 text-white rounded-lg shadow-md hover:bg-red-800 transition z-50`}
        >
          End Call
        </button>
      </div>

        <div className="hidden relative w-[640px] h-[480px] border border-red-500 mt-4">
        <video
          ref={aiVideoRef}
            className="hidden absolute top-0 left-0 w-full h-full opacity-40 z-10"
          muted
          autoPlay
          playsInline
        />
        <canvas
          ref={canvasRef}
          id="ai-proctor-canvas"
          className="hidden absolute top-0 left-0 w-full h-full z-20"
        />
      </div>
      <br />
      <button
          onClick={handleStopAiProctoring}
          className="hidden absolute left-2 px-3 py-1 bg-yellow-600 text-white rounded-lg shadow-md hover:bg-yellow-700 transition"
        >
          Stop AI Proctoring
        </button>
    </>
  );
};

export default VideoCall;
