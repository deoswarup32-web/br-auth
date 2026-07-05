import React, { useState, useEffect } from 'react';

// Default API URL - uses VITE_API_URL env var in production, falls back to Railway backend URL
const DEFAULT_API_URL = import.meta.env.VITE_API_URL || 'https://br-auth-backend-production.up.railway.app';

export default function App() {
  const [apiUrl, setApiUrl] = useState(() => localStorage.getItem('api_url') || DEFAULT_API_URL);
  const [showSettings, setShowSettings] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [view, setView] = useState('landing');
  const [token, setToken] = useState(() => localStorage.getItem('auth_token') || null);
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('auth_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Apps & Credits states
  const [appsList, setAppsList] = useState([]);
  const [resellerCreditsList, setResellerCreditsList] = useState([]);
  const [newAppName, setNewAppName] = useState('');
  const [newAppDesc, setNewAppDesc] = useState('');
  const [creditReseller, setCreditReseller] = useState('');
  const [creditApp, setCreditApp] = useState('');
  const [creditAmount, setCreditAmount] = useState(0);
  const [selectedAppId, setSelectedAppId] = useState('');

  // Login Form
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Signup Form
  const [signupUsername, setSignupUsername] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupKey, setSignupKey] = useState('');

  // Direct client user creation states
  const [newClientUser, setNewClientUser] = useState('');
  const [newClientPass, setNewClientPass] = useState('');
  const [newClientExpiry, setNewClientExpiry] = useState(30);
  const [newClientNote, setNewClientNote] = useState('');
  const [newClientHwidLock, setNewClientHwidLock] = useState(true);

  const [notification, setNotification] = useState(null);
  const [loading, setLoading] = useState(false);

  // Stats & Dashboard Data
  const [stats, setStats] = useState({
    totalUsers: 0, totalSellers: 0, totalResellers: 0, totalKeys: 0, usedKeys: 0, unusedKeys: 0
  });
  const [usersList, setUsersList] = useState([]);
  const [keysList, setKeysList] = useState([]);
  const [resellersList, setResellersList] = useState([]);

  // Form states for creation
  const [newSellerUser, setNewSellerUser] = useState('');
  const [newSellerPass, setNewSellerPass] = useState('');
  const [newResellerUser, setNewResellerUser] = useState('');
  const [newResellerPass, setNewResellerPass] = useState('');

  // Key Gen states
  const [keyCount, setKeyCount] = useState(1);
  const [keyExpiry, setKeyExpiry] = useState(30);
  const [keyNote, setKeyNote] = useState('');

  // Active view tab
  const [activeTab, setActiveTab] = useState('dashboard');
  const [regEnabled, setRegEnabled] = useState(false);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Code snippets tab
  const [codeTab, setCodeTab] = useState('cpp');

  // Load backend configurations & lists when logged in
  useEffect(() => {
    if (token && user) {
      fetchDashboardData();
    }
  }, [token, user]);

  const showToast = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    setToken(null);
    setUser(null);
    setView('landing');
    showToast('Logged out successfully');
  };

  const saveApiUrl = (url) => {
    const formatted = url.trim();
    localStorage.setItem('api_url', formatted);
    setApiUrl(formatted);
    setShowSettings(false);
    showToast(`API Endpoint updated to: ${formatted}`);
  };

  // API Wrapper helper
  const apiFetch = async (endpoint, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers
    };

    try {
      const response = await fetch(`${apiUrl}${endpoint}`, {
        ...options,
        headers
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'API request failed');
      }
      return data;
    } catch (err) {
      console.error(`API Error (${endpoint}):`, err);
      showToast(err.message || 'Failed to connect to backend server', 'danger');
      throw err;
    }
  };

  const fetchDashboardData = async () => {
    if (!token || !user) return;
    setLoading(true);
    try {
      if (user.role === 'admin') {
        const statsRes = await apiFetch('/api/admin/stats');
        if (statsRes.success) setStats(statsRes.stats);

        const usersRes = await apiFetch('/api/admin/users');
        if (usersRes.success) setUsersList(usersRes.users);

        const keysRes = await apiFetch('/api/seller/keys'); // Admin can view seller keys
        if (keysRes.success) setKeysList(keysRes.keys);

        const settingsRes = await apiFetch('/api/admin/settings');
        if (settingsRes.success) setRegEnabled(settingsRes.registrationEnabled);

        const appsRes = await apiFetch('/api/seller/apps');
        if (appsRes.success) setAppsList(appsRes.apps);

        const creditsRes = await apiFetch('/api/seller/reseller-credits');
        if (creditsRes.success) setResellerCreditsList(creditsRes.credits);
      } 
      else if (user.role === 'seller') {
        const resellersRes = await apiFetch('/api/seller/resellers');
        if (resellersRes.success) setResellersList(resellersRes.resellers);

        const keysRes = await apiFetch('/api/seller/keys');
        if (keysRes.success) setKeysList(keysRes.keys);

        const appsRes = await apiFetch('/api/seller/apps');
        if (appsRes.success) setAppsList(appsRes.apps);

        const creditsRes = await apiFetch('/api/seller/reseller-credits');
        if (creditsRes.success) setResellerCreditsList(creditsRes.credits);
      } 
      else if (user.role === 'reseller') {
        const keysRes = await apiFetch('/api/reseller/keys');
        if (keysRes.success) setKeysList(keysRes.keys);

        const appsRes = await apiFetch('/api/reseller/my-apps');
        if (appsRes.success) {
          setAppsList(appsRes.apps);
          if (appsRes.apps.length > 0 && !selectedAppId) {
            setSelectedAppId(appsRes.apps[0].appId); // Select first app by default
          }
        }
      }
      else if (user.role === 'user') {
        // Just verify key status
        const keysRes = await apiFetch('/api/seller/keys'); // User fetches key details matching theirs
        if (keysRes.success) {
          const myKey = keysRes.keys.find(k => k.usedBy === user.username);
          if (myKey) setKeysList([myKey]);
        }
      }
    } catch (err) {
      // Handled in apiFetch
    } finally {
      setLoading(false);
    }
  };

  // Auth Submit Actions
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!loginUsername || !loginPassword) return;

    setLoading(true);
    try {
      const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: loginUsername, password: loginPassword })
      });

      if (data.success) {
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('auth_user', JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        showToast(`Welcome back, ${data.user.username}!`);
        // Reset inputs
        setLoginUsername('');
        setLoginPassword('');
      }
    } catch (err) {
      // Handled
    } finally {
      setLoading(false);
    }
  };

  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    if (!signupUsername || !signupPassword || !signupKey) return;

    setLoading(true);
    try {
      const data = await apiFetch('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ username: signupUsername, password: signupPassword, key: signupKey })
      });

      if (data.success) {
        showToast(data.message, 'success');
        setIsLogin(true);
        // Reset inputs
        setSignupUsername('');
        setSignupPassword('');
        setSignupKey('');
      }
    } catch (err) {
      // Handled
    } finally {
      setLoading(false);
    }
  };

  // Admin Actions
  const handleCreateSeller = async (e) => {
    e.preventDefault();
    if (!newSellerUser || !newSellerPass) return;
    try {
      const data = await apiFetch('/api/admin/seller', {
        method: 'POST',
        body: JSON.stringify({ username: newSellerUser, password: newSellerPass })
      });
      if (data.success) {
        showToast(`Seller ${newSellerUser} created successfully!`);
        setNewSellerUser('');
        setNewSellerPass('');
        fetchDashboardData();
      }
    } catch (err) {}
  };

  const handleToggleUserStatus = async (userId, currentStatus) => {
    const nextStatus = currentStatus === 'active' ? 'blocked' : 'active';
    try {
      const data = await apiFetch('/api/admin/user/status', {
        method: 'PATCH',
        body: JSON.stringify({ userId, status: nextStatus })
      });
      if (data.success) {
        showToast(`User status updated to ${nextStatus}`);
        fetchDashboardData();
      }
    } catch (err) {}
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm('Are you sure you want to delete this user? All credentials associated will be wiped.')) return;
    try {
      const data = await apiFetch(`/api/admin/user/${userId}`, { method: 'DELETE' });
      if (data.success) {
        showToast('User account deleted');
        fetchDashboardData();
      }
    } catch (err) {}
  };

  const handleToggleRegistration = async (state) => {
    try {
      const data = await apiFetch('/api/admin/settings', {
        method: 'POST',
        body: JSON.stringify({ registrationEnabled: state })
      });
      if (data.success) {
        setRegEnabled(state);
        showToast(`Public registration ${state ? 'ENABLED' : 'DISABLED'}`);
      }
    } catch (err) {}
  };

  // Seller/Reseller Actions
  const handleCreateReseller = async (e) => {
    e.preventDefault();
    if (!newResellerUser || !newResellerPass) return;
    try {
      const data = await apiFetch('/api/seller/reseller', {
        method: 'POST',
        body: JSON.stringify({ username: newResellerUser, password: newResellerPass })
      });
      if (data.success) {
        showToast(`Reseller ${newResellerUser} created successfully!`);
        setNewResellerUser('');
        setNewResellerPass('');
        fetchDashboardData();
      }
    } catch (err) {}
  };

  const handleGenerateKeys = async (e) => {
    e.preventDefault();
    const endpoint = user.role === 'reseller' ? '/api/reseller/keys' : '/api/seller/keys';
    try {
      const data = await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({ count: keyCount, expiryDays: keyExpiry, note: keyNote, appId: selectedAppId || null })
      });
      if (data.success) {
        showToast(`Successfully generated ${data.keys.length} license key(s)`);
        setKeyNote('');
        fetchDashboardData();
      }
    } catch (err) {}
  };

  const handleCreateUserAccount = async (e) => {
    e.preventDefault();
    if (!newClientUser || !newClientPass || !newClientExpiry) return;
    const endpoint = user.role === 'reseller' ? '/api/reseller/user-account' : '/api/seller/user-account';
    setLoading(true);
    try {
      const data = await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          username: newClientUser,
          password: newClientPass,
          expiryDays: newClientExpiry,
          note: newClientNote,
          hwidLockEnabled: newClientHwidLock,
          appId: selectedAppId || null
        })
      });
      if (data.success) {
        showToast(data.message || 'User client account created successfully!');
        setNewClientUser('');
        setNewClientPass('');
        setNewClientNote('');
        setNewClientHwidLock(true);
        fetchDashboardData();
      }
    } catch (err) {
      // handled
    } finally {
      setLoading(false);
    }
  };

  const handleCreateApp = async (e) => {
    e.preventDefault();
    if (!newAppName) return;
    setLoading(true);
    try {
      const data = await apiFetch('/api/seller/apps', {
        method: 'POST',
        body: JSON.stringify({ name: newAppName, description: newAppDesc })
      });
      if (data.success) {
        showToast(`Successfully created application "${newAppName}"`);
        setNewAppName('');
        setNewAppDesc('');
        fetchDashboardData();
      }
    } catch (err) {}
    finally { setLoading(false); }
  };

  const handleDeleteApp = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete the application "${name}"? This registry record will be removed. All resellers, key allocations, and user logins will remain active and untouched.`)) return;
    setLoading(true);
    try {
      const data = await apiFetch(`/api/seller/app/${id}`, {
        method: 'DELETE'
      });
      if (data.success) {
        showToast(`Successfully deleted application "${name}"`);
        fetchDashboardData();
      }
    } catch (err) {}
    finally { setLoading(false); }
  };


  const handleAssignCredits = async (e) => {
    e.preventDefault();
    if (!creditReseller || !creditApp || creditAmount === undefined) return;
    setLoading(true);
    try {
      const data = await apiFetch('/api/seller/reseller-credits', {
        method: 'POST',
        body: JSON.stringify({ resellerUsername: creditReseller, appId: creditApp, credits: creditAmount })
      });
      if (data.success) {
        showToast(data.message || 'Credits assigned successfully!');
        setCreditAmount(0);
        fetchDashboardData();
      }
    } catch (err) {}
    finally { setLoading(false); }
  };

  const handleResetHWID = async (keyId, username) => {
    const endpoint = user.role === 'reseller' ? '/api/reseller/hwid/reset' : '/api/seller/hwid/reset';
    try {
      const data = await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({ keyId, username })
      });
      if (data.success) {
        showToast('Hardware ID lock reset successfully!');
        fetchDashboardData();
      }
    } catch (err) {}
  };

  const handleDeleteKey = async (keyId) => {
    if (!confirm('Are you sure you want to delete this license key? The user using this key will be deleted.')) return;
    try {
      const data = await apiFetch(`/api/seller/key/${keyId}`, { method: 'DELETE' });
      if (data.success) {
        showToast('License key deleted');
        fetchDashboardData();
      }
    } catch (err) {}
  };

  // Utility copy functions
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    showToast('Copied to clipboard!');
  };

  // SVGs Components for UI Aesthetics
  const LogoIcon = () => (
    <svg width="40" height="40" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="8" fill="url(#logo-grad)"/>
      <path d="M16 8L22.9282 20H9.0718L16 8Z" fill="white" fillOpacity="0.2"/>
      <circle cx="16" cy="17" r="4" fill="white"/>
      <circle cx="16" cy="17" r="2" fill="#07080d"/>
      <defs>
        <linearGradient id="logo-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8B5CF6"/>
          <stop offset="1" stopColor="#3B82F6"/>
        </linearGradient>
      </defs>
    </svg>
  );

  const KeyIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
  );

  const ResetIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path></svg>
  );

  const BanIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>
  );

  const DeleteIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
  );

  const CodeSnippets = {
    cpp: `// Auth Integration in C++ (Zero-Dependency WinINet)
