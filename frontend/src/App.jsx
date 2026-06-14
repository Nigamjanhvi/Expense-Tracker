import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Groups from './pages/Groups';
import GroupDetail from './pages/GroupDetail';
import AddExpense from './pages/AddExpense';
import Import from './pages/Import';

const ProtectedLayout = ({ children }) => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
        {children}
      </main>
    </div>
  );
};

const PublicLayout = ({ children }) => {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/groups" replace />;
  }

  return <div className="min-h-screen bg-slate-100 flex items-center justify-center">{children}</div>;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route
            path="/login"
            element={
              <PublicLayout>
                <Login />
              </PublicLayout>
            }
          />

          {/* Protected Routes */}
          <Route
            path="/groups"
            element={
              <ProtectedLayout>
                <Groups />
              </ProtectedLayout>
            }
          />
          <Route
            path="/groups/:id"
            element={
              <ProtectedLayout>
                <GroupDetail />
              </ProtectedLayout>
            }
          />
          <Route
            path="/groups/:id/expenses/new"
            element={
              <ProtectedLayout>
                <AddExpense />
              </ProtectedLayout>
            }
          />
          <Route
            path="/import"
            element={
              <ProtectedLayout>
                <Import />
              </ProtectedLayout>
            }
          />

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/groups" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
