import { useEffect, useState, useRef } from "react";
import socket from "../api/sockets";

export const useIntervieweeRestrictions = (role, roomId) => {
  const [allowPaste, setAllowPaste] = useState(false);
  const allowPasteRef = useRef(false);

  useEffect(() => {
    // Update the ref when state changes
    allowPasteRef.current = allowPaste;
    console.log(`[useIntervieweeRestrictions] allowPaste set to: ${allowPaste}`);
  }, [allowPaste]);

  useEffect(() => {
    if (role !== "Interviewee") return;
    
    console.log(`[useIntervieweeRestrictions] Setting up restrictions for Interviewee in room ${roomId}`);

    // Listen for paste restriction toggle - but we'll ignore it and keep paste blocked
    socket.on("toggle-paste-restriction", ({ allow }) => {
      console.log(`[useIntervieweeRestrictions] Received paste toggle: ${allow ? 'allowed' : 'blocked'}, but keeping paste blocked`);
      // Ignoring the allow value and always keeping paste disabled
      setAllowPaste(false);
      allowPasteRef.current = false;
      
      // Show visual feedback
      const notification = document.createElement('div');
      notification.style.position = 'fixed';
      notification.style.top = '10px';
      notification.style.right = '10px';
      notification.style.padding = '10px 15px';
      notification.style.backgroundColor = '#F44336';
      notification.style.color = 'white';
      notification.style.borderRadius = '4px';
      notification.style.zIndex = '9999';
      notification.style.fontFamily = 'Arial, sans-serif';
      notification.style.transition = 'opacity 0.5s';
      notification.textContent = 'Paste is blocked in this interview';
      
      document.body.appendChild(notification);
      
      // Remove after 3 seconds
      setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
          document.body.removeChild(notification);
        }, 500);
      }, 3000);
    });

    // Tab switch detection
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.warn("[useIntervieweeRestrictions] Tab switch detected");
        socket.emit("violation", { type: "tab-switch", roomId });
      }
    };

    // Block all related events including paste
    const handleEvent = (e) => {
      const eventType = e.type;
      console.log(`[useIntervieweeRestrictions] Blocking ${eventType} event`);
      e.preventDefault();
      e.stopPropagation();
      socket.emit("violation", { type: eventType, roomId });
    };

    // Handle keyboard shortcuts
    const handleKeyDown = (e) => {
      // Block all clipboard-related shortcuts
      if ((e.ctrlKey || e.metaKey) && ["c", "v", "x", "a"].includes(e.key.toLowerCase())) {
        console.log(`[useIntervieweeRestrictions] Blocking ${e.key} shortcut`);
        e.preventDefault();
        e.stopPropagation();
        socket.emit("violation", { type: `shortcut-${e.key}`, roomId });
      }
    };

    // Enhanced debug logging
    console.log('[useIntervieweeRestrictions] Setting up event listeners with paste blocked');

    // Attach all event listeners with useCapture=true
    document.addEventListener("visibilitychange", handleVisibilityChange, true);
    document.addEventListener("copy", handleEvent, true);
    document.addEventListener("paste", handleEvent, true);
    document.addEventListener("cut", handleEvent, true);
    document.addEventListener("contextmenu", handleEvent, true);
    document.addEventListener("keydown", handleKeyDown, true);

    console.log(`[useIntervieweeRestrictions] All listeners attached, paste is blocked`);

    // Cleanup
    return () => {
      socket.off("toggle-paste-restriction");
      document.removeEventListener("visibilitychange", handleVisibilityChange, true);
      document.removeEventListener("copy", handleEvent, true);
      document.removeEventListener("paste", handleEvent, true);
      document.removeEventListener("cut", handleEvent, true);
      document.removeEventListener("contextmenu", handleEvent, true);
      document.removeEventListener("keydown", handleKeyDown, true);
      console.log('[useIntervieweeRestrictions] All listeners removed');
    };
  }, [role, roomId]); // Don't include allowPaste in the dependency array

  // Return the current state for external components to check
  return { allowPaste: false }; // Always return false to block paste
};