#include "AuthClient.h"

int main() {
    // Initialize auth client with your backend URL
    AuthClient auth("${apiUrl}");

    std::string msg, expiry;
    bool loggedIn = auth.LoginWithKey("YOUR-LICENSE-KEY", msg, expiry);

    if (loggedIn) {
        std::cout << "Success: " << msg << std::endl;
        std::cout << "Subscription Expiry: " << expiry << std::endl;
        
        // Locked HWID check runs on server side automatically
        std::cout << "Your HWID: " << AuthClient::GetHWID() << std::endl;
    } else {
        std::cout << "Authentication Failed: " << msg << std::endl;
    }
    return 0;
}`,
    csharp: `// Auth Integration in C#
using System;
using System.Threading.Tasks;
using AuthSystem;

class Program
{
    static async Task Main(string[] args)
    {
        // Initialize client
        var auth = new AuthClient("${apiUrl}");

        // Attempt login using key
        var response = await auth.LoginWithKeyAsync("YOUR-LICENSE-KEY");

        if (response.Success)
        {
            Console.WriteLine($"Login Successful: {response.Message}");
            Console.WriteLine($"Remaining Time: {response.Remaining}");
            Console.WriteLine($"Locked HWID: {AuthClient.GetHWID()}");
        }
        else
        {
            Console.WriteLine($"Login Failed: {response.Message}");
        }
    }
}`,
    java: `// Auth Integration in Java
