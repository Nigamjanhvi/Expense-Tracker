import React, { useState } from 'react';

const getInitials = (name) => {
  if (!name) return '';
  return name
    .split(' ')
    .filter(Boolean)
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

const MemberChip = ({ membership, onMarkLeft }) => {
  const { id, joinedAt, leftAt, user } = membership;
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [leftDate, setLeftDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);

  const initials = getInitials(user.fullName);

  const formatDate = (dateVal) => {
    if (!dateVal) return '';
    return new Date(dateVal).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const handleConfirmLeft = async () => {
    if (!leftDate) return;
    setLoading(true);
    try {
      await onMarkLeft(id, leftDate);
      setShowDatePicker(false);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const isLeft = !!leftAt;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white border border-slate-200 rounded-xl shadow-sm gap-4 transition-all duration-150 hover:shadow-md">
      {/* Left: Avatar, Name, Email */}
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white shadow-inner bg-teal-600`}>
          {initials}
        </div>
        <div>
          <h4 className="font-semibold text-slate-800 text-sm line-clamp-1">{user.fullName}</h4>
          <p className="text-xs text-slate-500 line-clamp-1">{user.email}</p>
        </div>
      </div>

      {/* Middle & Right: Joined info and Action */}
      <div className="flex flex-wrap items-center justify-between sm:justify-end gap-4">
        <div className="text-right">
          <p className="text-xs text-slate-600">
            Joined: <span className="font-medium text-slate-800">{formatDate(joinedAt)}</span>
          </p>
          {isLeft ? (
            <p className="text-xs text-slate-400 mt-0.5 italic">
              Left: <span className="font-medium">{formatDate(leftAt)}</span>
            </p>
          ) : (
            <div className="flex items-center justify-end gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs font-semibold text-emerald-700">Active</span>
            </div>
          )}
        </div>

        {!isLeft && (
          <div className="relative">
            {!showDatePicker ? (
              <button
                onClick={() => setShowDatePicker(true)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors duration-150"
              >
                Mark as Left
              </button>
            ) : (
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-1.5 shadow-sm animate-fade-in">
                <input
                  type="date"
                  value={leftDate}
                  onChange={(e) => setLeftDate(e.target.value)}
                  className="px-2 py-1 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500 bg-white"
                  disabled={loading}
                />
                <button
                  onClick={handleConfirmLeft}
                  disabled={loading}
                  className="px-2.5 py-1 bg-rose-600 text-white rounded-md text-xs font-bold hover:bg-rose-700 disabled:opacity-50 transition-colors duration-150"
                >
                  Save
                </button>
                <button
                  onClick={() => setShowDatePicker(false)}
                  disabled={loading}
                  className="px-2 py-1 text-xs text-slate-500 hover:text-slate-700 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MemberChip;
