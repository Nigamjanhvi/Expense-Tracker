import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import BalanceCard from '../components/BalanceCard';
import ExpenseRow from '../components/ExpenseRow';
import MemberChip from '../components/MemberChip';

const GroupDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  // Tab State
  const [activeTab, setActiveTab] = useState('expenses'); // 'expenses' | 'balances' | 'members'

  // Data State
  const [group, setGroup] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [balances, setBalances] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Add Member State
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberJoinedAt, setNewMemberJoinedAt] = useState(new Date().toISOString().split('T')[0]);
  const [memberLoading, setMemberLoading] = useState(false);
  const [memberError, setMemberError] = useState('');

  // Breakdown Modal State
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [breakdownUser, setBreakdownUser] = useState(null);
  const [breakdownData, setBreakdownData] = useState([]);
  const [breakdownLoading, setBreakdownLoading] = useState(false);

  // Settlement Recording State
  const [settlementLoading, setSettlementLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Fetch Group, Expenses and Balances
      const [groupRes, expensesRes, balancesRes] = await Promise.all([
        api.get(`/api/groups/${id}`),
        api.get(`/api/groups/${id}/expenses`),
        api.get(`/api/groups/${id}/balances`)
      ]);

      setGroup(groupRes.data);
      setExpenses(expensesRes.data);
      setBalances(balancesRes.data);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch group details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  // Handle Add Member
  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!newMemberEmail.trim()) {
      setMemberError('Email is required');
      return;
    }
    setMemberLoading(true);
    setMemberError('');

    try {
      await api.post(`/api/groups/${id}/members`, {
        email: newMemberEmail.trim(),
        joinedAt: newMemberJoinedAt
      });
      setNewMemberEmail('');
      setNewMemberJoinedAt(new Date().toISOString().split('T')[0]);
      // Refresh
      await fetchData();
    } catch (err) {
      console.error(err);
      setMemberError(err.response?.data?.message || 'Failed to add member.');
    } finally {
      setMemberLoading(false);
    }
  };

  // Handle Mark Left
  const handleMarkLeft = async (membershipId, dateLeft) => {
    try {
      await api.patch(`/api/groups/${id}/members/${membershipId}`, {
        leftAt: dateLeft
      });
      showToast('Member marked as left successfully');
      await fetchData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to mark member as left.');
    }
  };

  // Handle Expense Delete
  const handleExpenseDelete = async (expenseId) => {
    try {
      await api.delete(`/api/expenses/${expenseId}`);
      showToast('Expense soft-deleted successfully');
      await fetchData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to delete expense.');
    }
  };

  // Handle Record Settlement
  const handleRecordSettlement = async (fromUserId, toUserId, amount) => {
    setSettlementLoading(true);
    try {
      await api.post(`/api/groups/${id}/settlements`, {
        paidById: fromUserId,
        paidToId: toUserId,
        amount,
        date: new Date().toISOString().split('T')[0],
        notes: 'Recorded via Balance Settled transfer'
      });
      showToast('Debt settlement recorded successfully!');
      await fetchData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to record settlement.');
    } finally {
      setSettlementLoading(false);
    }
  };

  // Handle Balance Click -> Show Breakdown
  const handleBalanceClick = async (member) => {
    setBreakdownUser(member);
    setShowBreakdown(true);
    setBreakdownLoading(true);
    try {
      const { data } = await api.get(`/api/groups/${id}/balances/${member.userId}/breakdown`);
      setBreakdownData(data);
    } catch (err) {
      console.error(err);
      setBreakdownData([]);
    } finally {
      setBreakdownLoading(false);
    }
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4000);
  };

  if (loading && !group) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px]">
        <div className="w-12 h-12 border-4 border-solid border-teal-500 border-t-transparent animate-spin rounded-full"></div>
        <p className="mt-4 text-slate-500 font-medium text-sm">Loading group details...</p>
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm font-semibold max-w-xl mx-auto mt-8 flex items-center gap-2">
        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        {error || 'Group not found'}
      </div>
    );
  }

  return (
    <div className="w-full relative">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 p-4 bg-slate-900 text-teal-400 border border-teal-500 rounded-xl shadow-2xl text-sm font-semibold animate-fade-in flex items-center gap-2">
          <svg className="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
          </svg>
          {toastMessage}
        </div>
      )}

      {/* Header Info */}
      <div className="border border-slate-200 bg-white rounded-3xl p-6 shadow-sm mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-l-4 border-l-teal-500">
        <div>
          <span className="text-xs uppercase tracking-wider font-extrabold text-teal-600">Active Group</span>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mt-1">{group.name}</h1>
          {group.description && <p className="text-slate-600 text-sm mt-1">{group.description}</p>}
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/groups"
            className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all duration-150"
          >
            ← Back to Groups
          </Link>
          <Link
            to={`/groups/${id}/expenses/new`}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all duration-150 flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
            </svg>
            Add Expense
          </Link>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-slate-200 mb-6 gap-2">
        {['expenses', 'balances', 'members'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-bold uppercase tracking-wider border-b-2 transition-all duration-150 ${
              activeTab === tab
                ? 'border-teal-500 text-teal-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tabs Content */}
      <div className="w-full">
        {/* EXPENSES TAB */}
        {activeTab === 'expenses' && (
          <div className="border border-slate-200 bg-white rounded-3xl shadow-sm overflow-hidden flex flex-col">
            {expenses.length === 0 ? (
              <div className="text-center py-16 p-8 flex flex-col items-center justify-center">
                <div className="w-16 h-16 bg-slate-100 border border-slate-200 text-slate-500 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-slate-800">No Expenses Yet</h3>
                <p className="text-slate-500 text-sm mt-1 mb-6 max-w-sm">Expenses recorded in the group will appear here with split breakdowns.</p>
                <Link
                  to={`/groups/${id}/expenses/new`}
                  className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all duration-150"
                >
                  Create First Expense
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {expenses.map((expense) => (
                  <ExpenseRow
                    key={expense.id}
                    expense={expense}
                    onDelete={handleExpenseDelete}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* BALANCES TAB */}
        {activeTab === 'balances' && balances && (
          <div className="space-y-6">
            {/* Horizontal cards container */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {balances.members.map((member) => (
                <BalanceCard
                  key={member.userId}
                  member={member}
                  onClick={() => handleBalanceClick(member)}
                />
              ))}
            </div>

            {/* Settlements simplification section */}
            <div className="border border-slate-200 bg-white rounded-3xl p-6 shadow-sm">
              <h2 className="text-lg font-extrabold text-slate-900 mb-4 flex items-center gap-1.5">
                <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Settlements Simplification
              </h2>

              {balances.settlementsNeeded.length === 0 ? (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-sm font-semibold flex items-center gap-2">
                  <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                  Everyone is settled up! No transfers are required.
                </div>
              ) : (
                <div className="space-y-3">
                  {balances.settlementsNeeded.map((set, index) => (
                    <div
                      key={index}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl gap-4"
                    >
                      <div className="text-sm text-slate-700 font-medium">
                        <span className="font-extrabold text-slate-900">{set.fromName}</span>
                        {' '}should pay{' '}
                        <span className="font-extrabold text-slate-900">{set.toName}</span>
                        {' '}
                        <span className="text-teal-600 font-bold">₹{set.amount.toFixed(2)}</span>
                      </div>
                      <button
                        onClick={() => handleRecordSettlement(set.fromUserId, set.toUserId, set.amount)}
                        disabled={settlementLoading}
                        className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all duration-150 disabled:opacity-50 self-start sm:self-auto shadow-sm"
                      >
                        Record as Settled
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* MEMBERS TAB */}
        {activeTab === 'members' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Left list */}
            <div className="lg:col-span-2 space-y-3">
              <h2 className="text-lg font-bold text-slate-800 mb-1">Group Members ({group.memberships.length})</h2>
              {group.memberships.map((membership) => (
                <MemberChip
                  key={membership.id}
                  membership={membership}
                  onMarkLeft={handleMarkLeft}
                />
              ))}
            </div>

            {/* Right form to add */}
            <div className="border border-slate-200 bg-white rounded-3xl p-6 shadow-sm">
              <h3 className="text-lg font-extrabold text-slate-900 mb-2">Add Member</h3>
              <p className="text-xs text-slate-500 font-medium mb-6">Enter details of users that exist in the system to join this group</p>

              {memberError && (
                <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs font-semibold">
                  {memberError}
                </div>
              )}

              <form onSubmit={handleAddMember} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                    placeholder="e.g. priya@gmail.com"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all duration-150"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Joined Date
                  </label>
                  <input
                    type="date"
                    required
                    value={newMemberJoinedAt}
                    onChange={(e) => setNewMemberJoinedAt(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all duration-150"
                  />
                </div>

                <button
                  type="submit"
                  disabled={memberLoading}
                  className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all duration-150 disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  {memberLoading && (
                    <div className="w-4 h-4 border-2 border-solid border-white border-t-transparent animate-spin rounded-full"></div>
                  )}
                  Add to Group
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Breakdown Details Modal */}
      {showBreakdown && breakdownUser && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-3xl bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 relative">
            <button
              onClick={() => {
                setShowBreakdown(false);
                setBreakdownUser(null);
                setBreakdownData([]);
              }}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors duration-150"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h2 className="text-xl font-extrabold text-slate-900 mb-1">Expense Breakdown</h2>
            <p className="text-xs text-slate-500 font-medium mb-6">
              Complete history of transaction shares for <span className="font-extrabold text-teal-600">{breakdownUser.fullName}</span>
            </p>

            {breakdownLoading ? (
              <div className="py-12 flex flex-col items-center justify-center">
                <div className="w-10 h-10 border-4 border-solid border-teal-500 border-t-transparent animate-spin rounded-full"></div>
                <span className="text-xs text-slate-500 font-medium mt-3">Compiling breakdown logs...</span>
              </div>
            ) : breakdownData.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-sm italic">
                No active transaction splits recorded for this member.
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-2xl bg-white shadow-inner max-h-[350px]">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-bold text-slate-600 text-xs uppercase">Date</th>
                      <th className="px-4 py-3 text-left font-bold text-slate-600 text-xs uppercase">Description</th>
                      <th className="px-4 py-3 text-left font-bold text-slate-600 text-xs uppercase">Paid By</th>
                      <th className="px-4 py-3 text-right font-bold text-slate-600 text-xs uppercase">Total Expense</th>
                      <th className="px-4 py-3 text-right font-bold text-slate-600 text-xs uppercase">Your Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {breakdownData.map((row, index) => (
                      <tr key={index} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-600 font-medium whitespace-nowrap">
                          {new Date(row.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-800 line-clamp-1">{row.description}</td>
                        <td className="px-4 py-3 text-slate-700 whitespace-nowrap font-medium">{row.paidByName}</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-500 whitespace-nowrap">
                          ₹{row.totalAmountInr.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right font-extrabold text-teal-600 whitespace-nowrap">
                          ₹{row.yourShare.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex items-center justify-end pt-4 border-t border-slate-100 mt-6">
              <button
                onClick={() => {
                  setShowBreakdown(false);
                  setBreakdownUser(null);
                  setBreakdownData([]);
                }}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors duration-150"
              >
                Close Logs
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupDetail;
