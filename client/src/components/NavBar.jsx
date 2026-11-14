import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import { motion } from "framer-motion";


const NavBar = () => {
  const { loginWithRedirect, isAuthenticated, logout } = useAuth0();

  const handleLogout = () => {
    logout({ 
      logoutParams: {
        returnTo: window.location.origin 
      }
    });
  };

  return (
    <nav className="bg-linear-to-bl from-zinc-800 to-black text-white fixed top-0 w-full shadow-md z-50 font-sans-serif">
      <div className="w-full px-4">
        <div className="flex justify-between items-center h-10">
          {/* Logo - Left Side */}
          <div className="text-base font-bold flex items-center">
            <img
              src="/images/codex-logo.svg"
              alt="Intercoode Logo"
              className="h-5 w-5 mr-1.5"
            />
            <Link to="/" >Intercoode</Link>
          </div>

          {/* Navigation Links - Right Side */}
          <ul className="flex gap-4 items-center">
            <>
              <li>
                <Link to="/Home" className="text-sm hover:text-gray-400">Home</Link>
              </li>
              <li>
                <Link to="/Interview-mode" className="text-sm hover:text-gray-400">Interview</Link>
              </li>
              <li>
                <Link to="/Game-mode" className="text-sm hover:text-gray-400">Game Room</Link>
              </li>
            </>

            <li>
              {isAuthenticated ? (
                <motion.button
                  onClick={handleLogout} 
                  className="bg-red-700 hover:bg-red-600 px-2.5 py-1 rounded-lg text-xs">
                  Logout
                </motion.button>
              ) : (
                <motion.button
                  onClick={() => loginWithRedirect()} 
                  className="bg-gradient-to-r from-[#fb568a] to-[#e456fb] hover:opacity-90 px-2.5 py-1 rounded-lg text-xs">
                  Log In
                </motion.button>
              )}
            </li>
          </ul>
        </div>
      </div>
      {/* White horizontal line */}
      <div className="h-[1px] w-full bg-white/80"></div>
    </nav>
  );
};

export default NavBar;
