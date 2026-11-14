import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import './index.css';
import Videos from './Videos';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (data.accessToken) {
        localStorage.setItem('token', data.accessToken);
        navigate('/dashboard');
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('Connection error');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md glass-frost-blue-bg p-8">
        <h1 className="text-2xl font-bold text-center frost-gradient-text mb-6">Clipping AI</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="glass-badge glass-badge-red w-full justify-center py-2">{error}</div>}
          <div>
            <label className="frost-label">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="frost-input"
              required
            />
          </div>
          <div>
            <label className="frost-label">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="frost-input"
              required
            />
          </div>
          <button type="submit" className="glass-btn-primary w-full py-2.5">
            Sign In
          </button>
        </form>
        <p className="mt-4 text-center text-sm frost-muted">
          No account? <Link to="/register" className="text-blue-300 hover:text-blue-200 underline underline-offset-4">Register</Link>
        </p>
      </div>
    </div>
  );
}

function Register() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, username })
      });
      const data = await res.json();
      if (data.accessToken) {
        localStorage.setItem('token', data.accessToken);
        navigate('/dashboard');
      } else {
        setError(data.error || 'Registration failed');
      }
    } catch (err) {
      setError('Connection error');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md glass-frost-blue-bg p-8">
        <h1 className="text-2xl font-bold text-center frost-gradient-text mb-6">Create Account</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="glass-badge glass-badge-red w-full justify-center py-2">{error}</div>}
          <div>
            <label className="frost-label">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="frost-input"
              required
            />
          </div>
          <div>
            <label className="frost-label">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="frost-input"
              required
            />
          </div>
          <div>
            <label className="frost-label">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="frost-input"
              required
            />
          </div>
          <button type="submit" className="glass-btn-primary w-full py-2.5">
            Create Account
          </button>
        </form>
        <p className="mt-4 text-center text-sm frost-muted">
          Have account? <Link to="/login" className="text-blue-300 hover:text-blue-200 underline underline-offset-4">Sign In</Link>
        </p>
      </div>
    </div>
  );
}

function Dashboard() {
  const [user, setUser] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [earnings, setEarnings] = useState({ summary: { totalEarnings: 0 } });
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    const headers = { 'Authorization': `Bearer ${token}` };
    fetch('/api/auth/me', { headers })
      .then(r => r.json())
      .then(data => setUser(data.user))
      .catch(() => navigate('/login'));
    fetch('/api/campaigns', { headers })
      .then(r => r.json())
      .then(data => setCampaigns(data.campaigns || []));
    fetch('/api/earnings/summary', { headers })
      .then(r => r.json())
      .then(data => setEarnings(data.summary || { summary: { totalEarnings: 0 } }));
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  if (!user) return <div className="min-h-screen flex items-center justify-center frost-muted">Loading…</div>;

  return (
    <div className="min-h-screen">
      <nav className="frost-nav">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-xl font-bold frost-gradient-text">Clipping AI</h1>
            <div className="flex items-center space-x-4">
              <span className="text-sm frost-muted hidden sm:inline">{user.email}</span>
              <Link to="/videos" className="glass-btn">Videos</Link>
              <button onClick={handleLogout} className="glass-btn">Logout</button>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white">Dashboard</h2>
          <p className="frost-muted">Welcome back, {user.username}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="glass-frost-blue p-6">
            <h3 className="text-sm font-medium frost-muted">Total Earnings</h3>
            <p className="text-3xl font-bold text-blue-300 mt-2">${earnings.summary?.totalEarnings || 0}</p>
          </div>
          <div className="glass-frost-blue p-6">
            <h3 className="text-sm font-medium frost-muted">Campaigns Joined</h3>
            <p className="text-3xl font-bold text-blue-300 mt-2">{campaigns.length}</p>
          </div>
          <div className="glass-frost-blue p-6">
            <h3 className="text-sm font-medium frost-muted">Status</h3>
            <p className="text-3xl font-bold text-emerald-300 mt-2">Active</p>
          </div>
        </div>
        <div className="glass-card">
          <div className="p-6 border-b border-white/[0.06]">
            <h3 className="text-lg font-semibold text-white">Available Campaigns</h3>
          </div>
          <div className="divide-y divide-white/[0.06]">
            {campaigns.length === 0 ? (
              <div className="p-6 text-center frost-muted">No campaigns available</div>
            ) : (
              campaigns.map(campaign => (
                <div key={campaign.id} className="p-6 flex justify-between items-center">
                  <div>
                    <h4 className="font-medium text-white">{campaign.title}</h4>
                    <p className="text-sm frost-muted">${campaign.cpm} CPM • {campaign.platform}</p>
                  </div>
                  <span className="glass-badge glass-badge-blue capitalize">{campaign.status}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/videos" element={<Videos />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;