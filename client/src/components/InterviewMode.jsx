import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import socket from '../api/sockets';
import { useRole } from '../context/RoleContext';

const InterviewMode = () => {
  const [role, setRole] = useState("Interviewer");
  const { setRole: setRoleContext } = useRole();
  const [roomId, setRoomId] = useState("");
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("create"); // "create" or "join"
  const navigate = useNavigate();

  useEffect(() => {
    socket.on("connect", () => console.log("Connected to socket:", socket.id));

    socket.on("room-error", (msg) => {
      setIsSubmitting(false);
      alert(msg);
    });

    // ✅ Navigate when "room-joined" is received
    socket.on("room-joined", ({ roomId }) => {
      console.log(`Navigating to interview room: ${roomId}`);
      navigate(`/interview/${roomId}`);
    });

    return () => {
      socket.off("room-error");
      socket.off("room-joined");
    };
  }, [navigate]);

  const generateRoomId = () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 4; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    result += '-';
    for (let i = 0; i < 4; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
  };

  const handleCreateRoom = (e) => {
    e.preventDefault();
    if (!name) {
      alert("Please enter your name");
      return;
    }
    
    setIsSubmitting(true);
    const newRoomId = generateRoomId();
    setRoomId(newRoomId);
    setRoleContext(role);
    socket.emit("join-room", { roomId: newRoomId, role, name });
  };

  const handleJoinRoom = (e) => {
     e.preventDefault();
    if (!roomId || !role || !name) {
      alert("Please enter your name, a Room ID and select a Role.");
        return;
    }
    
    setIsSubmitting(true);
    setRoleContext(role);
    socket.emit("join-room", { roomId, role, name });
  };

  const formatRoomId = (value) => {
    let formatted = value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    
    if (formatted.length > 9) {
      formatted = formatted.slice(0, 9);
    }
    
    if (formatted.length > 4 && !formatted.includes('-')) {
      formatted = `${formatted.slice(0, 4)}-${formatted.slice(4)}`;
    }
    
    return formatted;
  };

  const handleRoomIdChange = (e) => {
    setRoomId(formatRoomId(e.target.value));
  };

  return (
    <div className="min-h-screen flex justify-center items-center bg-[#111623]">
      <div className="w-full max-w-md p-4">
        <div className="bg-black/20 backdrop-blur-sm p-6 rounded-lg shadow-xl text-white">
          <div className="flex items-center justify-center mb-6 mt-4">
            <img
              src="/images/codex-logo.svg"
              alt="Intercoode Logo"
              className="h-8 w-8 mr-3"
            />
            <h2 className="text-2xl font-bold">Interview</h2>
          </div>
          
          {/* Tab Navigation */}
          <div className="flex mb-6 border-b border-zinc-700">
            <button 
              className={`px-4 py-2 text-sm font-medium ${activeTab === "create" ? "text-white border-b-2 border-[#fb568a]" : "text-gray-400 hover:text-white"}`}
              onClick={() => setActiveTab("create")}
            >
              Create Room
            </button>
            <button 
              className={`px-4 py-2 text-sm font-medium ${activeTab === "join" ? "text-white border-b-2 border-[#fb568a]" : "text-gray-400 hover:text-white"}`}
              onClick={() => setActiveTab("join")}
            >
              Join Room
            </button>
          </div>
          
          <div className="space-y-4">
            {activeTab === "create" ? (
              <form onSubmit={handleCreateRoom} className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium">Your Name</label>
                  <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full p-2.5 bg-white/10 border border-zinc-700 rounded-lg text-white placeholder:text-white/50"
                    placeholder="Enter your name"
                    required
                    disabled={isSubmitting}
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-medium">Role</label>
                  <select 
                    value={role} 
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full p-2.5 bg-white/10 border border-zinc-700 rounded-lg text-white"
                    disabled={isSubmitting}
                  >
          <option value="Interviewer">Interviewer</option>
          <option value="Interviewee">Interviewee</option>
        </select>
                </div>

                <button 
                  type="submit"
                  className="w-full bg-gradient-to-r from-[#fb568a] to-[#e456fb] hover:opacity-90 text-white py-2.5 px-5 rounded-lg font-medium disabled:opacity-50 flex justify-center items-center"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Creating...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                      </svg>
                      Create Room
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleJoinRoom} className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium">Your Name</label>
                  <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full p-2.5 bg-white/10 border border-zinc-700 rounded-lg text-white placeholder:text-white/50"
                    placeholder="Enter your name"
                    required
                    disabled={isSubmitting}
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-medium">Room ID</label>
                  <input 
                    type="text" 
                    value={roomId}
                    onChange={handleRoomIdChange}
                    className="w-full p-2.5 bg-white/10 border border-zinc-700 rounded-lg font-mono text-white placeholder:text-white/50"
                    placeholder="XXXX-XXXX"
                    required
                    disabled={isSubmitting}
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-medium">Role</label>
                  <select 
                    value={role} 
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full p-2.5 bg-white/10 border border-zinc-700 rounded-lg text-white"
                    disabled={isSubmitting}
                  >
                    <option value="Interviewer">Interviewer</option>
                    <option value="Interviewee">Interviewee</option>
                  </select>
                </div>

                <button 
                  type="submit"
                  className="w-full bg-gradient-to-r from-[#fb568a] to-[#e456fb] hover:opacity-90 text-white py-2.5 px-5 rounded-lg font-medium disabled:opacity-50 flex justify-center items-center"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Joining...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
                      </svg>
                      Join Room
                    </>
                  )}
        </button>
      </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InterviewMode;
