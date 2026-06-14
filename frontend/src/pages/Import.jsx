import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import AnomalyCard from '../components/AnomalyCard';

const Import = () => {
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Results State
  const [showResults, setShowResults] = useState(false);
  const [report, setReport] = useState(null); // { session: {...}, imported: N, flagged: N, ... }
  const [anomalies, setAnomalies] = useState([]);
  const [importedExpenses, setImportedExpenses] = useState([]);
  const [activeResultTab, setActiveResultTab] = useState('flagged'); // 'flagged' | 'rejected' | 'imported'

  // Fetch groups list on mount
  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const { data } = await api.get('/api/groups');
        setGroups(data);
        if (data.length > 0) {
          setSelectedGroupId(String(data[0].id));
        }
      } catch (err) {
        console.error(err);
        setError('Failed to fetch groups for import mapping.');
      }
    };
    fetchGroups();
  }, []);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv')) {
        setError('Only .csv files are supported.');
        setFile(null);
        return;
      }
      setFile(selectedFile);
      setError('');
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      if (!droppedFile.name.endsWith('.csv')) {
        setError('Only .csv files are supported.');
        return;
      }
      setFile(droppedFile);
      setError('');
    }
  };

  const handleImportSubmit = async (e) => {
    e.preventDefault();
    if (!selectedGroupId || !file) {
      setError('Please select a group and choose a valid CSV file.');
      return;
    }

    setLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('groupId', selectedGroupId);

    try {
      const { data } = await api.post('/api/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setReport(data);
      
      // Fetch anomalies for the session
      const anomaliesRes = await api.get(`/api/import/${data.session.id}/anomalies`);
      setAnomalies(anomaliesRes.data);

      // Fetch imported expenses for that group to display
      const expensesRes = await api.get(`/api/groups/${selectedGroupId}/expenses`);
      // Since they are sorted desc, filter those imported in this session
      const parsedSessionDate = new Date(data.session.importedAt).getTime();
      // approximate matching imported recently
      const sessionExpenses = expensesRes.data.filter(exp => 
        new Date(exp.createdAt).getTime() >= parsedSessionDate - 60000 // created in the last minute
      );
      setImportedExpenses(sessionExpenses);

      setShowResults(true);

      // Set initial tab based on counts
      if (data.flagged > 0) {
        setActiveResultTab('flagged');
      } else if (data.rejected > 0) {
        setActiveResultTab('rejected');
      } else {
        setActiveResultTab('imported');
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'CSV Import failed. Check format.');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveAnomaly = async (anomalyId) => {
    try {
      const { data } = await api.patch(`/api/import/anomalies/${anomalyId}`, {
        action: 'approve',
        resolutionNote: 'Approved manual reconciliation'
      });
      // Update local anomaly state
      setAnomalies(prev => prev.map(a => a.id === anomalyId ? data : a));
    } catch (err) {
      console.error(err);
      alert('Failed to approve anomaly: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleRejectAnomaly = async (anomalyId) => {
    try {
      const { data } = await api.patch(`/api/import/anomalies/${anomalyId}`, {
        action: 'reject',
        resolutionNote: 'Rejected manual duplicate'
      });
      // Update local anomaly state
      setAnomalies(prev => prev.map(a => a.id === anomalyId ? data : a));
    } catch (err) {
      console.error(err);
      alert('Failed to reject anomaly: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleReset = () => {
    setFile(null);
    setReport(null);
    setAnomalies([]);
    setImportedExpenses([]);
    setShowResults(false);
    setError('');
  };

  return (
    <div className="w-full">
      {/* Step 1: File Upload Screen */}
      {!showResults ? (
        <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-3xl shadow-xl p-8 animate-fade-in glass">
          <div className="mb-6">
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Reconcile CSV</h1>
            <p className="text-slate-500 font-medium text-sm mt-1">Upload a CSV log to automatically import splits and resolve data anomalies</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm font-semibold flex items-center gap-2">
              <svg className="w-5 h-5 flex-shrink-0 text-rose-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {error}
            </div>
          )}

          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center">
              <div className="w-16 h-16 border-4 border-solid border-teal-500 border-t-transparent animate-spin rounded-full"></div>
              <h3 className="text-lg font-bold text-slate-800 mt-6">Analyzing your CSV...</h3>
              <p className="text-slate-500 text-sm mt-1">Checking for duplicates, date bounds, and negative values...</p>
            </div>
          ) : (
            <form onSubmit={handleImportSubmit} className="space-y-6">
              {/* Group Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Map to Group
                </label>
                <select
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all duration-150"
                  required
                >
                  <option value="" disabled>Select group</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              {/* Drag & Drop Zone */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  CSV Log file
                </label>
                <div
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  className="border-2 border-dashed border-slate-300 hover:border-teal-500 rounded-2xl p-8 bg-slate-50/50 hover:bg-slate-50 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-150"
                  onClick={() => document.getElementById('csv-file-picker').click()}
                >
                  <input
                    id="csv-file-picker"
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="opacity-0 absolute w-px h-px"
                  />
                  <div className="w-12 h-12 bg-white border border-slate-200 text-slate-400 rounded-xl flex items-center justify-center mb-4 shadow-sm">
                    <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  {file ? (
                    <div>
                      <span className="text-sm font-bold text-teal-600 block">{file.name}</span>
                      <span className="text-xs text-slate-400 mt-1 block">{(file.size / 1024).toFixed(1)} KB (Click to browse different file)</span>
                    </div>
                  ) : (
                    <div>
                      <span className="text-sm font-semibold text-slate-600 block">Drop your CSV here or click to browse</span>
                      <span className="text-xs text-slate-400 mt-1 block">Supports standard CSV logs up to 5MB</span>
                    </div>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={!file || !selectedGroupId}
                className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all duration-150 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                Start Reconciliation
              </button>
            </form>
          )}
        </div>
      ) : (
        /* Step 2: Import Report Screen */
        <div className="space-y-6">
          {/* Summary Badges Header */}
          <div className="border border-slate-200 bg-white rounded-3xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <span className="text-xs uppercase tracking-wider font-extrabold text-teal-600">Reconciliation Report</span>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">Reconciliation Completed!</h1>
              <p className="text-slate-500 text-xs font-semibold mt-1">Imported session for file: <span className="text-slate-700 font-bold">{report.session.fileName}</span></p>
            </div>
            <button
              onClick={handleReset}
              className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all duration-150 shadow-sm"
            >
              Import Another CSV
            </button>
          </div>

          {/* Counts metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 border border-emerald-200 bg-emerald-50/50 rounded-2xl flex flex-col gap-1 shadow-sm">
              <span className="text-2xl font-extrabold text-emerald-800">{report.imported}</span>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Clean Imported</span>
            </div>
            <div className="p-5 border border-amber-200 bg-amber-50/50 rounded-2xl flex flex-col gap-1 shadow-sm">
              <span className="text-2xl font-extrabold text-amber-800">{report.flagged}</span>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Flagged For Review</span>
            </div>
            <div className="p-5 border border-rose-200 bg-rose-50/50 rounded-2xl flex flex-col gap-1 shadow-sm">
              <span className="text-2xl font-extrabold text-rose-800">{report.rejected}</span>
              <span className="text-xs font-bold uppercase tracking-wider text-rose-700">Rejected Logs</span>
            </div>
            <div className="p-5 border border-blue-200 bg-blue-50/50 rounded-2xl flex flex-col gap-1 shadow-sm">
              <span className="text-2xl font-extrabold text-blue-800">{report.reclassified}</span>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-700">Reclassified Settlements</span>
            </div>
          </div>

          {/* Report Tab menu */}
          <div className="flex border-b border-slate-200 gap-2">
            {[
              { id: 'flagged', label: `Flagged (${anomalies.filter(a => a.actionTaken === 'flagged_for_review').length})` },
              { id: 'rejected', label: `Rejected (${anomalies.filter(a => ['rejected', 'member_excluded_from_split'].includes(a.actionTaken)).length})` },
              { id: 'imported', label: `Clean Imported (${report.imported})` }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveResultTab(tab.id)}
                className={`px-4 py-2.5 text-xs font-extrabold uppercase tracking-wider border-b-2 transition-all duration-150 ${
                  activeResultTab === tab.id
                    ? 'border-teal-500 text-teal-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Report Tabs Content */}
          <div className="w-full">
            {/* FLAGGED ANOMALIES */}
            {activeResultTab === 'flagged' && (
              <div className="space-y-4">
                {anomalies.filter(a => a.actionTaken === 'flagged_for_review' || a.actionTaken.includes('approved') || a.actionTaken.includes('manual')).length === 0 ? (
                  <div className="text-center py-12 bg-white border border-slate-200 rounded-2xl text-slate-500 text-sm italic">
                    No flagged anomalies left to review!
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {anomalies
                      .filter(a => a.actionTaken === 'flagged_for_review' || a.actionTaken.includes('approved') || a.actionTaken.includes('manual'))
                      .map(a => (
                        <AnomalyCard
                          key={a.id}
                          anomaly={a}
                          onApprove={handleApproveAnomaly}
                          onReject={handleRejectAnomaly}
                        />
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* REJECTED ROWS */}
            {activeResultTab === 'rejected' && (
              <div className="space-y-4">
                {anomalies.filter(a => ['rejected', 'member_excluded_from_split'].includes(a.actionTaken)).length === 0 ? (
                  <div className="text-center py-12 bg-white border border-slate-200 rounded-2xl text-slate-500 text-sm italic">
                    No rows were rejected in this session.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {anomalies
                      .filter(a => ['rejected', 'member_excluded_from_split'].includes(a.actionTaken))
                      .map(a => (
                        <AnomalyCard
                          key={a.id}
                          anomaly={a}
                          onApprove={null}
                          onReject={null}
                        />
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* CLEAN IMPORTED EXPENSES */}
            {activeResultTab === 'imported' && (
              <div className="border border-slate-200 bg-white rounded-3xl overflow-hidden shadow-sm">
                {importedExpenses.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-sm italic">
                    No new expenses were imported in this session.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200">
                    {importedExpenses.map(exp => (
                      <div key={exp.id} className="flex justify-between items-center p-4">
                        <div>
                          <h4 className="font-semibold text-slate-800 text-sm">{exp.description}</h4>
                          <span className="text-[10px] text-slate-400 font-bold bg-slate-100 px-2 py-0.5 rounded uppercase">{exp.splitType}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-extrabold text-slate-900 block">₹{Number(exp.amountInr).toFixed(2)}</span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {new Date(exp.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Import;
