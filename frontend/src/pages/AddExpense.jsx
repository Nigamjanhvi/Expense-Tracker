import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';

const AddExpense = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  // Basic Form States
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('INR'); // 'INR' | 'USD'
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [paidById, setPaidById] = useState('');
  const [splitType, setSplitType] = useState('equal'); // 'equal' | 'exact' | 'percentage' | 'shares'
  const [selectedParticipantIds, setSelectedParticipantIds] = useState([]);
  
  // Custom Splits Details State { [userId]: value }
  const [splitDetails, setSplitDetails] = useState({});

  // Members lists
  const [memberships, setMemberships] = useState([]);
  const [activeMembers, setActiveMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);

  useEffect(() => {
    const fetchGroupData = async () => {
      try {
        setLoading(true);
        const { data } = await api.get(`/api/groups/${id}`);
        setMemberships(data.memberships);
        setError('');
      } catch (err) {
        console.error(err);
        setError('Failed to load group members.');
      } finally {
        setLoading(false);
      }
    };
    fetchGroupData();
  }, [id]);

  // Update active members whenever memberships or selected date changes
  useEffect(() => {
    if (memberships.length === 0) return;
    
    const selectedDateStr = date;
    const active = memberships.filter(m => {
      const joinedAtStr = m.joinedAt.split('T')[0];
      if (!m.leftAt) {
        return joinedAtStr <= selectedDateStr;
      }
      const leftAtStr = m.leftAt.split('T')[0];
      return joinedAtStr <= selectedDateStr && selectedDateStr <= leftAtStr;
    });

    setActiveMembers(active);
    
    // Auto-select paidById if not set
    if (active.length > 0 && (!paidById || !active.some(m => m.user.id === Number(paidById)))) {
      setPaidById(String(active[0].user.id));
    }

    // Keep selected participants that are still active, or default to all active
    setSelectedParticipantIds(prev => {
      const activeIds = active.map(m => m.user.id);
      const nextSelected = prev.filter(id => activeIds.includes(id));
      if (nextSelected.length === 0) {
        return activeIds;
      }
      return nextSelected;
    });
  }, [memberships, date]);

  // Reset or filter splitDetails when splitType or selectedParticipantIds change
  useEffect(() => {
    setSplitDetails(prev => {
      const nextDetails = {};
      selectedParticipantIds.forEach(id => {
        nextDetails[id] = prev[id] !== undefined ? prev[id] : (splitType === 'equal' ? '' : '0');
      });
      return nextDetails;
    });
  }, [splitType, selectedParticipantIds]);

  // USD Conversion Display
  const calculatedInr = currency === 'USD' ? Number((Number(amount || 0) * 83.5).toFixed(2)) : Number(amount || 0);

  // Split Calculations
  const handleSplitValueChange = (userId, value) => {
    setSplitDetails(prev => ({
      ...prev,
      [userId]: value
    }));
  };

  // Validations & Totals
  const sumOfDetails = selectedParticipantIds.reduce((acc, userId) => acc + Number(splitDetails[userId] || 0), 0);
  
  let isValid = true;
  let validationMessage = '';

  if (!description.trim()) {
    isValid = false;
  } else if (!amount || Number(amount) <= 0) {
    isValid = false;
  } else if (activeMembers.length === 0) {
    isValid = false;
    validationMessage = 'No active members on selected date';
  } else if (selectedParticipantIds.length === 0) {
    isValid = false;
    validationMessage = 'At least one participant must be selected';
  } else if (splitType === 'exact') {
    const diff = Math.abs(sumOfDetails - calculatedInr);
    if (diff > 1.00) {
      isValid = false;
      validationMessage = `Total: ₹${sumOfDetails.toFixed(2)} / ₹${calculatedInr.toFixed(2)} (Mismatch)`;
    } else {
      validationMessage = `Total matches target! (₹${sumOfDetails.toFixed(2)})`;
    }
  } else if (splitType === 'percentage') {
    const diff = Math.abs(sumOfDetails - 100);
    if (diff > 0.5) {
      isValid = false;
      validationMessage = `Total: ${sumOfDetails.toFixed(1)}% / 100% (Mismatch)`;
    } else {
      validationMessage = `Total matches target! (100%)`;
    }
  } else if (splitType === 'shares') {
    if (sumOfDetails <= 0) {
      isValid = false;
      validationMessage = 'Sum of shares must be greater than 0';
    } else {
      validationMessage = `Total shares: ${sumOfDetails}`;
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValid) return;

    setSubmitLoading(true);
    setError('');

    // Format split details as clean numeric JSON matching API expected types
    const cleanedSplitDetails = {};
    selectedParticipantIds.forEach(userId => {
      cleanedSplitDetails[userId] = Number(splitDetails[userId] || 0);
    });

    try {
      await api.post(`/api/groups/${id}/expenses`, {
        description: description.trim(),
        amount: Number(amount),
        currency,
        paidById: Number(paidById),
        date,
        splitType,
        splitDetails: cleanedSplitDetails,
        participantIds: selectedParticipantIds,
        notes: ''
      });
      navigate(`/groups/${id}`);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to submit expense.');
    } finally {
      setSubmitLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px]">
        <div className="w-12 h-12 border-4 border-solid border-teal-500 border-t-transparent animate-spin rounded-full"></div>
        <p className="mt-4 text-slate-500 font-medium text-sm">Loading members...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-3xl shadow-xl p-8 animate-fade-in glass">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Add Expense</h1>
        <p className="text-slate-500 text-xs font-semibold mt-1">Record a new transaction to split among group members</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm font-semibold flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Description */}
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            Description
          </label>
          <input
            type="text"
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Electricity Bill or Groceries"
            className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all duration-150"
          />
        </div>

        {/* Amount & Currency */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Amount
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all duration-150"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Currency
            </label>
            <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200">
              {['INR', 'USD'].map(cur => (
                <button
                  key={cur}
                  type="button"
                  onClick={() => setCurrency(cur)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 ${
                    currency === cur ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {cur}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* USD Exchange Indicator */}
        {currency === 'USD' && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-semibold flex items-center gap-2">
            <svg className="w-5 h-5 flex-shrink-0 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Amount will be converted at ₹83.5 per $1 = ₹{calculatedInr.toFixed(2)}
          </div>
        )}

        {/* Date & Paid By */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Date
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all duration-150"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Paid By
            </label>
            <select
              required
              value={paidById}
              onChange={(e) => setPaidById(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all duration-150"
            >
              {activeMembers.map(m => (
                <option key={m.user.id} value={m.user.id}>
                  {m.user.fullName}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Participant Selector */}
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            Select Participants (Who participated in this expense?)
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-4 border border-slate-200 rounded-2xl">
            {memberships.map((m) => {
              const isActive = activeMembers.some(am => am.user.id === m.user.id);
              const isChecked = selectedParticipantIds.includes(m.user.id);

              let statusLabel = '';
              if (!isActive) {
                const joinedAtStr = m.joinedAt.split('T')[0];
                const leftAtStr = m.leftAt ? m.leftAt.split('T')[0] : null;
                const selectedDateStr = date;
                if (selectedDateStr < joinedAtStr) {
                  statusLabel = `Joined on ${joinedAtStr}`;
                } else if (leftAtStr && selectedDateStr > leftAtStr) {
                  statusLabel = `Left on ${leftAtStr}`;
                } else {
                  statusLabel = 'Inactive';
                }
              }

              return (
                <label
                  key={m.user.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-150 ${
                    !isActive
                      ? 'bg-slate-100/50 border-slate-200 text-slate-400 cursor-not-allowed'
                      : isChecked
                      ? 'bg-teal-50/70 border-teal-200 text-slate-900 cursor-pointer shadow-sm'
                      : 'bg-white border-slate-200 text-slate-700 cursor-pointer hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    disabled={!isActive}
                    checked={isActive && isChecked}
                    onChange={() => {
                      if (!isActive) return;
                      setSelectedParticipantIds(prev =>
                        prev.includes(m.user.id)
                          ? prev.filter(id => id !== m.user.id)
                          : [...prev, m.user.id]
                      );
                    }}
                    className="w-4.5 h-4.5 text-teal-600 border-slate-300 rounded focus:ring-teal-500 focus:ring-2 accent-teal-600 disabled:opacity-50"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold leading-tight">
                      {m.user.fullName}
                    </span>
                    {statusLabel && (
                      <span className="text-[10px] font-bold text-rose-500/80 leading-none mt-1">
                        {statusLabel}
                      </span>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* Split Type Selector */}
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            Split Mode
          </label>
          <div className="grid grid-cols-4 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
            {['equal', 'exact', 'percentage', 'shares'].map(type => (
              <button
                key={type}
                type="button"
                onClick={() => setSplitType(type)}
                className={`py-2 rounded-lg text-xs font-bold transition-all duration-150 uppercase tracking-wider ${
                  splitType === type ? 'bg-teal-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Splits Config Fields */}
        <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50/50">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Split Breakdown Details</h3>
          
          {activeMembers.length === 0 ? (
            <span className="text-xs text-rose-500 font-bold">No active members found on the selected date.</span>
          ) : (
            <>
              {splitType === 'equal' && (
                <div className="bg-slate-100 border border-slate-200 rounded-xl p-4 text-xs font-bold text-slate-700">
                  {selectedParticipantIds.length > 0 ? (
                    `₹${(calculatedInr / selectedParticipantIds.length).toFixed(2)} per person (split equally among all ${selectedParticipantIds.length} selected participants)`
                  ) : (
                    <span className="text-rose-500">At least one participant must be selected</span>
                  )}
                </div>
              )}

              {splitType === 'exact' && (
                <div className="space-y-4">
                  {activeMembers.filter(m => selectedParticipantIds.includes(m.user.id)).map(m => (
                    <div key={m.user.id} className="flex items-center justify-between gap-4">
                      <span className="text-sm font-semibold text-slate-700 leading-none">{m.user.fullName}</span>
                      <div className="relative w-32 flex items-center">
                        <span className="absolute left-3.5 text-xs text-slate-400 font-bold">₹</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={splitDetails[m.user.id] || ''}
                          onChange={(e) => handleSplitValueChange(m.user.id, e.target.value)}
                          className="w-full pl-7 pr-3 py-1.5 text-sm font-bold bg-white border border-slate-300 rounded-xl text-right focus:outline-none focus:ring-1 focus:ring-teal-500"
                        />
                      </div>
                    </div>
                  ))}
                  <div className={`text-xs font-bold text-right pt-2 border-t border-slate-200 ${sumOfDetails === calculatedInr ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {validationMessage}
                  </div>
                </div>
              )}

              {splitType === 'percentage' && (
                <div className="space-y-4">
                  {activeMembers.filter(m => selectedParticipantIds.includes(m.user.id)).map(m => {
                    const pctVal = Number(splitDetails[m.user.id] || 0);
                    const estimatedShare = (pctVal / 100) * calculatedInr;

                    return (
                      <div key={m.user.id} className="flex items-center justify-between gap-4">
                        <span className="text-sm font-semibold text-slate-700 leading-none">
                          {m.user.fullName}
                          <span className="text-xs text-slate-400 font-medium block mt-1">Est. share: ₹{estimatedShare.toFixed(2)}</span>
                        </span>
                        <div className="relative w-32 flex items-center">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={splitDetails[m.user.id] || ''}
                            onChange={(e) => handleSplitValueChange(m.user.id, e.target.value)}
                            className="w-full pl-3 pr-8 py-1.5 text-sm font-bold bg-white border border-slate-300 rounded-xl text-right focus:outline-none focus:ring-1 focus:ring-teal-500"
                          />
                          <span className="absolute right-3.5 text-xs text-slate-400 font-bold">%</span>
                        </div>
                      </div>
                    );
                  })}
                  <div className={`text-xs font-bold text-right pt-2 border-t border-slate-200 ${Math.abs(sumOfDetails - 100) <= 0.5 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {validationMessage}
                  </div>
                </div>
              )}

              {splitType === 'shares' && (
                <div className="space-y-4">
                  {activeMembers.filter(m => selectedParticipantIds.includes(m.user.id)).map(m => {
                    const shareCount = Number(splitDetails[m.user.id] || 0);
                    const estimatedShare = sumOfDetails > 0 ? (shareCount / sumOfDetails) * calculatedInr : 0;

                    return (
                      <div key={m.user.id} className="flex items-center justify-between gap-4">
                        <span className="text-sm font-semibold text-slate-700 leading-none">
                          {m.user.fullName}
                          <span className="text-xs text-slate-400 font-medium block mt-1">Est. share: ₹{estimatedShare.toFixed(2)}</span>
                        </span>
                        <div className="relative w-32 flex items-center">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={splitDetails[m.user.id] || ''}
                            onChange={(e) => handleSplitValueChange(m.user.id, e.target.value)}
                            className="w-full px-3 py-1.5 text-sm font-bold bg-white border border-slate-300 rounded-xl text-right focus:outline-none focus:ring-1 focus:ring-teal-500"
                          />
                        </div>
                      </div>
                    );
                  })}
                  <div className="text-xs font-bold text-slate-600 text-right pt-2 border-t border-slate-200">
                    {validationMessage}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-200">
          <button
            type="button"
            onClick={() => navigate(`/groups/${id}`)}
            disabled={submitLoading}
            className="px-5 py-2.5 border border-slate-300 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors duration-150"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!isValid || submitLoading}
            className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all duration-150 disabled:opacity-50 flex items-center gap-1.5"
          >
            {submitLoading && (
              <div className="w-4 h-4 border-2 border-solid border-white border-t-transparent animate-spin rounded-full"></div>
            )}
            Save Expense
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddExpense;
