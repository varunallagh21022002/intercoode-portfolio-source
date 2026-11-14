import React, { useCallback, useEffect, useRef, useState } from 'react';
import socket from '../api/sockets';

const Whiteboard = ({ roomId }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(5);
  const [tool, setTool] = useState('pencil');
  const [lastX, setLastX] = useState(0);
  const [lastY, setLastY] = useState(0);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [syncNotification, setSyncNotification] = useState(null);
  const [isActivated, setIsActivated] = useState(false);
  const hasActivatedRef = useRef(false); // Track if we've already activated the whiteboard

  const colors = ['#000000', '#FB568A', '#E456FB', '#ff0000', '#00ff00', '#0000ff', '#ffff00'];

  const draw = useCallback(
    (action, emit = true) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (action.type === 'clear') {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Fill canvas with white background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Make sure we emit clear actions
        if (emit) {
          socket.emit('whiteboard-update', { action, roomId });
          console.log('Emitting clear action to room:', roomId);
        }
        return;
      }

      if (
        action.type === 'draw' &&
        action.x0 !== undefined &&
        action.y0 !== undefined &&
        action.x1 !== undefined &&
        action.y1 !== undefined &&
        action.color !== undefined &&
        action.lineWidth !== undefined
      ) {
        ctx.beginPath();
        ctx.moveTo(action.x0, action.y0);
        ctx.lineTo(action.x1, action.y1);
        ctx.strokeStyle = action.color;
        ctx.lineWidth = action.lineWidth;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.closePath();
      }

      if (emit) {
        socket.emit('whiteboard-update', { action, roomId });
      }
    },
    [roomId]
  );

  // Apply multiple drawing actions (for history loading)
  const applyActions = useCallback((actions) => {
    if (!Array.isArray(actions) || actions.length === 0) return;
    
    console.log(`Applying ${actions.length} whiteboard actions from history`);
    
    actions.forEach(action => {
      draw(action, false);
    });
  }, [draw]);

  const handleMouseDown = useCallback(
    (e) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      setIsDrawing(true);
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setLastX(x);
      setLastY(y);
    },
    []
  );

  const handleMouseMove = useCallback(
    (e) => {
      if (!isDrawing) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const drawAction = {
        type: 'draw',
        x0: lastX,
        y0: lastY,
        x1: x,
        y1: y,
        color: tool === 'eraser' ? '#FFFFFF' : color,
        lineWidth: tool === 'eraser' ? 20 : lineWidth,
      };

      draw(drawAction);

      setLastX(x);
      setLastY(y);
    },
    [isDrawing, lastX, lastY, color, tool, lineWidth, draw]
  );

  const handleMouseUp = useCallback(() => {
    setIsDrawing(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsDrawing(false);
  }, []);

  const clearCanvas = useCallback(() => {
    console.log('Clearing canvas for room:', roomId);
    const clearAction = { 
      type: 'clear',
      id: `clear-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
      timestamp: new Date().toISOString()
    };
    
    draw(clearAction);
  }, [draw, roomId]);

  const handleShareWhiteboard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    try {
      // Convert canvas to image data URL
      const imageData = canvas.toDataURL('image/png');
      
      // Create a temporary link element
      const tempLink = document.createElement('a');
      tempLink.href = imageData;
      tempLink.download = `whiteboard-${roomId}-${new Date().toISOString().slice(0, 10)}.png`;
      
      // Simulate click to trigger download
      document.body.appendChild(tempLink);
      tempLink.click();
      document.body.removeChild(tempLink);
      
      // Show success message
      setShareModalOpen(true);
      setTimeout(() => setShareModalOpen(false), 3000);
    } catch (error) {
      console.error("Error sharing whiteboard:", error);
      alert("Failed to share whiteboard. Please try again.");
    }
  };

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas size
    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
      
      // Fill with background color
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  // Handle whiteboard activation and sync
  useEffect(() => {
    if (!roomId) return;
    
    // Only activate the whiteboard if it hasn't been activated yet
    // This prevents re-activation when switching tabs
    if (!hasActivatedRef.current) {
      console.log(`Activating whiteboard for room ${roomId}`);
      socket.emit('whiteboard-activated', { roomId });
      setIsActivated(true);
      hasActivatedRef.current = true;
    }
    
    // Handle notification when other users activate the whiteboard
    const handleWhiteboardActivation = ({ activatedBy }) => {
      console.log(`Whiteboard activated by another user: ${activatedBy}`);
      setSyncNotification({
        message: 'Another user joined the whiteboard',
        type: 'info',
      });
      
      // Hide notification after 3 seconds
      setTimeout(() => {
        setSyncNotification(null);
      }, 3000);
    };
    
    // Handle receiving whiteboard history
    const handleWhiteboardHistory = ({ actions }) => {
      console.log(`Received whiteboard history with ${actions.length} actions`);
      if (actions && actions.length > 0) {
        applyActions(actions);
        setSyncNotification({
          message: 'Whiteboard synchronized',
          type: 'success',
        });
        
        // Hide notification after 3 seconds
        setTimeout(() => {
          setSyncNotification(null);
        }, 3000);
      }
    };
    
    socket.on('whiteboard-activated', handleWhiteboardActivation);
    socket.on('whiteboard-history', handleWhiteboardHistory);
    
    return () => {
      socket.off('whiteboard-activated', handleWhiteboardActivation);
      socket.off('whiteboard-history', handleWhiteboardHistory);
    };
  }, [roomId, applyActions]);

  // Handle drawing updates from other clients
  useEffect(() => {
    const handleRemoteDrawing = ({ action }) => {
      if (action.type === 'clear') {
        console.log('Received clear action from another user');
      }
      draw(action, false);
    };

    socket.on('whiteboard-update', handleRemoteDrawing);

    return () => {
      socket.off('whiteboard-update', handleRemoteDrawing);
    };
  }, [draw]);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="bg-zinc-900 p-2 flex items-center justify-between border-b border-zinc-800">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setTool('pencil')}
            className={`p-1.5 rounded-md ${
              tool === 'pencil' 
                ? 'bg-gradient-to-r from-[#fb568a] to-[#e456fb] text-white' 
                : 'bg-zinc-800 text-gray-300 hover:text-white'
            }`}
            title="Pencil"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3Z"></path>
            </svg>
          </button>
          
          <button
            onClick={() => setTool('eraser')}
            className={`p-1.5 rounded-md ${
              tool === 'eraser' 
                ? 'bg-gradient-to-r from-[#fb568a] to-[#e456fb] text-white' 
                : 'bg-zinc-800 text-gray-300 hover:text-white'
            }`}
            title="Eraser"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"></path>
              <path d="M22 21H7"></path>
              <path d="m5 11 9 9"></path>
            </svg>
          </button>
          
          <button
            onClick={clearCanvas}
            className="p-1.5 rounded-md bg-zinc-800 text-gray-300 hover:text-white"
            title="Clear Canvas"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <path d="M3 6h18"></path>
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
            </svg>
          </button>
          
          <select
            value={lineWidth}
            onChange={(e) => setLineWidth(parseInt(e.target.value))}
            className="text-xs bg-zinc-800 border border-zinc-700 rounded p-1 focus:outline-none focus:ring-1 focus:ring-purple-500 text-white"
          >
            <option value="3">Thin</option>
            <option value="5">Medium</option>
            <option value="8">Thick</option>
            <option value="12">Extra Thick</option>
          </select>
        </div>
        
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1">
            {colors.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-5 h-5 rounded-full ${
                  color === c ? 'ring-2 ring-white' : ''
                }`}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>
          
          <button
            onClick={handleShareWhiteboard}
            className="flex items-center space-x-1 p-1.5 rounded-md bg-gradient-to-r from-[#fb568a] to-[#e456fb] text-white"
            title="Share Whiteboard"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
              <polyline points="16 6 12 2 8 6"></polyline>
              <line x1="12" y1="2" x2="12" y2="15"></line>
            </svg>
            <span className="text-xs font-medium">Share</span>
          </button>
        </div>
      </div>
      
      {/* Canvas */}
      <div className="flex-1 relative">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full cursor-crosshair"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        />
        
        {/* Synchronization Status */}
        {syncNotification && (
          <div className={`absolute top-2 right-2 px-3 py-1.5 rounded-md shadow-lg text-sm flex items-center transition-opacity duration-300 ${
            syncNotification.type === 'success' ? 'bg-green-700 text-white' : 'bg-blue-700 text-white'
          }`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {syncNotification.message}
          </div>
        )}
      </div>
      
      {/* Share Success Modal */}
      {shareModalOpen && (
        <div className="absolute bottom-4 right-4 bg-green-800 text-white px-4 py-2 rounded-md shadow-lg flex items-center space-x-2 animate-fade-in">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
          <span>Whiteboard downloaded successfully!</span>
        </div>
      )}
    </div>
  );
};

export default Whiteboard; 