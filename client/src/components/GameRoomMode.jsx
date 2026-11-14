import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import socket from "../api/sockets";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { cpp } from "@codemirror/lang-cpp";
import { java } from "@codemirror/lang-java";
import { rust } from '@codemirror/lang-rust';
import { php } from '@codemirror/lang-php';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { sql } from '@codemirror/lang-sql';
import { markdown } from '@codemirror/lang-markdown';
import { json } from '@codemirror/lang-json';
import { EditorView } from '@codemirror/view';
import VideoCall from "./VideoCall";
import createSubmission from "../api/judgeZeroGameModeApi";
import { useAuth0 } from "@auth0/auth0-react";
import Chat from "./chat";
import AiChat from "./AiChat";
import Whiteboard from "./Whiteboard";
import CodePreview from "./CodePreview";

const GameRoomMode = () => {
  const [roomId, setRoomID] = useState("");
  const [isRoomJoined, setIsRoomJoined] = useState(false);
  const [playerCode, setPlayerCode] = useState("");
  const [opponentCode, setOpponentCode] = useState("");
  const [language, setLanguage] = useState("");
  const [timerValue, setTimerValue] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [playerInput, setPlayerInput] = useState("");
  const [playerOutput, setPlayerOutput] = useState("");
  const [opponentInput, setOpponentInput] = useState("");
  const [opponentOutput, setOpponentOutput] = useState("");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [opponentName, setOpponentName] = useState("");
  const [question, setQuestion] = useState("");
  const [questionInput, setQuestionInput] = useState("");
  const [id, setId] = useState(0);
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("create"); // "create" or "join"
  const [activePanel, setActivePanel] = useState("code"); // "code", "ai", "whiteboard"
  const [notepadContent, setNotepadContent] = useState("");
  // Share room state
  const [shareSuccess, setShareSuccess] = useState(false);
  // Resize state
  const [editorWidth, setEditorWidth] = useState(50); // Percentage (out of the middle+right columns)
  const resizingRef = useRef(null);
  const timerRef = useRef(null);
  const { user } = useAuth0();

  // Define custom CodeMirror theme with white text
  const whiteTextTheme = EditorView.theme({
    "&": {
      color: "white !important",
      backgroundColor: "#000000",
    },
    ".cm-content": {
      color: "white !important",
    },
    ".cm-line": {
      color: "white !important",
    },
    ".cm-activeLine": {
      backgroundColor: "rgba(255, 255, 255, 0.1)",
    },
    "&.cm-focused .cm-cursor": {
      borderLeftColor: "white",
    },
    "&.cm-editor": {
      fontSize: "14px",
    },
    ".cm-gutters": {
      backgroundColor: "#111623",
      color: "#666",
      border: "none",
    }
  });

  useEffect(() => {
    socket.on("receive-opponent-code", ({ code }) => setOpponentCode(code));
    socket.on("receive-run-output", ({ output }) => setOpponentOutput(output));
    socket.on("opponent-input", ({ input}) => {
      setOpponentInput(input);
    });
    socket.on("opponent-left", () => {
      setOpponentName("");
      setOpponentCode("");
      setOpponentInput("");
      setOpponentOutput("");
    });
    socket.on("receive-question-game", ({ question }) => setQuestion(question));
    socket.on("receive-notepad", ({ content }) => setNotepadContent(content));

    socket.on("start-timer", ({ timeLeft }) => {
      setTimerValue(timeLeft);
      setTimerRunning(true);
  
      clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setTimerValue((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setTimerRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    });

    socket.on("stop-timer", () => {
      clearInterval(timerRef.current);
      setTimerRunning(false);
    });
    
    socket.on("reset-timer", () => {
      clearInterval(timerRef.current);
      setTimerRunning(false);
      setTimerValue(0);
    });

    socket.on("clear-question", ()=>{
      setQuestion("");
    });
    

    return () => {
      socket.off("receive-opponent-code");
      socket.off("receive-run-output");
      socket.off("opponent-io");
      socket.off("opponent-left");
      socket.off("receive-question");
      socket.off("start-timer");
      socket.off("stop-timer");
      socket.off("reset-timer");
      socket.off("receive-notepad");
    };
  }, []);

  const setLanguageExtension = useMemo(() => {
    switch (language) {
      case "python": return [python()];
      case "cpp": return [cpp()];
      case "java": return [java()];
      case "javascript": return [javascript()];
      case "rust": return [rust()];
      case "php": return [php()];
      case "html": return [html()];
      case "css": return [css()];
      case "sql": return [sql()];
      case "markdown": return [markdown()];
      case "json": return [json()];
      default: return [];
    }
  }, [language]);

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
    setRoomID(newRoomId);
    setIsRoomJoined(true);
    socket.emit("join-game-room", { roomId: newRoomId, name });
    setIsSubmitting(false);
  };

  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (!roomId || !name) {
      alert("Please enter your name and a Room ID.");
      return;
    }
    
    setIsSubmitting(true);
      setIsRoomJoined(true);
    socket.emit("join-game-room", { roomId, name });
    setIsSubmitting(false);
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
    setRoomID(formatRoomId(e.target.value));
  };

  const leaveRoom = useCallback(() => {
    socket.emit("leave-game-room", { roomId });
    setIsRoomJoined(false);
    setRoomID("");
    setOpponentCode("");
    setOpponentInput("");
    setOpponentOutput("");
  }, [roomId]);

  const updateCode = useCallback(
    (newCode) => {
      setPlayerCode(newCode);
      if (roomId) socket.emit("update-player-code", { code: newCode, roomId });
    },
    [roomId]
  );

  const updateLang = useCallback((newLang) => {
    setLanguage(newLang);
    let newId;
    switch (newLang) {
      case "python": newId = 92; break;
      case "cpp": newId = 54; break;
      case "java": newId = 91; break;
      case "javascript": newId = 93; break;
      case "rust": newId = 73; break;
      case "php": newId = 68; break;
      case "html": newId = 42; break; // HTML doesn't have direct support, using C as placeholder
      case "css": newId = 41; break;  // CSS doesn't have direct support, using C as placeholder
      case "sql": newId = 82; break;  // Using SQLite
      case "markdown": newId = 46; break; // Markdown doesn't have direct support, using C as placeholder
      case "json": newId = 93; break; // JSON is treated as JavaScript
      default: newId = null;
    }
    setId(newId);
  }, []);

  const handleInputChange = (e) => {
    const input = e.target.value;
    setPlayerInput(input);
    socket.emit("update-player-input", {
      input,
      roomId,
    });
  };

  const runCode = useCallback(async () => {
    if (!language) {
      alert("Select a language!");
      return;
    }

    if (playerCode.trim() === '') return;

    try {
      const input = playerInput.trim();
      const result = await createSubmission(id, playerCode, input !== "" ? input : null);

      if (result?.output) {
        setPlayerOutput(result.output);

        if (roomId !== "") {
          socket.emit("update-output", {output: result.output, roomId });
        }
      }
    } catch (error) {
      console.error("Execution error:", error);
      setPlayerOutput("Error executing code.");
    }
  }, [language, playerCode, playerInput, id, roomId]);

  const startTimer = useCallback(() => {
    let timeLeft = parseInt(timerValue, 10) || 0;
    if (timeLeft <= 0) return;
  
    setTimerRunning(true);
    socket.emit("start-timer", { roomId, timeLeft }); 
  
    timerRef.current = setInterval(() => {
      timeLeft -= 1;
      setTimerValue((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setTimerRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [timerValue, roomId]);
  

  const stopTimer = useCallback(() => {
    clearInterval(timerRef.current);
    setTimerRunning(false);
    socket.emit("stop-timer", { roomId });
  }, [roomId]);
  
  const resetTimer = useCallback(() => {
    clearInterval(timerRef.current);
    setTimerRunning(false);
    setTimerValue(0);
    socket.emit("reset-timer", { roomId });
  }, [roomId]);
  
  const sendQuestion = useCallback(() => {
    if(!isRoomJoined) return alert("Please join a room first!");
    socket.emit("send-question-game", { question: questionInput, roomId });
    setQuestion(questionInput);
    setQuestionInput("");
  }, [questionInput, roomId, isRoomJoined]);
  
  const clearQuestion = useCallback(() => {
    socket.emit("clear-question", { roomId });
    setQuestion("");
  }, [roomId]);
  
  const handleNotepadChange = (e) => {
    const content = e.target.value;
    setNotepadContent(content);
    if (roomId) {
      socket.emit("update-notepad", { content, roomId });
    }
  };

  // Horizontal resize handler for editor/preview
  const startEditorResize = (e) => {
    e.preventDefault();
    resizingRef.current = "editor";
    document.addEventListener('mousemove', handleEditorResize);
    document.addEventListener('mouseup', stopResize);
  };

  const handleEditorResize = (e) => {
    if (resizingRef.current !== "editor") return;
    
    const container = document.getElementById('code-editor-preview-container');
    if (!container) return;
    
    const containerRect = container.getBoundingClientRect();
    const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
    
    // Limit the panel sizes
    if (newWidth >= 30 && newWidth <= 70) {
      setEditorWidth(newWidth);
    }
  };

  const stopResize = () => {
    resizingRef.current = null;
    document.removeEventListener('mousemove', handleEditorResize);
    document.removeEventListener('mouseup', stopResize);
  };

  const copyRoomLink = () => {
    const url = `${window.location.origin}/game/${roomId}`;
    navigator.clipboard.writeText(url);
    alert("Room link copied to clipboard!");
  };

  const quickCopyRoomId = () => {
    navigator.clipboard.writeText(roomId).then(() => {
      // Show success indicator temporarily
      setShareSuccess(true);
      setTimeout(() => setShareSuccess(false), 2000);
    }).catch(err => {
      console.error("Failed to copy room ID:", err);
    });
  };

  return (
    <div className="h-screen overflow-y-auto bg-[#111623] text-white">
      {/* Room Join Panel */}
      {!isRoomJoined ? (
        <div className="min-h-screen flex justify-center items-center bg-[#111623]">
          <div className="w-full max-w-md p-4">
            <div className="bg-black/40 backdrop-blur-sm p-6 rounded-lg shadow-xl text-white">
              <div className="flex items-center justify-center mb-6">
                <img src="/images/codex-logo.svg" alt="CodePulse Logo" className="h-8 w-8 mr-2" />
                <h2 className="text-2xl font-bold bg-gradient-to-r from-[#fb568a] to-[#e456fb] text-transparent bg-clip-text">Game Room</h2>
              </div>

              {/* Tab Navigation */}
              <div className="flex mb-6 border-b border-zinc-800">
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
                      <label className="block text-sm font-medium text-zinc-300">Your Name</label>
                      <input 
                        type="text" 
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full p-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                        placeholder="Enter your name"
                        required
                        disabled={isSubmitting}
                      />
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
                          Create New Game Room
                        </>
                      )}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleJoinRoom} className="space-y-4">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-zinc-300">Your Name</label>
                      <input 
                        type="text" 
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full p-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                        placeholder="Enter your name"
                        required
                        disabled={isSubmitting}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-zinc-300">Room ID</label>
                      <input
                        type="text"
                        value={roomId}
                        onChange={handleRoomIdChange}
                        className="w-full p-2.5 bg-zinc-900 border border-zinc-700 rounded-lg font-mono text-white placeholder:text-zinc-500 focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                        placeholder="XXXX-XXXX"
                        required
                        disabled={isSubmitting}
                      />
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
                          Join Game Room
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Main Content after joining room - Updated to match InterviewRoom
        <div className="h-screen flex flex-col bg-[#111623] text-white">
          {/* Top Toolbar */}
          <div className="bg-[#0c1018] border-b border-zinc-800 h-8 px-3 flex items-center justify-between text-xs">
            <div className="flex items-center">
              <img src="/images/codex-logo.svg" alt="Intercoode Logo" className="h-4 w-4 mr-1.5" />
              <span className="font-medium">Game Room: <span className="font-mono">{roomId}</span></span>
            </div>
            <div className="flex items-center space-x-2">
              {/* Share Button */}
              <div className="relative">
                <button 
                  onClick={quickCopyRoomId}
                  className="bg-gradient-to-r from-[#fb568a] to-[#e456fb] hover:opacity-90 text-white p-1 rounded text-xs flex items-center gap-1 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  <span>Share</span>
                </button>
                
                {/* Success Message */}
                {shareSuccess && (
                  <div className="absolute top-full mt-1 left-0 bg-green-700 text-white px-2 py-1 rounded-md text-xs shadow-lg z-50 whitespace-nowrap">
                    Room ID copied!
                  </div>
                )}
              </div>
              
              <button 
                onClick={() => setIsChatOpen(!isChatOpen)}
                className="bg-zinc-800 hover:bg-zinc-700 p-1 rounded text-xs flex items-center gap-1 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
                </svg>
                <span>{isChatOpen ? "Close Chat" : "Open Chat"}</span>
              </button>
              <button 
                onClick={leaveRoom}
                className="bg-red-900 hover:bg-red-800 p-1 rounded text-xs flex items-center gap-1 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
                </svg>
                <span>Leave</span>
              </button>
            </div>
          </div>

          {/* View Mode Tabs */}
          <div className="bg-[#0c1018] border-b border-zinc-800 px-2 h-8 flex items-center justify-between">
            <div className="flex">
              <button
                onClick={() => setActivePanel("code")}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  activePanel === "code" 
                    ? "bg-gradient-to-r from-[#fb568a] to-[#e456fb] text-white" 
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Code Editor
              </button>
              <button
                onClick={() => setActivePanel("ai")}
                className={`px-3 py-1 text-xs font-medium rounded-md ml-1 transition-colors ${
                  activePanel === "ai" 
                    ? "bg-gradient-to-r from-[#fb568a] to-[#e456fb] text-white" 
                    : "text-gray-400 hover:text-white"
                }`}
              >
                AI Assistant
              </button>
              <button
                onClick={() => {
                  setActivePanel("whiteboard");
                  // Notify server that whiteboard is being activated
                  if (roomId) {
                    console.log("Activating whiteboard view in game room");
                    // Remove the timeout which causes issues with content preservation
                    socket.emit("whiteboard-activated", { roomId });
                  }
                }}
                className={`px-3 py-1 text-xs font-medium rounded-md ml-1 transition-colors ${
                  activePanel === "whiteboard" 
                    ? "bg-gradient-to-r from-[#fb568a] to-[#e456fb] text-white" 
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Whiteboard
              </button>
              <select
                value={language}
                onChange={(e) => updateLang(e.target.value)}
                className="px-3 py-1 text-xs font-medium bg-zinc-800 border border-zinc-700 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 ml-2"
              >
                <option value="">Select language</option>
                <option value="javascript">JavaScript</option>
                <option value="python">Python</option>
                <option value="cpp">C++</option>
                <option value="java">Java</option>
                <option value="rust">Rust</option>
                <option value="php">PHP</option>
                <option value="html">HTML</option>
                <option value="css">CSS</option>
                <option value="sql">SQL</option>
                <option value="markdown">Markdown</option>
                <option value="json">JSON</option>
              </select>
            </div>
            
            {/* Added Share Room ID button to the right side of the toolbar */}
            <div className="relative">
              <button
                onClick={quickCopyRoomId}
                className="bg-gradient-to-r from-[#fb568a] to-[#e456fb] hover:opacity-90 py-1 px-3 rounded-md text-xs flex items-center gap-1 transition-colors text-white"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 mr-1">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                <span>Share Room ID</span>
              </button>
              
              {/* Success Indicator */}
              {shareSuccess && (
                <div className="absolute top-full right-0 mt-1 bg-green-700 text-white px-2 py-1 rounded shadow-md text-xs z-50 whitespace-nowrap">
                  Room ID copied!
                </div>
              )}
            </div>
          </div>
          
          {/* Main Content */}
          <div 
            id="main-container"
            className="flex flex-1 overflow-hidden"
          >
            {/* Code Editor Panel */}
            {activePanel === "code" && (
              <div className="flex-1 flex overflow-hidden">
                {/* Left Column - Video Stream and Notepad */}
                <div className="w-1/5 flex flex-col border-r border-zinc-800">
                  {/* Video Stream */}
                  <div className="h-1/2 border-b border-zinc-800">
                    <div className="bg-zinc-900 px-4 py-2 flex justify-between items-center border-b border-zinc-800 shrink-0">
                      <span className="font-medium text-sm">Video Stream</span>
                    </div>
                    <div className="h-full p-2 overflow-hidden bg-black">
                      <VideoCall roomId={roomId} />
                    </div>
                  </div>
                  
                  {/* Notepad */}
                  <div className="h-1/2">
                    <div className="bg-zinc-900 px-4 py-2 flex justify-between items-center border-b border-zinc-800 shrink-0">
                      <span className="font-medium text-sm">Notepad</span>
                    </div>
                    <div className="h-full p-2 overflow-auto bg-black">
                      <textarea
                        value={notepadContent}
                        onChange={handleNotepadChange}
                        className="w-full h-full p-2 bg-zinc-800 border border-zinc-700 rounded text-white font-mono text-sm resize-none focus:outline-none focus:ring-1 focus:ring-purple-500"
                        placeholder="You can take notes here..."
                      ></textarea>
                    </div>
                  </div>
                </div>
                
                {/* Middle and Right Columns Container */}
                <div 
                  id="code-editor-preview-container" 
                  className="w-4/5 flex overflow-hidden"
                >
                  {/* Middle - Code Editor */}
                  <div 
                    className="flex flex-col h-full overflow-hidden border-r border-zinc-800"
                    style={{ width: `${editorWidth}%` }}
                  >
                    <div className="bg-zinc-900 px-4 py-2 flex justify-between items-center border-b border-zinc-800 shrink-0">
                      <span className="font-medium text-sm">Your Code</span>
                    </div>
                    <div className="flex-1 overflow-auto bg-black">
                      <CodeMirror
                        value={playerCode}
                        height="100%"
                        extensions={setLanguageExtension}
                        onChange={updateCode}
                        theme={whiteTextTheme}
                        basicSetup={{
                          lineNumbers: true,
                          highlightActiveLineGutter: true,
                          highlightActiveLine: true,
                          foldGutter: true,
                        }}
                        className="h-full"
                        style={{ minHeight: '100%' }}
                        onPaste={(e) => {
                          // Block paste in game mode
                          console.log(`[GameRoomMode] Paste attempt blocked`);
                          return false; // Block paste
                        }}
                      />
                    </div>
                    <div className="h-1 bg-zinc-800 hover:bg-[#fb568a] cursor-ns-resize shrink-0"></div>
                    <div className="h-1/3 overflow-hidden flex flex-col">
                      <div className="flex bg-zinc-900 border-b border-zinc-800 shrink-0">
                        <div className="px-4 py-2 text-xs font-medium bg-black text-white border-b-2 border-[#fb568a]">
                          Code Execution
                        </div>
                      </div>
                      <div className="flex-1 p-2 bg-black overflow-hidden flex flex-col">
                        <div className="flex space-x-2 mb-2">
                          <div className="flex-1">
                            <label className="block text-xs text-zinc-400 mb-1">Input</label>
                            <textarea
                              value={playerInput}
                              onChange={handleInputChange}
                              className="w-full h-20 p-2 bg-zinc-800 border border-zinc-700 rounded resize-none font-mono text-sm"
                              placeholder="Enter input here..."
                            />
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between">
                              <label className="block text-xs text-zinc-400 mb-1">Output</label>
                            </div>
                            <div className="w-full h-20 p-2 bg-zinc-800 border border-zinc-700 rounded overflow-auto font-mono text-sm whitespace-pre">
                              {playerOutput || "Output will appear here..."}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <button
                            onClick={runCode}
                            className="bg-gradient-to-r from-[#fb568a] to-[#e456fb] hover:opacity-90 text-white py-1.5 px-4 rounded text-sm flex items-center"
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Run Code
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Resize Handle */}
                  <div 
                    className="w-1 bg-zinc-800 hover:bg-[#fb568a] cursor-ew-resize shrink-0"
                    onMouseDown={startEditorResize}
                  ></div>
                  
                  {/* Right - Code Preview */}
                  <div 
                    className="flex flex-col h-full overflow-hidden"
                    style={{ width: `${100 - editorWidth}%` }}
                  >
                    <div className="flex-1 overflow-auto bg-black">
                      <CodePreview code={playerCode} language={language} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* AI Assistant Panel */}
            {activePanel === "ai" && (
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                <AiChat roomId={roomId} />
              </div>
            )}

            {/* Whiteboard Panel */}
            {activePanel === "whiteboard" && (
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                <Whiteboard roomId={roomId} />
              </div>
            )}
            
            {/* Chat and Video - Now on the right */}
            {isChatOpen && (
              <div className="w-1/4 bg-black border-l border-zinc-800 flex flex-col overflow-hidden">
                <div className="bg-zinc-900 px-4 py-2 flex justify-between items-center border-b border-zinc-800">
                  <span className="font-medium text-sm">Video & Chat</span>
                </div>
                <div className="p-2 flex flex-col overflow-hidden h-full">
                  <div className="mb-4">
                    <VideoCall roomId={roomId} />
                  </div>
                  
                  <div className="flex-1 overflow-hidden">
                    <Chat roomId={roomId} username={user?.name || "Anonymous"} />
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Status Bar */}
          <div className="bg-[#0c1018] border-t border-zinc-800 h-6 px-4 flex items-center justify-between text-xs text-gray-400">
            <div className="flex items-center">
              <span>Language: {language || "none"}</span>
            </div>
            <div>
              <span>Room: {roomId}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GameRoomMode;