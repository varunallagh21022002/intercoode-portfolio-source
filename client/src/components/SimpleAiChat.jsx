import React from 'react';

const SimpleAiChat = ({ roomId }) => {
  return (
    <div className="p-4">
      <h2 className="text-lg font-bold mb-4">AI Assistant</h2>
      <p className="mb-4">This is a simple AI chat interface (Room ID: {roomId})</p>
      
      <div className="p-4 border border-gray-700 rounded-md bg-gray-900 mb-4">
        <p>Here you can ask questions about code and get AI assistance.</p>
      </div>
      
      <div className="flex">
        <input 
          type="text"
          placeholder="Type your question..."
          className="flex-1 p-2 bg-gray-800 border border-gray-700 rounded-l text-white"
        />
        <button className="bg-gradient-to-r from-[#fb568a] to-[#e456fb] text-white px-4 py-2 rounded-r">
          Send
        </button>
      </div>
    </div>
  );
};

export default SimpleAiChat; 