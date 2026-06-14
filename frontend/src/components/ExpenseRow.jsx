import React, { useState } from 'react';

const ExpenseRow = ({ expense, onDelete }) => {
  const [expanded, setExpanded] = useState(false);

  const formattedDate = new Date(expense.date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  const handleDelete = (e) => {
    e.stopPropagation(); // Avoid triggering expand/collapse
    if (window.confirm(`Are you sure you want to delete "${expense.description}"?`)) {
      onDelete(expense.id);
    }
  };

  const isUSD = expense.currency === 'USD';

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      className="border-b border-slate-200 bg-white hover:bg-slate-50 transition-colors duration-150 cursor-pointer"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4">
        {/* Left section: date, description, payer */}
        <div className="flex items-start gap-4">
          <div className="flex flex-col items-center justify-center bg-slate-100 text-slate-600 rounded-lg p-2 min-w-[70px] text-center">
            <span className="text-xs font-semibold uppercase">{new Date(expense.date).toLocaleString('en-IN', { month: 'short' })}</span>
            <span className="text-lg font-bold leading-none">{new Date(expense.date).getDate()}</span>
          </div>
          <div>
            <h4 className="font-semibold text-slate-800 text-base">{expense.description}</h4>
            <p className="text-xs text-slate-500 mt-1">
              Paid by <span className="font-medium text-slate-700">{expense.paidBy.fullName}</span> on {formattedDate}
            </p>
          </div>
        </div>

        {/* Right section: amount and split badge */}
        <div className="flex items-center justify-between sm:justify-end gap-4">
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-2">
              {isUSD && (
                <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-200">
                  USD → INR
                </span>
              )}
              <span className="bg-slate-100 text-slate-700 text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider">
                {expense.splitType}
              </span>
            </div>
            <div className="text-slate-900 font-extrabold text-lg mt-1">
              ₹{Number(expense.amountInr).toFixed(2)}
              {isUSD && (
                <span className="text-slate-400 font-medium text-xs ml-1 block text-right">
                  (${Number(expense.amount).toFixed(2)})
                </span>
              )}
            </div>
          </div>

          <button
            onClick={handleDelete}
            className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-full transition-colors duration-150"
            title="Delete expense"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Expanded splits breakdown */}
      {expanded && (
        <div className="px-6 pb-4 pt-2 bg-slate-50/50 border-t border-slate-100">
          <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Split Breakdown</h5>
          <div className="overflow-x-auto max-w-md border border-slate-200 rounded-lg bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-slate-600">Member</th>
                  <th className="px-4 py-2 text-right font-semibold text-slate-600">Owes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expense.splits.map((split) => (
                  <tr key={split.id}>
                    <td className="px-4 py-2 font-medium text-slate-700">{split.user.fullName}</td>
                    <td className="px-4 py-2 text-right font-bold text-slate-900">₹{Number(split.amountOwed).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {expense.notes && (
            <div className="mt-3 text-xs text-slate-500 italic max-w-lg">
              <span className="font-semibold text-slate-700 not-italic block">Notes:</span>
              {expense.notes}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ExpenseRow;
