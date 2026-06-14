import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';

const Groups = () => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/api/groups');
      setGroups(data);
      setError('');
    } catch (err) {
      console.error(err);
      setError('Failed to load groups. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) {
      setModalError('Group name is required');
      return;
    }

    setModalLoading(true);
    setModalError('');

    try {
      await api.post('/api/groups', {
        name: newGroupName.trim(),
        description: newGroupDesc.trim()
      });
      setNewGroupName('');
      setNewGroupDesc('');
      setShowModal(false);
      fetchGroups();
    } catch (err) {
      console.error(err);
      setModalError(err.response?.data?.message || 'Failed to create group.');
    } finally {
      setModalLoading(false);
    }
  };

  return (
    <div className="w-full">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">My Groups</h1>
          <p className="text-slate-500 font-medium text-sm mt-1">Select a group or create a new one to start tracking splits</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all duration-150 flex items-center justify-center gap-1.5 self-start sm:self-auto"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
          </svg>
          New Group
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm font-semibold flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {error}
        </div>
      )}

      {/* Main Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <div key={n} className="border border-slate-200 rounded-2xl p-6 bg-white shadow-sm flex flex-col justify-between gap-4 animate-pulse">
              <div className="flex-1 space-y-3">
                <div className="h-6 bg-slate-200 rounded w-2/3"></div>
                <div className="h-4 bg-slate-200 rounded w-full"></div>
              </div>
              <div className="h-10 bg-slate-200 rounded-xl mt-4"></div>
            </div>
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-3xl shadow-sm max-w-xl mx-auto p-8 flex flex-col items-center justify-center">
          <div className="w-16 h-16 bg-teal-50 border border-teal-100 text-teal-600 rounded-full flex items-center justify-center mb-4 shadow-sm">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-slate-800">No Groups Found</h3>
          <p className="text-slate-500 text-sm mt-1 max-w-sm">Create a group above or join one to begin splitting expenses with friends.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map((group) => {
            const isOwed = group.netBalance > 0.005;
            const owes = group.netBalance < -0.005;

            let balancePill = (
              <span className="text-xs font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-3 py-1 rounded-full">
                Settled up
              </span>
            );

            if (isOwed) {
              balancePill = (
                <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
                  You are owed: ₹{group.netBalance.toFixed(2)}
                </span>
              );
            } else if (owes) {
              balancePill = (
                <span className="text-xs font-bold text-rose-800 bg-rose-50 border border-rose-200 px-3 py-1 rounded-full">
                  You owe: ₹{Math.abs(group.netBalance).toFixed(2)}
                </span>
              );
            }

            return (
              <Link
                key={group.id}
                to={`/groups/${group.id}`}
                className="border border-slate-200 rounded-2xl bg-white shadow-sm p-6 flex flex-col justify-between hover:shadow-md transition-all duration-200 group border-l-4 border-l-teal-500"
              >
                <div>
                  <h3 className="font-bold text-lg text-slate-800 group-hover:text-teal-600 transition-colors duration-150 line-clamp-1 mb-1">
                    {group.name}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mb-3 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
                  </p>
                  {group.description && (
                    <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed mb-4">
                      {group.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-2">
                  {balancePill}
                  <span className="text-xs font-bold text-teal-600 group-hover:translate-x-1 transition-transform duration-150 flex items-center gap-0.5">
                    View
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* New Group Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 relative">
            <button
              onClick={() => {
                setShowModal(false);
                setModalError('');
              }}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors duration-150"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h2 className="text-xl font-extrabold text-slate-900 mb-2">Create New Group</h2>
            <p className="text-xs text-slate-500 font-medium mb-6">Group entries will let you split custom expenses among friends</p>

            {modalError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs font-semibold">
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Group Name
                </label>
                <input
                  type="text"
                  required
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="e.g. Flat Expenses"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all duration-150"
                  disabled={modalLoading}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Description
                </label>
                <textarea
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  placeholder="e.g. Shared expenses for Apartment 4B"
                  rows="3"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all duration-150 resize-none"
                  disabled={modalLoading}
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setModalError('');
                  }}
                  disabled={modalLoading}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors duration-150"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all duration-150 disabled:opacity-50 flex items-center gap-1"
                >
                  {modalLoading && (
                    <div className="w-4 h-4 border-2 border-solid border-white border-t-transparent animate-spin rounded-full"></div>
                  )}
                  Create Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Groups;
