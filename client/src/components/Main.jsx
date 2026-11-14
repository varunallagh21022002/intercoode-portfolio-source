import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';

const Main = () => {
const navigate = useNavigate();

const handleGameModeClick = () => {
  navigate('/game-mode');
};

const handleInterviewModeClick = () => {
  navigate('/Interview-mode');
};

return (
  <div className="min-h-screen bg-[#111623]">
    <div className="container mx-auto px-4 pt-16 pb-12">
      <div className="flex justify-center mb-8">
        <img
          src="/images/codex-logo.svg"
          alt="Intercoode Logo"
          className="h-16 w-16"
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Interview Section */}
        <div className="bg-zinc-800 p-8 rounded-2xl shadow-xl border border-gray-500 hover:border-gray-100 transition-all duration-300">
          <div className="space-y-6">
            <h1 className="text-3xl font-bold text-white mb-4 bg-clip-text">
              Interview
            </h1>
            <p className="text-gray-300 leading-relaxed">
              Interview provides a structured environment for conducting coding assessments in real-time. It includes live video calls, real-time coding collaboration, and instant messaging between interviewers and candidates. The system ensures a seamless experience with features like role-based access, automated proctoring, and code execution, enabling fair and efficient evaluations.
            </p>
            <button
              onClick={handleInterviewModeClick}
              className="bg-gradient-to-r from-[#fb568a] to-[#e456fb] text-white px-6 py-3 rounded-lg font-medium hover:opacity-90 transition-all duration-300 shadow-lg"
            >
              Interview
            </button>
          </div>
        </div>

        {/* Game Room Section */}
        <div className="flex-1 p-6 bg-zinc-800 rounded-2xl shadow-lg">
          <Link to="/Game-mode" className="text-xl font-bold text-white hover:text-gray-300 flex items-center">
            <span className="mr-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-7 h-7 text-[#fb568a]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 12h14M12 5v14"
                />
              </svg>
            </span>
            Game Room
          </Link>
          <p className="mt-4 text-gray-300 text-sm leading-relaxed">
            Game Room mode features two separate code compilers for each participant, enabling them to collaborate or compete on coding challenges. It promotes interactive learning by allowing both users to solve problems simultaneously.
          </p>
          <Link to="/Game-mode" className="mt-6 inline-block px-6 py-2.5 bg-gradient-to-r from-[#fb568a] to-[#e456fb] text-white font-medium text-xs rounded shadow-md hover:bg-purple-700 transition-colors">
            Try Game Room
          </Link>
        </div>
      </div>
    </div>
  </div>
);
};

export default Main;