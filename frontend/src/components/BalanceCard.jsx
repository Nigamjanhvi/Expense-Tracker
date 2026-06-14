import React from 'react';

const getInitials = (name) => {
  if (!name) return '';
  return name
    .split(' ')
    .filter(Boolean)
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 3);
};

const BalanceCard = ({ member, onClick }) => {
  const { fullName, netBalance } = member;
  const initials = getInitials(fullName);

  let cardClass = "border border-slate-200 bg-white hover:bg-slate-50";
  let statusText = "Settled up";
  let statusClass = "text-slate-500";
  let amountText = "₹0.00";
  let avatarBg = "bg-slate-200 text-slate-700";

  if (netBalance > 0.005) {
    cardClass = "border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50";
    statusText = "Gets back";
    statusClass = "text-emerald-700 font-semibold";
    amountText = `₹${netBalance.toFixed(2)}`;
    avatarBg = "bg-emerald-600 text-white";
  } else if (netBalance < -0.005) {
    cardClass = "border border-rose-200 bg-rose-50/50 hover:bg-rose-50";
    statusText = "Owes";
    statusClass = "text-rose-700 font-semibold";
    amountText = `₹${Math.abs(netBalance).toFixed(2)}`;
    avatarBg = "bg-rose-600 text-white";
  }

  return (
    <div
      onClick={onClick}
      className={`p-6 rounded-2xl shadow-sm transition-all duration-200 cursor-pointer hover:shadow-md ${cardClass} flex flex-col items-center justify-center text-center`}
    >
      <div className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg mb-3 shadow-inner ${avatarBg}`}>
        {initials}
      </div>
      <h3 className="font-semibold text-slate-800 text-base line-clamp-1 mb-1">
        {fullName}
      </h3>
      <div className="flex flex-col items-center mt-2">
        <span className={`text-xs uppercase tracking-wider ${statusClass}`}>
          {statusText}
        </span>
        <span className="text-xl font-extrabold text-slate-900 mt-1">
          {amountText}
        </span>
      </div>
    </div>
  );
};

export default BalanceCard;