package app;

import auth.AuthClient;

public class Main {
    public static void main(String[] args) {
        // Initialize auth client
        AuthClient auth = new AuthClient("${apiUrl}");

        // Login using license key
        AuthClient.AuthResponse response = auth.loginWithKey("YOUR-LICENSE-KEY");

        if (response.success) {
            System.out.println("Login Success: " + response.message);
            System.out.println("Remaining Duration: " + response.remaining);
            System.out.println("Device HWID: " + AuthClient.getHWID());
        } else {
            System.out.println("Login Failed: " + response.message);
        }
    }
}`
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* Toast Notifications */}
      {notification && (
        <div style={{
          position: 'fixed', top: '20px', right: '20px', zIndex: 1000,
          background: notification.type === 'danger' ? 'rgba(239, 68, 68, 0.9)' : 'rgba(16, 185, 129, 0.9)',
          color: '#fff', padding: '12px 24px', borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)', backdropFilter: 'blur(8px)',
          fontWeight: 600, fontSize: '0.9rem', animation: 'fadeIn 0.3s ease'
        }}>
          {notification.message}
        </div>
      )}

      {/* Header bar (when logged in) */}
      {token && user && (
        <header className="glass-panel" style={{
          margin: '16px', padding: '12px 24px', display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', borderRadius: '12px', borderBottom: '1px solid var(--border)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <LogoIcon />
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }} className="text-gradient">BR AUTH</h2>
              <span className="badge badge-info" style={{ textTransform: 'uppercase', fontSize: '0.65rem' }}>{user.role}</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Logged in as <strong style={{ color: 'var(--text-primary)' }}>{user.username}</strong>
            </span>
            <button onClick={handleLogout} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
              Logout
            </button>
          </div>
        </header>
      )}

      {/* Main content body */}
      <main style={{ flex: 1, padding: view === 'landing' ? '0' : '16px', display: 'flex', flexDirection: 'column' }}>
        {!token ? (
          view === 'landing' ? (
            <div className="animated-fade" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%' }}>
              {/* Landing Nav */}
              <nav className="landing-nav" style={{ margin: 0, width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <LogoIcon />
                  <span style={{ fontSize: '1.3rem', fontWeight: 800, letterSpacing: '0.05em' }} className="text-gradient">BR AUTH</span>
                </div>
                <button onClick={() => setView('login')} className="btn btn-primary" style={{ padding: '8px 20px', fontSize: '0.85rem' }}>
                  Enter Gateway
                </button>
              </nav>

              {/* Hero */}
              <div className="hero-container">
                <span className="badge badge-info" style={{ marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Secure Licensing System</span>
                <h1 className="hero-title text-gradient">The Secure Gate to Your Applications</h1>
                <p className="hero-desc">
                  BR Auth is a next-generation software licensing, key activation, and Hardware ID (HWID) locking gate. Protect your loaders, game cheats, hacks, or applications from sharing and cracking.
                </p>
                <div className="hero-ctas">
                  <button onClick={() => setView('login')} className="btn btn-primary" style={{ padding: '14px 28px', fontSize: '0.95rem' }}>
                    Launch Dashboard Portal
                  </button>
                  <a href="#demo-sdk" className="btn btn-secondary" style={{ padding: '14px 28px', fontSize: '0.95rem' }}>
                    Explore SDK Guides
                  </a>
                </div>
              </div>

              {/* Stats */}
              <div className="stats-section">
                <div className="stats-container">
                  <div className="landing-stat-box">
                    <span className="landing-stat-num text-gradient">99.99%</span>
                    <span className="landing-stat-lbl">API Uptime</span>
                  </div>
                  <div className="landing-stat-box">
                    <span className="landing-stat-num text-gradient">&lt; 14ms</span>
                    <span className="landing-stat-lbl">Response Speed</span>
                  </div>
                  <div className="landing-stat-box">
                    <span className="landing-stat-num text-gradient">14,290+</span>
                    <span className="landing-stat-lbl">Devices Protected</span>
                  </div>
                </div>
              </div>

              {/* Features */}
              <div className="features-section">
                <div className="glass-panel feature-card">
                  <div style={{ fontSize: '2rem' }}>🛡️</div>
                  <h3>Anti-Share HWID Lock</h3>
                  <p>Fingerprints CPU registers and drive serials on execution. Blocks concurrent logins and sharing attempts automatically.</p>
                </div>
                <div className="glass-panel feature-card">
                  <div style={{ fontSize: '2rem' }}>👥</div>
                  <h3>Reseller Hierarchy</h3>
                  <p>Create Sellers who manage Resellers. Resellers can generate licenses directly for client users. Absolute control down the chain.</p>
                </div>
                <div className="glass-panel feature-card">
                  <div style={{ fontSize: '2rem' }}>⚡</div>
                  <h3>Zero-DLL Integrations</h3>
                  <p>Header-only C++ integration utilizing native WinINet API. Clean C# and Java SDK classes with zero external dependencies.</p>
                </div>
              </div>

              {/* Demo SDK Section */}
              <div id="demo-sdk" className="integration-preview-section" style={{ width: '100%' }}>
                <div className="glass-panel" style={{ padding: '30px' }}>
                  <h3 style={{ marginBottom: '12px', fontSize: '1.3rem', textAlign: 'center' }}>Integration Preview</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center', marginBottom: '24px' }}>
                    Copy-paste simple code blocks to protect your program.
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '16px' }}>
                    <button onClick={() => setCodeTab('cpp')} className={`tab-btn ${codeTab === 'cpp' ? 'tab-btn-active' : ''}`}>C++</button>
                    <button onClick={() => setCodeTab('csharp')} className={`tab-btn ${codeTab === 'csharp' ? 'tab-btn-active' : ''}`}>C#</button>
                    <button onClick={() => setCodeTab('java')} className={`tab-btn ${codeTab === 'java' ? 'tab-btn-active' : ''}`}>Java</button>
                  </div>

                  <div className="code-box">
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{CodeSnippets[codeTab]}</pre>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ margin: 'auto', width: '100%', maxWidth: '420px', padding: '10px' }} className="animated-fade">
              <div className="glass-panel" style={{ padding: '36px', borderRadius: '20px', position: 'relative' }}>
              
              {/* Endpoint Settings Wheel */}
              <button 
                onClick={() => setShowSettings(!showSettings)} 
                style={{
                  position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none',
                  color: 'var(--text-secondary)', cursor: 'pointer', outline: 'none'
                }}
                title="Configure Backend URL"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
              </button>

              <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                <div style={{ display: 'inline-block', marginBottom: '12px' }}>
                  <LogoIcon />
                </div>
                <h1 style={{ fontSize: '1.8rem', fontWeight: 800 }} className="text-gradient">BR GATEWAY</h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
                  {isLogin ? 'Access your developer licensing system' : 'Activate license and create account'}
                </p>
              </div>

              {showSettings ? (
                <div className="animated-fade" style={{ marginBottom: '24px', padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                  <h4 style={{ fontSize: '0.9rem', marginBottom: '12px', color: 'var(--text-primary)' }}>Configure Server API</h4>
                  <div className="form-group">
                    <input 
                      type="text" 
                      className="input-field" 
                      defaultValue={apiUrl} 
                      id="api-url-input"
                      placeholder="http://localhost:5000"
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      onClick={() => saveApiUrl(document.getElementById('api-url-input').value)} 
                      className="btn btn-primary" style={{ flex: 1, padding: '8px' }}
                    >
                      Save API URL
                    </button>
                    <button onClick={() => setShowSettings(false)} className="btn btn-secondary" style={{ padding: '8px' }}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Login Form Only */}
              <form onSubmit={handleLoginSubmit}>
                <div className="form-group">
                  <label className="form-label">Username</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    value={loginUsername} 
                    onChange={e => setLoginUsername(e.target.value)} 
                    placeholder="Enter username" 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input 
                    type="password" 
                    className="input-field" 
                    value={loginPassword} 
                    onChange={e => setLoginPassword(e.target.value)} 
                    placeholder="••••••••" 
                    required 
                  />
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px', marginTop: '8px' }} disabled={loading}>
                  {loading ? 'Logging in...' : 'Sign In'}
                </button>
              </form>

              <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '0.85rem' }}>
                <button 
                  onClick={() => setView('landing')} 
                  style={{
                    background: 'none', border: 'none', color: 'var(--primary)',
                    fontWeight: 600, cursor: 'pointer', outline: 'none', textDecoration: 'underline'
                  }}
                >
                  Back to Home Page
                </button>
              </div>

            </div>
          </div>
          )
        ) : (
          /* ============================================================== */
          /*                       DASHBOARD PANELS (LOGGED IN)             */
          /* ============================================================== */
          <div className="animated-fade" style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '24px', flex: 1 }}>
            
            {/* Sidebar Navigation */}
            <aside className="glass-panel" style={{ padding: '20px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '8px', height: 'fit-content' }}>
              <button 
                onClick={() => setActiveTab('dashboard')} 
                className={`nav-btn \${activeTab === 'dashboard' ? 'nav-btn-active' : ''}`}
              >
                Dashboard
              </button>
              
              {user.role === 'admin' && (
                <button 
                  onClick={() => setActiveTab('sellers')} 
                  className={`nav-btn \${activeTab === 'sellers' ? 'nav-btn-active' : ''}`}
                >
                  Manage Sellers
                </button>
              )}

              {user.role === 'seller' && (
                <button 
                  onClick={() => setActiveTab('resellers')} 
                  className={`nav-btn \${activeTab === 'resellers' ? 'nav-btn-active' : ''}`}
                >
                  Manage Resellers
                </button>
              )}

              {['admin', 'seller', 'reseller'].includes(user.role) && (
                <button 
                  onClick={() => setActiveTab('keys')} 
                  className={`nav-btn \${activeTab === 'keys' ? 'nav-btn-active' : ''}`}
                >
                  License Keys
                </button>
              )}

              {['admin', 'seller', 'reseller'].includes(user.role) && (
                <button 
                  onClick={() => setActiveTab('users')} 
                  className={`nav-btn \${activeTab === 'users' ? 'nav-btn-active' : ''}`}
                >
                  User Accounts
                </button>
              )}

              <button 
                onClick={() => setActiveTab('integration')} 
                className={`nav-btn \${activeTab === 'integration' ? 'nav-btn-active' : ''}`}
              >
                Client Integration
              </button>

              {['admin', 'seller'].includes(user.role) && (
                <button 
                  onClick={() => { setActiveTab('apps'); if (appsList.length > 0) setCreditApp(appsList[0].id); }} 
                  className={`nav-btn \${activeTab === 'apps' ? 'nav-btn-active' : ''}`}
                >
                  Manage Applications
                </button>
              )}

              <div style={{ marginTop: '40px', padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>API Connection</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }}></span>
                  Connected
                </div>
              </div>
            </aside>

            {/* Panel Body */}
            <section style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Tab 1: General Dashboard Stats */}
              {activeTab === 'dashboard' && (
                <div className="animated-fade" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  
                  {/* Stats Grid */}
                  {user.role === 'admin' ? (
                    <div>
                      <h3 style={{ marginBottom: '16px', fontSize: '1.25rem' }}>Global System Statistics</h3>
                      <div className="dashboard-grid">
                        <div className="glass-panel stat-card">
                          <span className="stat-title">Registered Users</span>
                          <span className="stat-val text-gradient">{stats.totalUsers}</span>
                        </div>
                        <div className="glass-panel stat-card">
                          <span className="stat-title">Active Sellers</span>
                          <span className="stat-val text-gradient">{stats.totalSellers}</span>
                        </div>
                        <div className="glass-panel stat-card">
                          <span className="stat-title">Active Resellers</span>
                          <span className="stat-val text-gradient">{stats.totalResellers}</span>
                        </div>
                        <div className="glass-panel stat-card">
                          <span className="stat-title">Total Keys Generated</span>
                          <span className="stat-val text-gradient">{stats.totalKeys}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="glass-panel" style={{ padding: '30px', borderRadius: '16px' }}>
                      <h3 style={{ marginBottom: '12px', fontSize: '1.4rem' }}>Welcome to BR Auth Panel</h3>
                      <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                        You are logged in as a <strong>{user.role}</strong>. Use the sidebar menu to navigate. You can generate license codes, manage client hardware ID locks, and fetch software loader templates for integration into your binary programs.
                      </p>
                      
                      {user.role === 'reseller' && (
                        <div style={{ marginTop: '24px' }}>
                          <h4 style={{ marginBottom: '16px', fontSize: '1.05rem', color: 'var(--text-secondary)' }}>Your Assigned Apps & Credits</h4>
                          {appsList.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No apps assigned yet. Ask your Seller to assign you an application and credit balance.</p>
                          ) : (
                            <div className="dashboard-grid" style={{ marginBottom: 0 }}>
                              {appsList.map((app) => (
                                <div key={app.appId} className="glass-panel stat-card" style={{ height: 'auto', gap: '8px' }}>
                                  <div style={{ fontSize: '1.2rem', fontWeight: 700 }} className="text-gradient">{app.appName}</div>
                                  <span className="stat-title" style={{ fontSize: '0.75rem', textTransform: 'none' }}>{app.appDescription || 'No description provided.'}</span>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Available Credits</span>
                                    <span className="badge badge-info" style={{ fontSize: '0.9rem', padding: '6px 12px' }}>{app.credits}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {user.role === 'user' && keysList[0] && (
                        <div style={{ marginTop: '24px', padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                          <h4 style={{ marginBottom: '12px', color: 'var(--text-primary)' }}>Your License Info</h4>
                          <p style={{ margin: '4px 0', fontSize: '0.9rem' }}>
                            <strong style={{ color: 'var(--text-secondary)' }}>License Key:</strong> {keysList[0].key}
                          </p>
                          <p style={{ margin: '4px 0', fontSize: '0.9rem' }}>
                            <strong style={{ color: 'var(--text-secondary)' }}>Status:</strong> <span className="badge badge-success">Active</span>
                          </p>
                          <p style={{ margin: '4px 0', fontSize: '0.9rem' }}>
                            <strong style={{ color: 'var(--text-secondary)' }}>Hardware ID (HWID):</strong> {keysList[0].hwid ? keysList[0].hwid : <span style={{ color: 'var(--warning)' }}>Not Locked (Log in via loader first)</span>}
                          </p>
                          {keysList[0].hwid && (
                            <button onClick={() => handleResetHWID(keysList[0].id, null)} className="btn btn-secondary" style={{ marginTop: '12px', padding: '6px 12px', fontSize: '0.8rem' }}>
                              Request HWID Reset
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* System Settings Quick Actions (Admin only) */}
                  {user.role === 'admin' && (
                    <div className="glass-panel" style={{ padding: '24px' }}>
                      <h3 style={{ marginBottom: '16px', fontSize: '1.1rem' }}>Global Security Settings</h3>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <strong style={{ display: 'block', marginBottom: '4px' }}>Block Public Signups</strong>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            When enabled, users must have a valid generated key to sign up. Direct signups are completely disabled.
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button 
                            onClick={() => handleToggleRegistration(false)} 
                            className={`btn \${!regEnabled ? 'btn-danger' : 'btn-secondary'}`}
                            style={{ padding: '8px 16px', background: !regEnabled ? 'linear-gradient(135deg, var(--danger) 0%, #991b1b 100%)' : 'rgba(157,78,221,0.05)', border: !regEnabled ? 'none' : '1px solid var(--border)' }}
                          >
                            Block Signups (Active)
                          </button>
                          <button 
                            onClick={() => handleToggleRegistration(true)} 
                            className={`btn \${regEnabled ? 'btn-success' : 'btn-secondary'}`}
                            style={{ padding: '8px 16px', background: regEnabled ? 'linear-gradient(135deg, var(--success) 0%, #065f46 100%)' : 'rgba(157,78,221,0.05)', border: regEnabled ? 'none' : '1px solid var(--border)' }}
                          >
                            Allow Public Signups
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              )}

              {/* Tab 2: Manage Sellers (Admin only) */}
              {activeTab === 'sellers' && user.role === 'admin' && (
                <div className="animated-fade" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  
                  {/* Create Seller Form */}
                  <div className="glass-panel" style={{ padding: '24px' }}>
                    <h3 style={{ marginBottom: '16px', fontSize: '1.1rem' }}>Create New Seller</h3>
                    <form onSubmit={handleCreateSeller} style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                      <div className="form-group" style={{ flex: 1, minWidth: '200px', marginBottom: 0 }}>
                        <label className="form-label">Username</label>
                        <input 
                          type="text" 
                          className="input-field" 
                          value={newSellerUser} 
                          onChange={e => setNewSellerUser(e.target.value)} 
                          placeholder="e.g. seller_alpha" 
                          required 
                        />
                      </div>
                      <div className="form-group" style={{ flex: 1, minWidth: '200px', marginBottom: 0 }}>
                        <label className="form-label">Password</label>
                        <input 
                          type="password" 
                          className="input-field" 
                          value={newSellerPass} 
                          onChange={e => setNewSellerPass(e.target.value)} 
                          placeholder="••••••••" 
                          required 
                        />
                      </div>
                      <button type="submit" className="btn btn-primary" style={{ height: '45px' }}>
                        Create Seller Account
                      </button>
                    </form>
                  </div>

                  {/* Sellers List Table */}
                  <div className="glass-panel" style={{ padding: '24px' }}>
                    <h3 style={{ marginBottom: '16px', fontSize: '1.1rem' }}>All System Users</h3>
                    <div className="table-container">
                      <table>
                        <thead>
                          <tr>
                            <th>Username</th>
                            <th>Role</th>
                            <th>Status</th>
                            <th>Created By</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {usersList.filter(u => u.role !== 'admin').map((u) => (
                            <tr key={u.id}>
                              <td><strong style={{ color: 'var(--text-primary)' }}>{u.username}</strong></td>
                              <td><span className={`badge \${u.role === 'seller' ? 'badge-info' : 'badge-warning'}`} style={{ textTransform: 'uppercase' }}>{u.role}</span></td>
                              <td>
                                <span className={`badge \${u.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                                  {u.status}
                                </span>
                              </td>
                              <td>{u.createdBy}</td>
                              <td>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <button 
                                    onClick={() => handleToggleUserStatus(u.id, u.status)} 
                                    className="btn btn-secondary" 
                                    style={{ padding: '6px', display: 'flex', alignItems: 'center' }}
                                    title={u.status === 'active' ? 'Block User' : 'Activate User'}
                                  >
                                    <BanIcon />
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteUser(u.id)} 
                                    className="btn btn-danger" 
                                    style={{ padding: '6px', display: 'flex', alignItems: 'center' }}
                                    title="Delete User"
                                  >
                                    <DeleteIcon />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                          {usersList.filter(u => u.role !== 'admin').length === 0 && (
                            <tr>
                              <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No sellers or resellers created yet.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              )}

              {/* Tab 3: Manage Resellers (Seller only) */}
              {activeTab === 'resellers' && user.role === 'seller' && (
                <div className="animated-fade" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  
                  {/* Create Reseller Form */}
                  <div className="glass-panel" style={{ padding: '24px' }}>
                    <h3 style={{ marginBottom: '16px', fontSize: '1.1rem' }}>Create New Reseller</h3>
                    <form onSubmit={handleCreateReseller} style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                      <div className="form-group" style={{ flex: 1, minWidth: '200px', marginBottom: 0 }}>
                        <label className="form-label">Username</label>
                        <input 
                          type="text" 
                          className="input-field" 
                          value={newResellerUser} 
                          onChange={e => setNewResellerUser(e.target.value)} 
                          placeholder="e.g. reseller_premium" 
                          required 
                        />
                      </div>
                      <div className="form-group" style={{ flex: 1, minWidth: '200px', marginBottom: 0 }}>
                        <label className="form-label">Password</label>
                        <input 
                          type="password" 
                          className="input-field" 
                          value={newResellerPass} 
                          onChange={e => setNewResellerPass(e.target.value)} 
                          placeholder="••••••••" 
                          required 
                        />
                      </div>
                      <button type="submit" className="btn btn-primary" style={{ height: '45px' }}>
                        Create Reseller Account
                      </button>
                    </form>
                  </div>

                  {/* Resellers list */}
                  <div className="glass-panel" style={{ padding: '24px' }}>
                    <h3 style={{ marginBottom: '16px', fontSize: '1.1rem' }}>My Created Resellers</h3>
                    <div className="table-container">
                      <table>
                        <thead>
                          <tr>
                            <th>Username</th>
                            <th>Status</th>
                            <th>Created At</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {resellersList.map((r) => (
                            <tr key={r.id}>
                              <td><strong style={{ color: 'var(--text-primary)' }}>{r.username}</strong></td>
                              <td>
                                <span className={`badge \${r.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                                  {r.status}
                                </span>
                              </td>
                              <td>{new Date(r.createdAt).toLocaleDateString()}</td>
                              <td>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <button 
                                    onClick={() => handleToggleUserStatus(r.id, r.status)} 
                                    className="btn btn-secondary" 
                                    style={{ padding: '6px' }}
                                    title={r.status === 'active' ? 'Block Reseller' : 'Activate Reseller'}
                                  >
                                    <BanIcon />
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteUser(r.id)} 
                                    className="btn btn-danger" 
                                    style={{ padding: '6px' }}
                                    title="Delete Reseller"
                                  >
                                    <DeleteIcon />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                          {resellersList.length === 0 && (
                            <tr>
                              <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>You haven't created any resellers yet.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              )}

              {/* Tab 4: License Keys Management (Admin, Seller, Reseller) */}
              {activeTab === 'keys' && ['admin', 'seller', 'reseller'].includes(user.role) && (
                <div className="animated-fade" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  
                  {/* Generate Key Section (Seller & Reseller only) */}
                  {['seller', 'reseller'].includes(user.role) && (
                    <div className="glass-panel" style={{ padding: '24px' }}>
                      <h3 style={{ marginBottom: '16px', fontSize: '1.1rem' }}>Generate License Keys</h3>
                      <form onSubmit={handleGenerateKeys} style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <div className="form-group" style={{ width: '100px', marginBottom: 0 }}>
                          <label className="form-label">Quantity</label>
                          <input 
                            type="number" 
                            className="input-field" 
                            value={keyCount} 
                            onChange={e => setKeyCount(Math.max(1, parseInt(e.target.value) || 1))} 
                            min="1" max="100" 
                            required 
                          />
                        </div>
                        <div className="form-group" style={{ width: '150px', marginBottom: 0 }}>
                          <label className="form-label">Expiry (Days)</label>
                          <select 
                            className="input-field" 
                            value={keyExpiry} 
                            onChange={e => setKeyExpiry(parseInt(e.target.value))}
                          >
                            <option value={1}>1 Day (Trial)</option>
                            <option value={7}>7 Days (Weekly)</option>
                            <option value={30}>30 Days (Monthly)</option>
                            <option value={365}>365 Days (Yearly)</option>
                            <option value={99999}>Lifetime</option>
                          </select>
                        </div>
                        {appsList.length > 0 && (
                          <div className="form-group" style={{ width: '180px', marginBottom: 0 }}>
                            <label className="form-label">Application</label>
                            <select 
                              className="input-field" 
                              value={selectedAppId} 
                              onChange={e => setSelectedAppId(e.target.value)}
                              required
                            >
                              <option value="">-- Select App --</option>
                              {appsList.map(app => (
                                <option key={app.id || app.appId} value={app.id || app.appId}>
                                  {app.name || app.appName}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                        <div className="form-group" style={{ flex: 1, minWidth: '180px', marginBottom: 0 }}>
                          <label className="form-label">Note / Customer Name</label>
                          <input 
                            type="text" 
                            className="input-field" 
                            value={keyNote} 
                            onChange={e => setKeyNote(e.target.value)} 
                            placeholder="e.g. Sold to John Doe" 
                          />
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ height: '45px' }}>
                          Generate Keys
                        </button>
                      </form>
                    </div>
                  )}

                  {/* Keys Inventory list */}
                  <div className="glass-panel" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '16px', flexWrap: 'wrap' }}>
                      <h3 style={{ fontSize: '1.1rem' }}>Generated License Keys</h3>
                      
                      {/* Search field */}
                      <input 
                        type="text" 
                        className="input-field" 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search key, user or note..."
                        style={{ maxWidth: '300px', padding: '8px 12px', fontSize: '0.85rem' }}
                      />
                    </div>

                    <div className="table-container">
                      <table>
                        <thead>
                          <tr>
                            <th>License Key</th>
                            <th>Application</th>
                            <th>Expiry</th>
                            <th>Generated By</th>
                            <th>Used By</th>
                            <th>HWID Status</th>
                            <th>Note</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {keysList.filter(k => 
                            k.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (k.usedBy && k.usedBy.toLowerCase().includes(searchQuery.toLowerCase())) ||
                            (k.note && k.note.toLowerCase().includes(searchQuery.toLowerCase()))
                          ).map((k) => (
                            <tr key={k.id}>
                              <td style={{ fontFamily: 'monospace' }}>
                                <strong style={{ color: 'var(--text-primary)', cursor: 'pointer' }} onClick={() => { copyToClipboard(k.key) }} title="Click to copy key">
                                  {k.key}
                                </strong>
                              </td>
                              <td>
                                <span className="badge badge-info" style={{ textTransform: 'none' }}>
                                  {k.appName || '-'}
                                </span>
                              </td>
                              <td>
                                <span className="badge badge-info">
                                  {k.expiryDays === 99999 ? 'Lifetime' : `${k.expiryDays} Days`}
                                </span>
                              </td>
                              <td>{k.createdBy}</td>
                              <td>
                                {k.isUsed ? (
                                  <span style={{ color: 'var(--success)', fontWeight: 600 }}>{k.usedBy}</span>
                                ) : (
                                  <span style={{ color: 'var(--text-muted)' }}>Unused</span>
                                )}
                              </td>
                              <td>
                                {k.hwidLockEnabled === false ? (
                                  <span className="badge badge-info" style={{ fontSize: '0.75rem' }}>
                                    No Lock
                                  </span>
                                ) : k.hwid ? (
                                  <span className="badge badge-success" style={{ fontFamily: 'monospace', fontSize: '0.75rem' }} title={k.hwid}>
                                    Locked
                                  </span>
                                ) : (
                                  <span className="badge badge-warning" style={{ fontSize: '0.75rem' }}>
                                    Awaiting Lock
                                  </span>
                                )}
                              </td>
                              <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{k.note || '-'}</td>
                              <td>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <button 
                                    onClick={() => handleDeleteKey(k.id)} 
                                    className="btn btn-danger" 
                                    style={{ padding: '6px' }}
                                    title="Delete Key"
                                  >
                                    <DeleteIcon />
                                  </button>
                                  {k.hwid && (
                                    <button 
                                      onClick={() => handleResetHWID(k.id, null)} 
                                      className="btn btn-secondary" 
                                      style={{ padding: '6px' }}
                                      title="Reset HWID Lock"
                                    >
                                      <ResetIcon />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                          {keysList.length === 0 && (
                            <tr>
                              <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No license keys generated yet.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              )}

              {/* Tab 6: User Accounts Management (Admin, Seller, Reseller) */}
              {activeTab === 'users' && ['admin', 'seller', 'reseller'].includes(user.role) && (
                <div className="animated-fade" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  
                  {/* Create User Account Section (Reseller and Seller only) */}
                  {['seller', 'reseller'].includes(user.role) && (
                    <div className="glass-panel" style={{ padding: '24px' }}>
                      <h3 style={{ marginBottom: '16px', fontSize: '1.1rem' }}>Create Client User Account</h3>
                      <form onSubmit={handleCreateUserAccount} style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <div className="form-group" style={{ flex: 1, minWidth: '180px', marginBottom: 0 }}>
                          <label className="form-label">Client Username</label>
                          <input 
                            type="text" 
                            className="input-field" 
                            value={newClientUser} 
                            onChange={e => setNewClientUser(e.target.value)} 
                            placeholder="Enter username" 
                            required 
                          />
                        </div>
                        <div className="form-group" style={{ flex: 1, minWidth: '180px', marginBottom: 0 }}>
                          <label className="form-label">Client Password</label>
                          <input 
                            type="password" 
                            className="input-field" 
                            value={newClientPass} 
                            onChange={e => setNewClientPass(e.target.value)} 
                            placeholder="Enter password" 
                            required 
                          />
                        </div>
                        <div className="form-group" style={{ width: '150px', marginBottom: 0 }}>
                          <label className="form-label">Subscription (Days)</label>
                          <select 
                            className="input-field" 
                            value={newClientExpiry} 
                            onChange={e => setNewClientExpiry(parseInt(e.target.value))}
                          >
                            <option value={1}>1 Day (Trial)</option>
                            <option value={7}>7 Days (Weekly)</option>
                            <option value={30}>30 Days (Monthly)</option>
                            <option value={365}>365 Days (Yearly)</option>
                            <option value={99999}>Lifetime</option>
                          </select>
                        </div>
                        {appsList.length > 0 && (
                          <div className="form-group" style={{ width: '180px', marginBottom: 0 }}>
                            <label className="form-label">Application</label>
                            <select 
                              className="input-field" 
                              value={selectedAppId} 
                              onChange={e => setSelectedAppId(e.target.value)}
                              required
                            >
                              <option value="">-- Select App --</option>
                              {appsList.map(app => (
                                <option key={app.id || app.appId} value={app.id || app.appId}>
                                  {app.name || app.appName}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                        <div className="form-group" style={{ flex: 1, minWidth: '180px', marginBottom: 0 }}>
                          <label className="form-label">Note / Reference</label>
                          <input 
                            type="text" 
                            className="input-field" 
                            value={newClientNote} 
                            onChange={e => setNewClientNote(e.target.value)} 
                            placeholder="e.g. Premium customer" 
                          />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '12px' }}>
                          <input 
                            type="checkbox" 
                            id="hwid-lock-toggle"
                            checked={newClientHwidLock}
                            onChange={e => setNewClientHwidLock(e.target.checked)}
                            style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                          />
                          <label htmlFor="hwid-lock-toggle" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}>
                            Lock HWID
                          </label>
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ height: '45px' }} disabled={loading}>
                          Create Client
                        </button>
                      </form>
                    </div>
                  )}

                  {/* Registered Client Users Table */}
                  <div className="glass-panel" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '16px', flexWrap: 'wrap' }}>
                      <h3 style={{ fontSize: '1.1rem' }}>Registered Client Accounts</h3>
                      
                      {/* Search field */}
                      <input 
                        type="text" 
                        className="input-field" 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search client username..."
                        style={{ maxWidth: '300px', padding: '8px 12px', fontSize: '0.85rem' }}
                      />
                    </div>

                    <div className="table-container">
                      <table>
                        <thead>
                          <tr>
                            <th>Username</th>
                            <th>Associated Key</th>
                            <th>Application</th>
                            <th>Expiry</th>
                            {user.role === 'admin' && <th>Created By</th>}
                            <th>HWID Status</th>
                            <th>Note</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {/* Filter used keys which represents users */}
                          {keysList.filter(k => k.isUsed && k.usedBy && k.usedBy.toLowerCase().includes(searchQuery.toLowerCase())).map((k) => (
                            <tr key={k.id}>
                              <td><strong style={{ color: 'var(--text-primary)' }}>{k.usedBy}</strong></td>
                              <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{k.key}</td>
                              <td>
                                <span className="badge badge-info" style={{ textTransform: 'none' }}>
                                  {k.appName || '-'}
                                </span>
                              </td>
                              <td>
                                <span className="badge badge-info">
                                  {k.expiryDays === 99999 ? 'Lifetime' : `${k.expiryDays} Days`}
                                </span>
                              </td>
                              {user.role === 'admin' && <td>{k.createdBy}</td>}
                              <td>
                                {k.hwidLockEnabled === false ? (
                                  <span className="badge badge-info" style={{ fontSize: '0.75rem' }}>
                                    No Lock
                                  </span>
                                ) : k.hwid ? (
                                  <span className="badge badge-success" style={{ fontFamily: 'monospace', fontSize: '0.75rem' }} title={k.hwid}>
                                    Locked
                                  </span>
                                ) : (
                                  <span className="badge badge-warning" style={{ fontSize: '0.75rem' }}>
                                    Awaiting Lock
                                  </span>
                                )}
                              </td>
                              <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{k.note || '-'}</td>
                              <td>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <button 
                                    onClick={() => handleDeleteKey(k.id)} 
                                    className="btn btn-danger" 
                                    style={{ padding: '6px' }}
                                    title="Delete Client Account"
                                  >
                                    <DeleteIcon />
                                  </button>
                                  {k.hwid && (
                                    <button 
                                      onClick={() => handleResetHWID(k.id, null)} 
                                      className="btn btn-secondary" 
                                      style={{ padding: '6px' }}
                                      title="Reset HWID Lock"
                                    >
                                      <ResetIcon />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                          {keysList.filter(k => k.isUsed).length === 0 && (
                            <tr>
                              <td colSpan={user.role === 'admin' ? "7" : "6"} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No client accounts registered yet.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              )}

              {/* Tab 5: Client Integration (C++, C#, Java Codes) */}
              {activeTab === 'integration' && (
                <div className="glass-panel animated-fade" style={{ padding: '24px' }}>
                  <h3 style={{ marginBottom: '8px', fontSize: '1.25rem' }}>Client App SDK Integration</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '24px' }}>
                    Integrate the Shield Auth licensing protocol directly into your loader executable or game mod using the native SDK templates below. Copy the template and add it to your source tree.
                  </p>

                  {/* Code Tabs selector */}
                  <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '16px' }}>
                    <button 
                      onClick={() => setCodeTab('cpp')} 
                      className={`tab-btn ${codeTab === 'cpp' ? 'tab-btn-active' : ''}`}
                    >
                      C++ (WinINet Native)
                    </button>
                    <button 
                      onClick={() => setCodeTab('csharp')} 
                      className={`tab-btn ${codeTab === 'csharp' ? 'tab-btn-active' : ''}`}
                    >
                      C# (.NET HttpClient)
                    </button>
                    <button 
                      onClick={() => setCodeTab('java')} 
                      className={`tab-btn ${codeTab === 'java' ? 'tab-btn-active' : ''}`}
                    >
                      Java (HttpClient 11)
                    </button>
                  </div>

                  {/* Code box */}
                  <div className="code-box">
                    <div className="code-header">
                      <span>Source template for: {codeTab.toUpperCase()}</span>
                      <button onClick={() => copyToClipboard(CodeSnippets[codeTab])} className="copy-btn">
                        Copy Code
                      </button>
                    </div>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                      {CodeSnippets[codeTab]}
                    </pre>
                  </div>

                  <div style={{ marginTop: '24px', padding: '16px', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.15)' }}>
                    <strong style={{ color: 'var(--secondary)', display: 'block', marginBottom: '4px' }}>🔒 HWID Security Advisory</strong>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      The HWID logic binds to device identifiers CPU and System Volume Serial. It prevents multiple PC usage. Resets are tracked and can be wiped by developers/sellers if customers upgrade their hardware.
                    </span>
                  </div>
                </div>
              )}

              {/* Tab 7: App & Reseller Credits Management (Admin & Seller only) */}
              {activeTab === 'apps' && ['admin', 'seller'].includes(user.role) && (
                <div className="animated-fade" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  
                  {/* Grid for forms */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                    
                    {/* Create App Form */}
                    <div className="glass-panel" style={{ padding: '24px' }}>
                      <h3 style={{ marginBottom: '16px', fontSize: '1.1rem' }}>Create New Application</h3>
                      <form onSubmit={handleCreateApp}>
                        <div className="form-group">
                          <label className="form-label">Application Name</label>
                          <input 
                            type="text" 
                            className="input-field" 
                            value={newAppName} 
                            onChange={e => setNewAppName(e.target.value)} 
                            placeholder="e.g. Valorant Spoofer" 
                            required 
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Description</label>
                          <input 
                            type="text" 
                            className="input-field" 
                            value={newAppDesc} 
                            onChange={e => setNewAppDesc(e.target.value)} 
                            placeholder="Brief description of the app" 
                          />
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                          Create Application
                        </button>
                      </form>
                    </div>

                    {/* Assign Credits Form */}
                    <div className="glass-panel" style={{ padding: '24px' }}>
                      <h3 style={{ marginBottom: '16px', fontSize: '1.1rem' }}>Assign Reseller Credits</h3>
                      <form onSubmit={handleAssignCredits}>
                        <div className="form-group">
                          <label className="form-label">Select Reseller</label>
                          <select 
                            className="input-field" 
                            value={creditReseller} 
                            onChange={e => setCreditReseller(e.target.value)}
                            required
                          >
                            <option value="">-- Choose Reseller --</option>
                            {resellersList.map(r => (
                              <option key={r.id} value={r.username}>{r.username}</option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Select Application</label>
                          <select 
                            className="input-field" 
                            value={creditApp} 
                            onChange={e => setCreditApp(e.target.value)}
                            required
                          >
                            <option value="">-- Choose Application --</option>
                            {appsList.map(app => (
                              <option key={app.id} value={app.id}>{app.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Credits to Assign</label>
                          <input 
                            type="number" 
                            className="input-field" 
                            value={creditAmount} 
                            onChange={e => setCreditAmount(parseInt(e.target.value) || 0)} 
                            min="1" 
                            required 
                          />
                        </div>
                        <button type="submit" className="btn btn-secondary" style={{ width: '100%' }}>
                          Assign Credits
                        </button>
                      </form>
                    </div>
                  </div>

                  {/* Apps Inventory list */}
                  <div className="glass-panel" style={{ padding: '24px' }}>
                    <h3 style={{ marginBottom: '16px', fontSize: '1.1rem' }}>Applications Registry</h3>
                    <div className="table-container">
                      <table>
                        <thead>
                          <tr>
                            <th>App Name</th>
                            <th>Description</th>
                            <th>Application ID</th>
                            <th>Created At</th>
                            <th style={{ textAlign: 'right' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {appsList.map((app) => (
                            <tr key={app.id}>
                              <td><strong style={{ color: 'var(--text-primary)' }}>{app.name}</strong></td>
                              <td>{app.description || '-'}</td>
                              <td style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{app.id}</td>
                              <td>{new Date(app.createdAt).toLocaleDateString()}</td>
                              <td style={{ textAlign: 'right' }}>
                                <button 
                                  onClick={() => handleDeleteApp(app.id, app.name)}
                                  className="btn-action btn-action-delete"
                                  style={{
                                    background: 'rgba(255, 75, 75, 0.1)',
                                    color: 'rgb(255, 75, 75)',
                                    border: '1px solid rgba(255, 75, 75, 0.2)',
                                    padding: '6px 12px',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '0.8rem',
                                    transition: 'all 0.2s'
                                  }}
                                  onMouseOver={(e) => {
                                    e.currentTarget.style.background = 'rgba(255, 75, 75, 0.2)';
                                    e.currentTarget.style.boxShadow = '0 0 10px rgba(255, 75, 75, 0.2)';
                                  }}
                                  onMouseOut={(e) => {
                                    e.currentTarget.style.background = 'rgba(255, 75, 75, 0.1)';
                                    e.currentTarget.style.boxShadow = 'none';
                                  }}
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                          {appsList.length === 0 && (
                            <tr>
                              <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No applications created yet.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Reseller Credits balances list */}
                  <div className="glass-panel" style={{ padding: '24px' }}>
                    <h3 style={{ marginBottom: '16px', fontSize: '1.1rem' }}>Reseller Credit Allocations</h3>
                    <div className="table-container">
                      <table>
                        <thead>
                          <tr>
                            <th>Reseller</th>
                            <th>Application Name</th>
                            <th>Application ID</th>
                            <th>Credit Balance</th>
                            <th>Assigned By</th>
                          </tr>
                        </thead>
                        <tbody>
                          {resellerCreditsList.map((c) => (
                            <tr key={c.id}>
                              <td><strong style={{ color: 'var(--text-primary)' }}>{c.resellerUsername}</strong></td>
                              <td><span className="badge badge-info">{c.appName}</span></td>
                              <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{c.appId}</td>
                              <td>
                                <span className="badge badge-success" style={{ fontSize: '0.85rem' }}>
                                  {c.credits} Credits
                                </span>
                              </td>
                              <td>{c.sellerUsername}</td>
                            </tr>
                          ))}
                          {resellerCreditsList.length === 0 && (
                            <tr>
                              <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No reseller credits assigned yet.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              )}

            </section>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{
        padding: '24px', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)',
        borderTop: '1px solid var(--border)', marginTop: 'auto'
      }}>
        <div>BR Auth Gateway System &copy; {new Date().getFullYear()}</div>
        <div style={{ marginTop: '4px' }}>Built with React, Express, and Custom Atomic File Database</div>
      </footer>
    </div>
  );
}
