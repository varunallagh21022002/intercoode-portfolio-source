class PeerConnection {
    constructor() {
        this.peer = null;
        this.pendingCandidates = [];
        this.isConnected = false;
    }

    createPeerConnection() {
        console.log("Creating new peer connection");
        
        // Close any existing connection first
        if (this.peer) {
            this.closeConnection();
        }
        
        // Reset state
        this.pendingCandidates = [];
        this.isConnected = false;
        
        this.peer = new RTCPeerConnection({
            iceServers: [
                { urls: "stun:stun.l.google.com:19302" },
                { urls: "stun:stun1.l.google.com:19302" },
                { urls: "stun:stun2.l.google.com:19302" },
                { urls: "stun:stun3.l.google.com:19302" },
                { urls: "stun:stun4.l.google.com:19302" },
                // Free TURN servers for better NAT traversal
                {
                    urls: "turn:openrelay.metered.ca:80",
                    username: "openrelayproject",
                    credential: "openrelayproject"
                },
                {
                    urls: "turn:openrelay.metered.ca:443",
                    username: "openrelayproject",
                    credential: "openrelayproject"
                },
                {
                    urls: "turn:openrelay.metered.ca:443?transport=tcp",
                    username: "openrelayproject",
                    credential: "openrelayproject"
                }
            ],
            iceCandidatePoolSize: 10
        });

        this.peer.onicecandidate = (event) => {
            if (event.candidate) {
                console.log("New ICE candidate:", event.candidate.candidate ? 
                  event.candidate.candidate.substring(0, 50) + "..." : "Empty candidate");
                  
                // Store candidates to be sent later if needed
                this.pendingCandidates.push(event.candidate);
                
                // Implement candidate sending here if needed
            } else {
                console.log("ICE gathering complete");
            }
        };

        this.peer.oniceconnectionstatechange = () => {
            console.log("ICE connection state:", this.peer.iceConnectionState);
            
            if (this.peer.iceConnectionState === 'connected' || 
                this.peer.iceConnectionState === 'completed') {
                this.isConnected = true;
                console.log("ICE connection established successfully");
            } else if (this.peer.iceConnectionState === 'disconnected' || 
                this.peer.iceConnectionState === 'failed' ||
                this.peer.iceConnectionState === 'closed') {
                this.isConnected = false;
                console.warn(`ICE connection ${this.peer.iceConnectionState}. May need reconnection.`);
            }
        };

        this.peer.onicegatheringstatechange = () => {
            console.log("ICE gathering state:", this.peer.iceGatheringState);
        };

        this.peer.onsignalingstatechange = () => {
            console.log("Signaling state:", this.peer.signalingState);
        };

        this.peer.onconnectionstatechange = () => {
            console.log("Connection state:", this.peer.connectionState);
            
            if (this.peer.connectionState === 'connected') {
                this.isConnected = true;
                console.log("Connection established successfully!");
            } else if (this.peer.connectionState === 'failed' || 
                      this.peer.connectionState === 'closed' ||
                      this.peer.connectionState === 'disconnected') {
                this.isConnected = false;
                console.error(`Connection state: ${this.peer.connectionState}`);
            }
        };
        
        // Explicitly add track event handler
        this.peer.ontrack = (event) => {
            console.log(`Track received: ${event.track.kind}`);
            if (event.streams && event.streams[0]) {
                console.log(`Stream received with tracks: ${event.streams[0].getTracks().map(t => t.kind).join(', ')}`);
            }
        };
    }

    ensurePeerConnection() {
        if (!this.peer || this.peer.signalingState === "closed") {
            console.log("Peer connection closed or null - recreating");
            this.createPeerConnection();
        }
        return this.peer;
    }

    async getOffer() {
        try {
            const peer = this.ensurePeerConnection();
            console.log("Creating offer");
            const offer = await peer.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true,
                voiceActivityDetection: false
            });
            
            console.log("Setting local description (offer)");
            await peer.setLocalDescription(offer);
            
            // Wait for ICE gathering to collect some candidates
            if (peer.iceGatheringState !== 'complete') {
                console.log("Waiting for some ICE candidates...");
                await new Promise(resolve => {
                    setTimeout(resolve, 1000); // Give it 1 second to gather some candidates
                });
            }
            
            return peer.localDescription;
        } catch (error) {
            console.error("Error creating offer:", error);
            throw error;
        }
    }

    async getAnswer(offer) {
        try {
            const peer = this.ensurePeerConnection();
            
            console.log("Setting remote description (offer)");
            await peer.setRemoteDescription(new RTCSessionDescription(offer));
            
            console.log("Creating answer");
            const answer = await peer.createAnswer({
                voiceActivityDetection: false
            });
            
            console.log("Setting local description (answer)");
            await peer.setLocalDescription(answer);
            
            // Wait for ICE gathering to collect some candidates
            if (peer.iceGatheringState !== 'complete') {
                console.log("Waiting for some ICE candidates...");
                await new Promise(resolve => {
                    setTimeout(resolve, 1000); // Give it 1 second to gather some candidates
                });
            }
            
            return peer.localDescription;
        } catch (error) {
            console.error("Error creating answer:", error);
            throw error;
        }
    }

    async setRemoteDescription(answerSDP) {
        try {
            const peer = this.ensurePeerConnection();
            
            console.log("Setting remote description (answer)");
            await peer.setRemoteDescription(new RTCSessionDescription(answerSDP));
        } catch (error) {
            console.error("Error setting remote description:", error);
            throw error;
        }
    }

    addTracks(stream) {
        try {
            const peer = this.ensurePeerConnection();
            
            if (!stream) {
                console.warn("Cannot add tracks: No stream provided");
                return;
            }
            
            // Check if tracks are already added to avoid duplicates
            const existingSenders = peer.getSenders();
            
        stream.getTracks().forEach(track => {
                console.log(`Adding ${track.kind} track to peer connection`);
                const alreadyAdded = existingSenders.some(sender => sender.track && sender.track.id === track.id);
                if (!alreadyAdded) {
                    peer.addTrack(track, stream);
                } else {
                    console.log(`Track ${track.kind} already added, skipping`);
                }
        });
        } catch (error) {
            console.error("Error adding tracks:", error);
        }
    }

    closeConnection() {
        if (this.peer) {
            console.log("Closing peer connection");
            try {
                // Clean up all event listeners first
                this.peer.onicecandidate = null;
                this.peer.oniceconnectionstatechange = null;
                this.peer.onicegatheringstatechange = null;
                this.peer.onsignalingstatechange = null;
                this.peer.onconnectionstatechange = null;
                this.peer.ontrack = null;
                
                // Close all transceivers
                const transceivers = this.peer.getTransceivers();
                transceivers.forEach(transceiver => {
                    if (transceiver.stop) {
                        transceiver.stop();
                    }
                });
                
                // Then close the connection
                this.peer.close();
                this.peer = null;
                this.isConnected = false;
                this.pendingCandidates = [];
            } catch (error) {
                console.error("Error closing peer connection:", error);
            }
        }
    }
}

const peer = new PeerConnection();
export default peer;
