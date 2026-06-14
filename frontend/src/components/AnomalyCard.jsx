import React, { useState } from 'react';

const colorMap = {
  ANOMALY_DUPLICATE: 'bg-amber-100 text-amber-800 border-amber-200',
  ANOMALY_SETTLEMENT: 'bg-blue-100 text-blue-800 border-blue-200',
  ANOMALY_CURRENCY_USD: 'bg-purple-100 text-purple-800 border-purple-200',
  ANOMALY_MEMBER_LEFT: 'bg-orange-100 text-orange-800 border-orange-200',
  ANOMALY_MEMBER_NOT_YET_JOINED: 'bg-orange-100 text-orange-800 border-orange-200',
  ANOMALY_MISSING_FIELDS: 'bg-rose-100 text-rose-800 border-rose-200',
  ANOMALY_MISSING_SPLIT_DETAILS: 'bg-rose-100 text-rose-800 border-rose-200',
  ANOMALY_PERCENTAGE_SUM: 'bg-amber-100 text-amber-800 border-amber-200',
  ANOMALY_PAYER_NOT_IN_SPLIT: 'bg-slate-100 text-slate-800 border-slate-200',
  ANOMALY_INVALID_DATE_FORMAT: 'bg-rose-100 text-rose-800 border-rose-200',
  ANOMALY_NEGATIVE_AMOUNT_REFUND: 'bg-amber-100 text-amber-800 border-amber-200',
  ANOMALY_AUTO_MEMBER_CREATED: 'bg-teal-100 text-teal-800 border-teal-200',

  MISSING_PAYER: 'bg-rose-100 text-rose-800 border-rose-200',
  MISSING_CURRENCY: 'bg-rose-100 text-rose-800 border-rose-200',
  AMBIGUOUS_DATE: 'bg-rose-100 text-rose-800 border-rose-200',
  ZERO_AMOUNT: 'bg-rose-100 text-rose-800 border-rose-200',
  NEGATIVE_AMOUNT: 'bg-amber-100 text-amber-800 border-amber-200',
  DUPLICATE_EXPENSE: 'bg-amber-100 text-amber-800 border-amber-200',
  UNKNOWN_MEMBER: 'bg-rose-100 text-rose-800 border-rose-200',
  MEMBER_NOT_YET_JOINED: 'bg-orange-100 text-orange-800 border-orange-200',
  MEMBER_LEFT_BEFORE_EXPENSE: 'bg-orange-100 text-orange-800 border-orange-200',
  USD_EXPENSE: 'bg-purple-100 text-purple-800 border-purple-200',
  SETTLEMENT_AS_EXPENSE: 'bg-blue-100 text-blue-800 border-blue-200',
  SPLIT_TYPE_CONFLICT: 'bg-rose-100 text-rose-800 border-rose-200',
  PERCENTAGE_SUM: 'bg-amber-100 text-amber-800 border-amber-200',
  PAYER_NOT_IN_SPLIT: 'bg-slate-100 text-slate-800 border-slate-200',
};

const AnomalyCard = ({ anomaly, onApprove, onReject }) => {
  const [showRaw, setShowRaw] = useState(false);
  const [loading, setLoading] = useState(false);

  const typeColor = colorMap[anomaly.anomalyType] || 'bg-slate-100 text-slate-800 border-slate-200';
  const cleanType = anomaly.anomalyType.replace('ANOMALY_', '').replace(/_/g, ' ');

  const handleResolve = async (action) => {
    setLoading(true);
    try {
      if (action === 'approve') {
        await onApprove(anomaly.id);
      } else {
        await onReject(anomaly.id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const isResolved = anomaly.resolvedByUser;
  const isApproved = anomaly.actionTaken === 'approved_and_imported' || anomaly.actionTaken.includes('approve');
  const isRejected = anomaly.actionTaken === 'rejected_manually' || anomaly.actionTaken.includes('reject');

  // We only show action buttons for reviewable items (duplicates, percentage sums)
  // Others like rejected fields, invalid dates have actionTaken === 'rejected' or 'member_excluded_from_split'
  const isReviewable = anomaly.actionTaken === 'flagged_for_review';

  return (
    <div className="border border-slate-200 rounded-2xl bg-white shadow-sm overflow-hidden p-5 flex flex-col gap-4 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {anomaly.rowNumber > 0 ? (
            <span className="bg-slate-800 text-white text-xs font-bold px-2 py-0.5 rounded">
              Row {anomaly.rowNumber}
            </span>
          ) : (
            <span className="bg-teal-700 text-white text-xs font-bold px-2 py-0.5 rounded">
              Session
            </span>
          )}
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${typeColor}`}>
            {cleanType}
          </span>
        </div>
        <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-md">
          Action: {anomaly.actionTaken.replace(/_/g, ' ')}
        </span>
      </div>

      <div>
        <p className="text-sm text-slate-700 font-medium leading-relaxed">
          {anomaly.description}
        </p>
      </div>

      {/* Raw Data Toggle */}
      {anomaly.rawData && Object.keys(anomaly.rawData).length > 0 && (
        <div>
          <button
            onClick={() => setShowRaw(!showRaw)}
            className="text-xs font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1 transition-colors duration-150"
          >
            {showRaw ? 'Hide raw data' : 'View raw data'}
            <svg
              className={`w-3.5 h-3.5 transform transition-transform duration-200 ${showRaw ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {showRaw && (
            <pre className="mt-2 text-[10px] bg-slate-950 text-slate-300 p-3 rounded-lg overflow-x-auto shadow-inner border border-slate-800 leading-tight">
              {JSON.stringify(anomaly.rawData, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* Footer / Actions */}
      <div className="flex items-center justify-end border-t border-slate-100 pt-3 mt-1">
        {isResolved ? (
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            {isApproved ? (
              <span className="text-emerald-600">✓ Approved & Imported</span>
            ) : isRejected ? (
              <span className="text-rose-600">✗ Rejected Manually</span>
            ) : (
              <span className="text-slate-500">✓ Resolved ({anomaly.actionTaken.replace(/_/g, ' ')})</span>
            )}
            {anomaly.resolution && (
              <span className="text-xs text-slate-400 font-normal">({anomaly.resolution})</span>
            )}
          </div>
        ) : isReviewable ? (
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleResolve('reject')}
              disabled={loading}
              className="px-4 py-1.5 border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold transition-all duration-150 disabled:opacity-50"
            >
              Reject
            </button>
            <button
              onClick={() => handleResolve('approve')}
              disabled={loading}
              className="px-4 py-1.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg text-xs font-bold transition-all duration-150 disabled:opacity-50 shadow-sm"
            >
              Approve
            </button>
          </div>
        ) : (
          <span className="text-xs text-slate-400 font-medium italic">
            Automated check resolved
          </span>
        )}
      </div>
    </div>
  );
};

export default AnomalyCard;
