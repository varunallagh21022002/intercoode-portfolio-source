import React from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

const LandingPage = () => {
  const navigate = useNavigate();
  
  const handleRoute = () => {
    navigate("/Home");
  };

  return (
    <div className="min-h-screen bg-[#111623] text-white font-sans-serif box-border overflow-x-hidden">
      {/* Hero Section */}
      <main className="dark relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden">
        <div className="w-full max-w-md p-4 sm:p-8">
          <div className="mb-6 space-y-6 text-center">
            <div className="flex flex-col items-center">
              <img
                src="/images/codex-logo.svg"
                alt="Intercoode Logo"
                className="size-12 mb-4"
                width="48"
                height="48"
              />
              <h1 className="text-foreground text-4xl font-bold tracking-tight sm:text-5xl">
                Code together now on <span className="bg-gradient-to-r from-[#fb568a] to-[#e456fb] bg-clip-text text-transparent">Intercoode</span>
          </h1>
            </div>
            <p className="text-foreground/90 text-lg sm:text-xl">
              Your collaborative coding space for Interview reimagined. Start now, no
              sign-up required.
          </p>
          </div>

          <div className="flex justify-center mt-8">
          <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-gradient-to-r from-[#fb568a] to-[#e456fb] px-6 py-3 rounded-lg text-white text-lg transition duration-300"
            onClick={handleRoute}
          >
            Get Started →
          </motion.button>
          </div>
        </div>
      </main>

      {/* Features Section */}
      <section className="w-full py-20 bg-[#111623] px-6">
  <h2 className="text-4xl font-bold text-center mb-16 tracking-wide">Core Features</h2>
  <div className="grid md:grid-cols-3 gap-10">
    
    <div className="bg-zinc-800 p-8 rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
      <h3 className="text-2xl font-semibold mb-4 group-hover:text-zinc-400 transition-colors">Real-time Code Sync</h3>
      <p className="text-gray-300 text-sm leading-relaxed">
        Collaborate live with seamless synchronization using CodeMirror and Socket.io.
      </p>
    </div>

    <div className="bg-zinc-800 p-8 rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
            <h3 className="text-2xl font-semibold mb-4 group-hover:text-zinc-400 transition-colors">Game Room</h3>
      <p className="text-gray-300 text-sm leading-relaxed">
              Connect with participants in thrilling timed sessions with live chat and language selection.
      </p>
    </div>

    <div className="bg-zinc-800 p-8 rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
      <h3 className="text-2xl font-semibold mb-4 group-hover:text-zinc-400 transition-colors">AI Proctoring</h3>
      <p className="text-gray-300 text-sm leading-relaxed">
        Face tracking, tab monitoring, and voice detection ensure fair interviews.
      </p>
    </div>

  </div>
</section>

      {/* How It Works Section */}
      <section className="w-full py-20 px-6 lg:px-32 text-white">
        <h2 className="text-4xl font-bold text-center mb-16 tracking-wide">How Intercoode Works</h2>
  <div className="grid md:grid-cols-3 gap-12 text-center">
    
    <div className="p-6 bg-zinc-900 rounded-2xl shadow-lg hover:scale-105 transition-transform duration-300">
      <div className="text-5xl mb-4 text-zinc-300 font-extrabold">1</div>
      <h3 className="text-2xl font-semibold mb-3">Join a Room</h3>
      <p className="text-gray-300 text-sm leading-relaxed">
              Choose your mode — Interview or Game Room — and enter a room.
        For Interview, the interviewer must join first. Both users should enter the same room name and click "Join".
      </p>
    </div>
    
    <div className="p-6 bg-zinc-900 rounded-2xl shadow-lg hover:scale-105 transition-transform duration-300">
      <div className="text-5xl mb-4 text-zinc-300 font-extrabold">2</div>
      <h3 className="text-2xl font-semibold mb-3">Start Coding</h3>
      <p className="text-gray-300 text-sm leading-relaxed">
        Code in real time with seamless syncing and collaborative features built for productivity.
      </p>
    </div>
    
    <div className="p-6 bg-zinc-900 rounded-2xl shadow-lg hover:scale-105 transition-transform duration-300">
      <div className="text-5xl mb-4 text-zinc-300 font-extrabold">3</div>
      <h3 className="text-2xl font-semibold mb-3">Get Proctored</h3>
      <p className="text-gray-300 text-sm leading-relaxed">
        Our advanced AI watches for distractions, tracks eye movement, and more — available in Interview only.
      </p>
    </div>

  </div>
</section>

      {/* Footer */}
      <footer className="w-full bg-zinc-950 text-center py-10 text-gray-400 text-sm">
        © 2025 Intercoode. Built for next-gen coding interview experiences.
      </footer>
    </div>
  );
};

export default LandingPage;