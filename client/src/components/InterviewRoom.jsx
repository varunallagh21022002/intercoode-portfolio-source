import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import socket from "../api/sockets"; // Import the persistent socket
import { useRole } from "../context/RoleContext";
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript'; 
import { python } from '@codemirror/lang-python'; 
import { cpp } from '@codemirror/lang-cpp';
import { java } from '@codemirror/lang-java'; 
import { rust } from '@codemirror/lang-rust';
import { php } from '@codemirror/lang-php';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { sql } from '@codemirror/lang-sql';
import { markdown } from '@codemirror/lang-markdown';
import { json } from '@codemirror/lang-json';
import { useAuth0 } from '@auth0/auth0-react';
import { useIntervieweeRestrictions } from "../services/useIntervieweeRestrictions";
import InterviewerQuestion from "./InterviewerQuestion";
import IntervieweeQuestion from "./IntervieweeQuestion";
import CodeExecutionArea from "./CodeExecutionArea"; // Import the code execution component
import AiChat from "./AiChat"; // Import the AI Chat component
import Whiteboard from "./Whiteboard"; // Import the Whiteboard component
import CodePreview from "./CodePreview"; // Import the CodePreview component
import Notepad from "./Notepad"; // Import the Notepad component
import VideoCall from "./VideoCall"; // Import VideoCall instead of MiniVideoCall
import { EditorView } from '@codemirror/view'; // Import EditorView for custom styling

// Loader component
const Spinner = () => (
  <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
);

// Icon components
const ShareIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
  </svg>
);

const LeaveIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
);

const PlayIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const InterviewRoom = () => {
  const { role } = useRole();
  const { roomId } = useParams(); // Get roomId from URL
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("");
  const [activeTab, setActiveTab] = useState("execution"); // Just "execution" now
  const [activePanel, setActivePanel] = useState("editor"); // "editor", "video", "both", "ai", or "whiteboard"
  const [isFullscreen, setIsFullscreen] = useState(role === "Interviewee" ? false : true);
  const [isRunning, setIsRunning] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);

  // Panel resize state
  const [showNotepad, setShowNotepad] = useState(true);
  const [notepadWidth, setNotepadWidth] = useState(15); // Reduced from 20% to 15%
  const [showPreview, setShowPreview] = useState(true);
  const [previewWidth, setPreviewWidth] = useState(40); // Percentage
  const [editorWidth, setEditorWidth] = useState(65); // Percentage
  const [terminalHeight, setTerminalHeight] = useState(30); // Percentage
  const resizingRef = useRef(null);

  const [testCases, setTestCases] = useState([{ input: "", expectedOutput: "", output: "", status: "Not Executed", testCasePassed: null }]);

  // Get the paste restrictions state from our hook
  const { allowPaste } = useIntervieweeRestrictions(role, roomId);

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
    if (role !== "Interviewee") return;
  
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
  
    document.addEventListener("fullscreenchange", handleFullscreenChange);
  
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [role]);

  // Prevent interviewees from accessing the AI panel
  useEffect(() => {
    if (role === "Interviewee" && activePanel === "ai") {
      setActivePanel("editor");
    }
  }, [role, activePanel]);

  useEffect(() => {
    if (socket.connected) {
      console.log(`Joining room ${roomId} as ${role}`);
      socket.emit("join-room", { role, roomId, name: localStorage.getItem('userName') || role });
    } else {
      socket.once("connect", () => {
        console.log(`Socket connected, joining room ${roomId} as ${role}`);
        socket.emit("join-room", { role, roomId, name: localStorage.getItem('userName') || role });
      });
    }

    socket.on("room-error", (msg) => {
      alert(msg);
      navigate("/"); // Redirect if there's an error
    });

    socket.on("send-language", (newLanguage) => setLanguage(newLanguage));
    socket.on("send-code", (newCode) => setCode(newCode));

    // Emit ready events based on role for WebRTC connections
    const timer = setTimeout(() => {
      if (role === "Interviewee") {
        console.log("Notifying server that interviewee is ready for video connection");
        socket.emit("interviewee:ready", { roomId });
      } else if (role === "Interviewer") {
        console.log("Notifying server that interviewer is ready for video connection");
        socket.emit("interviewer:ready", { roomId });
      }
    }, 2000);

    return () => {
      clearTimeout(timer);
      socket.off("room-error");
      socket.off("send-language");
      socket.off("send-code");
    };
  }, [roomId, role, navigate]);

  const updateCode = useCallback(
    (newCode) => {
      setCode(newCode);
      if (roomId) socket.emit("update-code", { newCode, roomId });
    },
    [roomId]
  );

  const setLanguageExtension = useMemo(() => {
    switch (language) {
      case 'python': return [python()];
      case 'cpp': return [cpp()];
      case 'java': return [java()];
      case 'javascript': return [javascript()];
      case 'rust': return [rust()];
      case 'php': return [php()];
      case 'html': return [html()];
      case 'css': return [css()];
      case 'sql': return [sql()];
      case 'markdown': return [markdown()];
      case 'json': return [json()];
      default: return [];
    }
  }, [language]);

  const updateLang = useCallback(
    (newLang) => {
      setLanguage(newLang);
      if (roomId) socket.emit("update-language", { language: newLang, roomId });
    },
    [roomId]
  );

  const copyRoomLink = () => {
    const url = `${window.location.origin}/interview/${roomId}`;
    navigator.clipboard.writeText(url);
    alert("Room link copied to clipboard!");
  };

  const quickCopyRoomLink = () => {
    navigator.clipboard.writeText(roomId).then(() => {
      // Show success indicator temporarily
      setShareSuccess(true);
      setTimeout(() => setShareSuccess(false), 2000);
    }).catch(err => {
      console.error("Failed to copy room ID:", err);
    });
  };

  const leaveRoom = () => {
    if (window.confirm("Are you sure you want to leave this room?")) {
      socket.emit("leave-room", { roomId });
      navigate("/");
    }
  };

  // Horizontal resize handler
  const startHorizontalResize = (e) => {
    e.preventDefault();
    resizingRef.current = "horizontal";
    document.addEventListener('mousemove', handleHorizontalResize);
    document.addEventListener('mouseup', stopResize);
  };

  const handleHorizontalResize = (e) => {
    if (resizingRef.current !== "horizontal") return;
    
    const container = document.getElementById('main-container');
    if (!container) return;
    
    const containerRect = container.getBoundingClientRect();
    const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
    
    // Limit the panel sizes
    if (newWidth >= 30 && newWidth <= 85) {
      setEditorWidth(newWidth);
    }
  };

  // Vertical resize handler
  const startVerticalResize = (e) => {
    e.preventDefault();
    resizingRef.current = "vertical";
    document.addEventListener('mousemove', handleVerticalResize);
    document.addEventListener('mouseup', stopResize);
  };

  const handleVerticalResize = (e) => {
    if (resizingRef.current !== "vertical") return;
    
    const editorPanel = document.getElementById('editor-panel');
    if (!editorPanel) return;
    
    const editorRect = editorPanel.getBoundingClientRect();
    const newHeight = 100 - ((e.clientY - editorRect.top) / editorRect.height) * 100;
    
    // Limit the panel sizes
    if (newHeight >= 20 && newHeight <= 70) {
      setTerminalHeight(newHeight);
    }
  };

  // Additional horizontal resize handler for preview
  const startPreviewResize = (e) => {
    e.preventDefault();
    resizingRef.current = "preview";
    document.addEventListener('mousemove', handlePreviewResize);
    document.addEventListener('mouseup', stopResize);
  };

  const handlePreviewResize = (e) => {
    if (resizingRef.current !== "preview") return;
    
    const editorContainer = document.getElementById('editor-container');
    if (!editorContainer) return;
    
    const containerRect = editorContainer.getBoundingClientRect();
    const newWidth = 100 - ((e.clientX - containerRect.left) / containerRect.width) * 100;
    
    // Limit the panel sizes
    if (newWidth >= 30 && newWidth <= 70) {
      setPreviewWidth(newWidth);
    }
  };

  // Additional horizontal resize handler for notepad
  const startNotepadResize = (e) => {
    e.preventDefault();
    resizingRef.current = "notepad";
    document.addEventListener('mousemove', handleNotepadResize);
    document.addEventListener('mouseup', stopResize);
  };

  const handleNotepadResize = (e) => {
    if (resizingRef.current !== "notepad") return;
    
    const container = document.getElementById('main-container');
    if (!container) return;
    
    const containerRect = container.getBoundingClientRect();
    const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
    
    // Limit the panel sizes (reduced upper limit)
    if (newWidth >= 10 && newWidth <= 20) {
      setNotepadWidth(newWidth);
    }
  };

  const stopResize = () => {
    resizingRef.current = null;
    document.removeEventListener('mousemove', handleHorizontalResize);
    document.removeEventListener('mousemove', handleVerticalResize);
    document.removeEventListener('mouseup', stopResize);
  };

  return (
<>
  {role === "Interviewee" && !isFullscreen && (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md transition-all duration-300 flex items-center justify-center">
      <div className="text-center text-white p-6 rounded-lg bg-black bg-opacity-50 shadow-lg">
        <h1 className="text-2xl font-bold mb-4">Please enter fullscreen mode to continue</h1>
        <button
                  className="bg-gradient-to-r from-[#fb568a] to-[#e456fb] text-white px-4 py-2 rounded shadow hover:opacity-90"
          onClick={() => {
            const elem = document.documentElement;
            if (elem.requestFullscreen) elem.requestFullscreen();
          }}
        >
          Enter Fullscreen
        </button>
      </div>
    </div>
  )}

  <div
            className={`h-screen flex flex-col bg-[#111623] text-white ${
      role === "Interviewee" && !isFullscreen ? "pointer-events-none blur-[1px] select-none" : ""
    }`}
  >
            {/* Top Toolbar */}
            <div className="bg-[#0c1018] border-b border-zinc-800 h-8 px-3 flex items-center justify-between text-xs">
              <div className="flex items-center">
                <img src="/images/codex-logo.svg" alt="Intercoode Logo" className="h-4 w-4 mr-1.5" />
                <span className="font-medium">Interview Room: <span className="font-mono">{roomId}</span></span>
              </div>
              <div className="flex items-center space-x-2">
                <button 
                  onClick={copyRoomLink}
                  className="bg-zinc-800 hover:bg-zinc-700 p-1 rounded text-xs flex items-center gap-1 transition-colors"
                >
                  <ShareIcon />
                  <span>Share</span>
                </button>
                <button 
                  onClick={leaveRoom}
                  className="bg-red-900 hover:bg-red-800 p-1 rounded text-xs flex items-center gap-1 transition-colors"
                >
                  <LeaveIcon />
                  <span>Leave</span>
                </button>
              </div>
            </div>

            {/* View Mode Tabs */}
            <div className="bg-[#0c1018] border-b border-zinc-800 px-2 h-8 flex items-center justify-between">
              <div className="flex">
                <button
                  onClick={() => setActivePanel("editor")}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    activePanel === "editor" 
                      ? "bg-gradient-to-r from-[#fb568a] to-[#e456fb] text-white" 
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  Editor Focus
                </button>
                <button
                  onClick={() => setActivePanel("video")}
                  className={`px-3 py-1 text-xs font-medium rounded-md ml-1 transition-colors ${
                    activePanel === "video" 
                      ? "bg-gradient-to-r from-[#fb568a] to-[#e456fb] text-white" 
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  Question
                </button>
                <button
                  onClick={() => setActivePanel("both")}
                  className={`px-3 py-1 text-xs font-medium rounded-md ml-1 transition-colors ${
                    activePanel === "both" 
                      ? "bg-gradient-to-r from-[#fb568a] to-[#e456fb] text-white" 
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  Split View
                </button>
                {/* Only show AI Assistant button for Interviewer */}
                {role === "Interviewer" && (
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
                )}
                <button
                  onClick={() => {
                    setActivePanel("whiteboard");
                    // Notify server that whiteboard is being activated
                    if (roomId) {
                      console.log("Activating whiteboard view");
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
                {(activePanel === "editor" || (activePanel === "both" && role === "Interviewee")) && (
                  <button
                    onClick={() => setShowNotepad(!showNotepad)}
                    className={`px-3 py-1 text-xs font-medium rounded-md ml-1 transition-colors ${
                      showNotepad 
                        ? "bg-gradient-to-r from-[#fb568a] to-[#e456fb] text-white" 
                        : "text-gray-400 hover:text-white"
                    }`}
                    title={showNotepad ? "Hide Notepad" : "Show Notepad"}
                  >
                    <div className="flex items-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-3.5 w-3.5 mr-1"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                      Notepad
                    </div>
                  </button>
                )}
        </div>

              {/* Room Share Button */}
              <div className="relative mr-2">
                <button
                  onClick={quickCopyRoomLink}
                  className="flex items-center space-x-1 px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded-md text-xs transition-colors"
                  title="Copy room ID"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                  <span className="font-medium">Share Room ID</span>
                </button>
                
                {/* Success Indicator */}
                {shareSuccess && (
                  <div className="absolute right-0 top-full mt-1 bg-green-800 text-white px-2 py-1 rounded text-xs z-10 whitespace-nowrap animate-fade-in">
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
              {/* Notepad in Editor Focus mode or Split View for Interviewee */}
              {showNotepad && (activePanel === "editor" || (activePanel === "both" && role === "Interviewee")) && (
                <div 
                  className="h-full"
                  style={{ width: `${notepadWidth}%` }}
                >
                  <Notepad roomId={roomId} />
                </div>
              )}
              
              {/* Resize Handle for Notepad */}
              {showNotepad && (activePanel === "editor" || (activePanel === "both" && role === "Interviewee")) && (
                <div 
                  className="w-1 bg-zinc-800 hover:bg-[#fb568a] cursor-ew-resize shrink-0"
                  onMouseDown={startNotepadResize}
                ></div>
              )}
              
              {/* Editor Column */}
              {(activePanel === "editor" || activePanel === "both") && (
                <div 
                  className="flex flex-col border-r border-zinc-800"
                  style={{ 
                    width: activePanel === "both" 
                      ? (role === "Interviewee" ? (showNotepad ? `${100 - notepadWidth}%` : "100%") : `${editorWidth}%`)
                      : (activePanel === "editor" && showNotepad)
                        ? `${100 - notepadWidth}%` 
                        : "100%" 
                  }}
                  id="editor-panel"
                >
                  {/* Add mini view components for interviewees in split view */}
                  {activePanel === "both" && role === "Interviewee" && (
                    <>
                      {/* Mini Question View */}
                      <div className="h-[180px] bg-black border-b border-zinc-800 overflow-auto">
                        <div className="bg-zinc-900 px-4 py-2 flex justify-between items-center border-b border-zinc-800">
                          <span className="font-medium text-sm">Question</span>
                        </div>
                        <div className="p-2 h-[150px] overflow-auto">
                          <div className="scale-90 origin-top-left">
                            <IntervieweeQuestion testCases={testCases} setTestCases={setTestCases} />
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                  
                  {/* Editor and Preview Container */}
                  <div 
                    className="flex-1 overflow-hidden flex"
                    style={{ 
                      height: activePanel === "both" && role === "Interviewee" 
                        ? `calc(100% - ${terminalHeight}% - 180px)` 
                        : `${100 - terminalHeight}%` 
                    }}
                    id="editor-container"
                  >
                    {/* Code Editor */}
                    <div 
                      className="h-full flex flex-col bg-black overflow-hidden"
                      style={{ width: showPreview ? `${100 - previewWidth}%` : "100%" }}
                    >
                      {/* Editor Header */}
                      <div className="bg-zinc-900 px-4 py-2 flex justify-between items-center border-b border-zinc-800 shrink-0">
                        <span className="font-medium text-sm">Code Editor</span>
                        <div className="flex items-center space-x-2">
          <select
            value={language}
            onChange={(e) => updateLang(e.target.value)}
                            className="text-xs bg-zinc-800 border border-zinc-700 rounded p-1 focus:outline-none focus:ring-1 focus:ring-purple-500"
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

                          <button
                            onClick={() => setShowPreview(!showPreview)}
                            className={`p-1 rounded text-xs flex items-center ${
                              showPreview ? 'bg-gradient-to-r from-[#fb568a] to-[#e456fb] text-white' : 'bg-zinc-800 text-gray-300'
                            }`}
                            title={showPreview ? "Hide Preview" : "Show Preview"}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 mr-1">
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                              <polyline points="15 3 21 3 21 9"></polyline>
                              <line x1="10" y1="14" x2="21" y2="3"></line>
                            </svg>
                            <span>{showPreview ? "Hide Preview" : "Show Preview"}</span>
                          </button>
                        </div>
                      </div>

                      {/* Editor Body */}
                      <div className="flex-1 overflow-auto">
            <CodeMirror
              value={code}
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
                // For interviewees, always block paste
                // For interviewers, paste is always allowed
                if (role !== "Interviewee") {
                  return true; // Allow paste for interviewer
                }
                
                // Log the paste attempt for debugging
                console.log(`[InterviewRoom] Paste attempt blocked for interviewee`);
                
                // Always block paste for interviewees
                return false;
              }}
            />
          </div>
        </div>

                    {/* Resize Handle */}
                    {showPreview && (
                      <div 
                        className="w-1 bg-zinc-800 hover:bg-[#fb568a] cursor-ew-resize shrink-0"
                        onMouseDown={startPreviewResize}
                      ></div>
                    )}
                    
                    {/* Code Preview */}
                    {showPreview && (
                      <div
                        className="h-full bg-black overflow-hidden"
                        style={{ width: `${previewWidth}%` }}
                      >
                        <CodePreview code={code} language={language} />
                      </div>
                    )}
                  </div>

                  {/* Resize Handle */}
                  <div 
                    className="h-1 bg-zinc-800 hover:bg-[#fb568a] cursor-ns-resize shrink-0"
                    onMouseDown={startVerticalResize}
                  ></div>
                  
                  {/* Terminal Area */}
                  <div 
                    className="overflow-hidden"
                    style={{ height: `${terminalHeight}%` }}
                  >
                    {/* Execution Tab Only */}
                    <div className="flex bg-zinc-900 border-b border-zinc-800 shrink-0">
                      <div className="px-4 py-2 text-xs font-medium bg-black text-white border-b-2 border-[#fb568a]">
                        Code Execution
                      </div>
                    </div>

                    {/* Execution Content */}
                    <div className="h-full bg-black overflow-auto">
          <CodeExecutionArea 
              testCases={testCases} 
              code={code} 
              language={language} 
              roomId={roomId}
              setTestCases={setTestCases}
          />
                    </div>
                  </div>
                </div>
              )}
              
              {/* Resize Handle */}
              {activePanel === "both" && role === "Interviewer" && (
                <div 
                  className="w-1 bg-zinc-800 hover:bg-[#fb568a] cursor-ew-resize"
                  onMouseDown={startHorizontalResize}
                ></div>
              )}
              
              {/* Video and Questions Column */}
              {((activePanel === "video") || (activePanel === "both" && role === "Interviewer")) && (
                <div 
                  className="flex flex-col bg-black"
                  style={{ width: activePanel === "both" ? `${100 - editorWidth}%` : "100%" }}
                >
                  {/* Questions Area - taking full height in video focus mode */}
                  <div className={`flex-1 overflow-auto ${activePanel === "both" ? "pt-0" : "pt-0"}`}>
                    <div className="bg-zinc-900 px-4 py-2 flex justify-between items-center border-b border-zinc-800">
                      <span className="font-medium text-sm">
                        {role === "Interviewer" ? "Questions & Test Cases" : "Interview Questions"}
                      </span>
                    </div>
                    <div className="p-4 overflow-y-auto h-full">
                      {/* Question Components */}
                      {role === "Interviewer" ? (
                        <InterviewerQuestion roomId={roomId} testCases={testCases} setTestCases={setTestCases} />
                      ) : (
                        <div className="mt-4">
                          <IntervieweeQuestion testCases={testCases} setTestCases={setTestCases} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              {/* In split view, show only the code editor on the left and interviewee question on the right - Only for interviewer */}
              {activePanel === "both" && role === "Interviewer" && (
                <div 
                  className="flex flex-col h-full overflow-auto"
                  style={{ width: `${100 - editorWidth}%` }}
                >
                  <div className="bg-zinc-900 px-4 py-2 flex justify-between items-center border-b border-zinc-800">
                    <span className="font-medium text-sm">Question Preview</span>
                  </div>
                  <div className="p-4 h-full overflow-y-auto">
                    <IntervieweeQuestion testCases={testCases} setTestCases={setTestCases} />
                  </div>
                </div>
              )}
              
              {/* AI Assistant Panel - Only shown for Interviewer */}
              {activePanel === "ai" && role === "Interviewer" && (
                <div className="flex flex-col w-full h-full bg-black border-l border-zinc-800">
                  <div className="bg-zinc-900 px-4 py-2 flex justify-between items-center border-b border-zinc-800">
                    <div className="flex items-center">
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        className="h-4 w-4 mr-2 text-[#fb568a]" 
                        viewBox="0 0 20 20" 
                        fill="currentColor"
                      >
                        <path 
                          fillRule="evenodd" 
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" 
                          clipRule="evenodd" 
                        />
                      </svg>
                      <span className="font-medium text-sm">AI Coding Assistant</span>
                    </div>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <AiChat roomId={roomId} />
                  </div>
                </div>
              )}

              {/* Whiteboard Panel */}
              {activePanel === "whiteboard" && (
                <div className="flex flex-col w-full h-full bg-black border-l border-zinc-800">
                  <div className="bg-zinc-900 px-4 py-2 flex justify-between items-center border-b border-zinc-800">
                    <div className="flex items-center">
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        className="h-4 w-4 mr-2 text-[#fb568a]" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3Z"></path>
                      </svg>
                      <span className="font-medium text-sm">Collaborative Whiteboard</span>
                    </div>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <Whiteboard roomId={roomId} />
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
</>
  );
};

export default InterviewRoom;