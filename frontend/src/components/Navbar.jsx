import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname.startsWith(path);

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center space-x-8">
            <Link to="/groups" className="flex items-center">
              <span className="text-2xl font-extrabold tracking-tight text-teal-600 font-display">
                SplitSmart
              </span>
            </Link>
            <div className="hidden md:flex space-x-4">
              <Link
                to="/groups"
                className={`px-3 py-2 rounded-md text-sm font-semibold transition-colors duration-150 ${
                  isActive('/groups')
                    ? 'bg-teal-50 text-teal-700'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                My Groups
              </Link>
              <Link
                to="/import"
                className={`px-3 py-2 rounded-md text-sm font-semibold transition-colors duration-150 ${
                  isActive('/import')
                    ? 'bg-teal-50 text-teal-700'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                Import CSV
              </Link>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-full bg-teal-500 flex items-center justify-center text-white font-bold text-sm">
                {user?.fullName?.charAt(0).toUpperCase()}
              </div>
              <span className="hidden sm:inline text-sm font-semibold text-slate-700">
                {user?.fullName}
              </span>
            </div>
            
            <button
              onClick={handleLogout}
              className="px-4 py-2 border border-slate-300 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-950 transition-colors duration-150"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
