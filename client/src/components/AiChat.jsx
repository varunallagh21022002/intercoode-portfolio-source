import React, { useState, useRef, useEffect } from 'react';
import socket from "../api/sockets";

// OpenRouter API key (should be moved to an environment variable in production)
const OPENROUTER_API_KEY = ""; // Disabled in the public snapshot.
const API_URL = 'https://openrouter.ai/api/v1/chat/completions';

const AiChat = ({ roomId }) => {
  const [messages, setMessages] = useState([
    {
      role: 'system',
      content: 'You are a helpful coding assistant. Provide concise, accurate answers to coding questions.'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Intercoode AI Assistant'
        },
        body: JSON.stringify({
          model: 'mistralai/mistral-7b-instruct', // Affordable, fast model
          messages: [...messages, userMessage],
          temperature: 0.7,
          max_tokens: 1024
        })
      });

      const data = await response.json();
      
      if (data.choices && data.choices[0]?.message) {
        setMessages((prev) => [...prev, data.choices[0].message]);
        
        // Share AI message with other participants in the room
        if (roomId) {
          socket.emit("ai-chat-message", { message: data.choices[0].message, roomId });
        }
      } else {
        console.error('Unexpected API response:', data);
        const errorMsg = { 
          role: 'assistant', 
          content: 'Sorry, I encountered an error processing your request.' 
        };
        setMessages((prev) => [...prev, errorMsg]);
        
        // Share error message with other participants
        if (roomId) {
          socket.emit("ai-chat-message", { message: errorMsg, roomId });
        }
      }
    } catch (error) {
      console.error('Error calling OpenRouter API:', error);
      const errorMsg = { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error. Please try again later.' 
      };
      setMessages((prev) => [...prev, errorMsg]);
      
      // Share error message with other participants
      if (roomId) {
        socket.emit("ai-chat-message", { message: errorMsg, roomId });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Listen for AI chat messages from other participants
  useEffect(() => {
    socket.on("ai-chat-message", (msg) => {
      if (!messages.some(m => 
        m.role === msg.message.role && 
        m.content === msg.message.content)) {
        setMessages(prev => [...prev, msg.message]);
      }
    });

    return () => {
      socket.off("ai-chat-message");
    };
  }, [messages]);

  return (
    <div className="p-4 shadow-md rounded-lg flex-1 flex flex-col text-white" style={{ backgroundColor: "hsl(0, 0%, 6%)", height: "100%" }}>
      {/* Header */}
      <div className="flex justify-between items-center mb-2">
        <h2 className="font-semibold text-white">AI Assistant</h2>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto mb-3 border border-gray-700 rounded-lg p-3 bg-[hsl(0,0%,10%)]" style={{ height: "calc(100% - 80px)" }}>
        <div className="space-y-3">
          {messages.filter(m => m.role !== 'system').map((message, i) => (
            <div 
              key={i}
              className={`p-2 rounded-lg ${
                message.role === 'user' 
                  ? 'bg-blue-600 text-white ml-auto max-w-[80%]' 
                  : 'bg-[hsl(0,0%,18%)] max-w-[80%]'
              }`}
            >
              <div className="text-sm whitespace-pre-wrap break-words">
                {message.content}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a coding question..."
          disabled={isLoading}
          className="flex-1 p-2 bg-[hsl(0,0%,14%)] border border-gray-700 rounded text-white"
        />
        <button
          onClick={handleSend}
          disabled={isLoading || !input.trim()}
          className={`px-4 py-2 rounded transition-colors ${
            isLoading || !input.trim() ? 'bg-gray-700' : 'bg-green-600 hover:bg-green-700'
          }`}
        >
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
};

export default AiChat; 