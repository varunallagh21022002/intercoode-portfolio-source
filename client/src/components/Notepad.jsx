import React, { useState, useEffect, useRef } from 'react';
import socket from '../api/sockets';
import { useRole } from '../context/RoleContext';
import MiniVideoCall from './MiniVideoCall';

const Notepad = ({ roomId }) => {
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(true);
  const [showVideos, setShowVideos] = useState(true);
  const { role } = useRole();
  const scrollContainerRef = useRef(null);
  
  // Handle horizontal scrolling with mouse wheel
  const handleWheel = (e) => {
    if (scrollContainerRef.current) {
      e.preventDefault();
      scrollContainerRef.current.scrollLeft += e.deltaY;
    }
  };

  // Initial load of notes
  useEffect(() => {
    // Try to load notes from localStorage first
    const savedNotes = localStorage.getItem(`notes-${roomId}`);
    if (savedNotes) {
      setNotes(savedNotes);
    }

    // Listen for notes updates from the server
    socket.on('receive-notes', ({ notes }) => {
      console.log('Received notes update');
      setNotes(notes);
      // Also save to localStorage
      localStorage.setItem(`notes-${roomId}`, notes);
      setSaved(true);
    });

    return () => {
      socket.off('receive-notes');
    };
  }, [roomId]);

  // Handle notes changes
  const handleNotesChange = (e) => {
    setNotes(e.target.value);
    setSaved(false);
    
    // Debounced save (both local and to server)
    const saveTimeout = setTimeout(() => {
      localStorage.setItem(`notes-${roomId}`, e.target.value);
      socket.emit('send-notes', { notes: e.target.value, roomId });
      setSaved(true);
    }, 1000);
    
    return () => clearTimeout(saveTimeout);
  };

  return (
    <div className="h-full flex flex-col bg-[#111623] border-r border-zinc-800">
      <div className="bg-zinc-900 px-4 py-2 flex justify-between items-center border-b border-zinc-800 shrink-0">
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
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
          <span className="font-medium text-sm">Notes</span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowVideos(!showVideos)}
            className={`p-1 rounded text-xs flex items-center ${
              showVideos ? 'text-[#fb568a]' : 'text-gray-400'
            }`}
            title={showVideos ? "Hide Videos" : "Show Videos"}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor" 
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="23 7 16 12 23 17 23 7"></polygon>
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
            </svg>
          </button>
          <div className="text-xs text-gray-400">
            {saved ? 'Saved' : 'Saving...'}
          </div>
        </div>
      </div>
      
      {/* Mini Video Call Component */}
      {showVideos && <MiniVideoCall roomId={roomId} showDebug={false} />}
      
      {/* Notes Textarea */}
      <textarea
        value={notes}
        onChange={handleNotesChange}
        className="flex-1 w-full p-3 bg-transparent text-white resize-none focus:outline-none text-sm"
        placeholder="Type your notes here..."
      />
    </div>
  );
};

export default Notepad; 