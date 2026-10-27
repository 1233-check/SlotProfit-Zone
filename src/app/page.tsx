'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  signIn,
  signUp,
  signOut,
  getCurrentUser,
  onAuthStateChange,
  getDashboardStats,
  bookSlots,
  createDepositRequest,
  createWithdrawRequest,
} from '@/lib/supabase';
import toast from 'react-hot-toast';
import {
  Wallet,
  TrendingUp,
  Layers,
  ArrowDownToLine,
  ArrowUpFromLine,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  LogOut,
  RefreshCw,
  Coins,
  ChevronRight,
  ExternalLink,
  Lock,
  Plus,
  Minus,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';

const ADMIN_BEP20_WALLET =
  process.env.NEXT_PUBLIC_ADMIN_WALLET &&
  process.env.NEXT_PUBLIC_ADMIN_WALLET !== 'YOUR_BEP20_USDT_WALLET_ADDRESS_HERE'
    ? process.env.NEXT_PUBLIC_ADMIN_WALLET
    : '0x32A39FEcaaB7921a8080A59A3D348398D422204c';

export default function Home() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Auth Form State
  const [isSignUp, setIsSignUp] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authFullName, setAuthFullName] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // Dashboard Data State
  const [loadingStats, setLoadingStats] = useState(false);
  const [stats, setStats] = useState<any>({
    balance: 0,
    fullName: '',
    email: '',
    activeSlotsCount: 0,
    completedSlotsCount: 0,
    totalSlotsCount: 0,
    totalInvested: 0,
    totalEarned: 0,
    todayEarned: 0,
    availableSlots: 75,
    slotsBooked: 0,
    maxSlots: 75,
    slots: [],
    transactions: [],
  });

  // Slot Purchase State
  const [slotQuantity, setSlotQuantity] = useState(1);
  const [bookingLoading, setBookingLoading] = useState(false);

  // Deposit Form State
  const [depositAmount, setDepositAmount] = useState('20');
  const [depositTxHash, setDepositTxHash] = useState('');
  const [depositSubmitting, setDepositSubmitting] = useState(false);
  const [copiedWallet, setCopiedWallet] = useState(false);

  // Withdrawal Form State
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false);

  // Active Tab: 'slots' | 'deposit' | 'withdraw' | 'history'
  const [activeTab, setActiveTab] = useState<'slots' | 'deposit' | 'withdraw' | 'history'>('slots');

  // Load Dashboard Data
  const loadDashboard = useCallback(async (userId: string) => {
    try {
      setLoadingStats(true);
      const data = await getDashboardStats(userId);
      setStats(data);
    } catch (err: any) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  // Auth Listener
  useEffect(() => {
    async function checkUser() {
      const { user } = await getCurrentUser();
      setCurrentUser(user);
      if (user) {
        await loadDashboard(user.id);
      }
      setAuthLoading(false);
    }
    checkUser();

    const { data: authListener } = onAuthStateChange(async (_event, session: any) => {
      const user = session?.user || null;
      setCurrentUser(user);
      if (user) {
        await loadDashboard(user.id);
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, [loadDashboard]);

  // Auth Submit Handlers
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail || !authPassword) {
      toast.error('Please enter email and password');
      return;
    }
    if (authPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    try {
      setAuthSubmitting(true);
      if (isSignUp) {
        const { data, error } = await signUp(authEmail, authPassword, authFullName || 'Investor');
        if (error) throw error;
        toast.success('Account created! Logging you in...');
        if (data?.user) {
          setCurrentUser(data.user);
          await loadDashboard(data.user.id);
        }
      } else {
        const { data, error } = await signIn(authEmail, authPassword);
        if (error) throw error;
        toast.success('Welcome back!');
        if (data?.user) {
          setCurrentUser(data.user);
          await loadDashboard(data.user.id);
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Authentication failed');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    setCurrentUser(null);
    toast.success('Signed out');
  };

  // Copy Admin Wallet
  const handleCopyWallet = () => {
    navigator.clipboard.writeText(ADMIN_BEP20_WALLET);
    setCopiedWallet(true);
    toast.success('BEP-20 Wallet address copied!');
    setTimeout(() => setCopiedWallet(false), 2500);
  };

  // Book Slots
  const handleBookSlots = async () => {
    if (!currentUser) return;
    const totalCost = slotQuantity * 20;

    if (stats.balance < totalCost) {
      toast.error(`Insufficient balance ($${stats.balance.toFixed(2)} USDT). Need $${totalCost} USDT.`);
      setActiveTab('deposit');
      return;
    }

    if (slotQuantity > stats.availableSlots) {
      toast.error(`Only ${stats.availableSlots} slot(s) remaining today!`);
      return;
    }

    try {
      setBookingLoading(true);
      const { data, error } = await bookSlots(currentUser.id, slotQuantity);

      if (error) throw error;

      if (data && !data.success) {
        toast.error(data.message || 'Slot booking failed');
      } else {
        toast.success(`Successfully activated ${slotQuantity} slot(s)!`);
        await loadDashboard(currentUser.id);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to book slots');
    } finally {
      setBookingLoading(false);
    }
  };

  // Deposit Request Submit
  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    const amt = parseFloat(depositAmount);
    if (isNaN(amt) || amt < 20) {
      toast.error('Minimum deposit is $20 USDT (1 slot)');
      return;
    }
    if (!depositTxHash || depositTxHash.trim().length < 10) {
      toast.error('Please enter a valid Transaction Hash (TxHash)');
      return;
    }

    try {
      setDepositSubmitting(true);
      const { error } = await createDepositRequest(currentUser.id, depositTxHash, amt);
      if (error) throw error;

      toast.success('Deposit submitted! Admin will verify and credit your balance.');
      setDepositTxHash('');
      await loadDashboard(currentUser.id);
      setActiveTab('history');
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit deposit');
    } finally {
      setDepositSubmitting(false);
    }
  };

  // Withdrawal Request Submit
  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    const amt = parseFloat(withdrawAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error('Please enter a valid withdrawal amount');
      return;
    }
    if (amt > stats.balance) {
      toast.error(`Amount exceeds available balance ($${stats.balance.toFixed(2)} USDT)`);
      return;
    }
    if (!withdrawAddress || withdrawAddress.trim().length < 15) {
      toast.error('Please enter a valid BEP-20 destination address');
      return;
    }

    try {
      setWithdrawSubmitting(true);
      const { data, error } = await createWithdrawRequest(currentUser.id, withdrawAddress, amt);
      if (error) throw error;

      if (data && !data.success) {
        toast.error(data.message || 'Withdrawal failed');
      } else {
        toast.success('Withdrawal request submitted!');
        setWithdrawAmount('');
        setWithdrawAddress('');
        await loadDashboard(currentUser.id);
        setActiveTab('history');
      }
    } catch (err: any) {
      toast.error(err.message || 'Withdrawal request failed');
    } finally {
      setWithdrawSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0d14] text-[#e8e6e3]">
      {/* Top Header */}
      <header className="site-header">
        <div className="header-inner">
          <div className="flex items-center gap-3">
            <div className="site-logo">
              <span className="dot" />
              <span className="tracking-tight text-white font-black">SLOTPROFIT</span>
              <span className="text-[#53917e] text-xs font-mono font-bold tracking-widest px-2 py-0.5 rounded bg-[#53917e]/15 border border-[#53917e]/30">
                ZONE
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#16162a] border border-[#2a2a42] text-xs font-mono text-[#9b9a97]">
              <span className="w-2 h-2 rounded-full bg-[#4a9e7e] animate-pulse" />
              <span>5% DAILY ROI</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {currentUser ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => loadDashboard(currentUser.id)}
                  disabled={loadingStats}
                  className="p-1.5 rounded bg-[#1a1a2e] hover:bg-[#22223a] text-[#9b9a97] hover:text-white border border-[#2a2a42] transition"
                  title="Refresh stats"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingStats ? 'animate-spin' : ''}`} />
                </button>
                <div className="hidden md:flex flex-col text-right">
                  <span className="text-xs font-medium text-white">{stats.fullName || 'Investor'}</span>
                  <span className="text-[11px] font-mono text-[#9b9a97]">{currentUser.email}</span>
                </div>
                <Link
                  href="/admin"
                  className="px-2.5 py-1 text-xs font-semibold rounded bg-[#1f1f35] border border-[#33334d] text-[#c4b69c] hover:bg-[#2a2a48] transition"
                >
                  Admin
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#22171a] border border-[#5c2424] text-[#e06c75] hover:bg-[#341d22] text-xs font-semibold transition"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            ) : (
              <Link
                href="/admin"
                className="px-3 py-1.5 text-xs font-medium rounded bg-[#1a1a2e] border border-[#2a2a42] text-[#9b9a97] hover:text-white transition"
              >
                Admin Area
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="page-container">
        {authLoading ? (
          <div className="flex flex-col items-center justify-center py-32 text-[#9b9a97]">
            <div className="spinner mb-4" />
            <p className="text-sm font-mono">Loading SlotProfit Zone...</p>
          </div>
        ) : !currentUser ? (
          /* =======================================================
             LOGGED-OUT VIEW: AUTHENTICATION + PLATFORM OVERVIEW
             ======================================================= */
          <div className="fade-in max-w-lg mx-auto pt-6">
            {/* Value Proposition Badge */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#16213e] border border-[#2a2a42] text-[#53917e] text-xs font-semibold mb-3">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Simplicity • Predictability • Transparency</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-2">
                5% Daily ROI Platform
              </h1>
              <p className="text-sm text-[#9b9a97] max-w-sm mx-auto">
                Fixed $20 slots. Strictly 75 slots per day. 2x maximum payout cap ($40 payout per slot).
              </p>
            </div>

            {/* Quick 3-Pillar Highlight */}
            <div className="grid grid-cols-3 gap-3 mb-8">
              <div className="p-3 rounded-lg bg-[#14141f] border border-[#2a2a42] text-center">
                <div className="text-lg font-bold text-[#53917e]">5.0%</div>
                <div className="text-[11px] text-[#9b9a97] font-medium uppercase tracking-wider">Daily Return</div>
              </div>
              <div className="p-3 rounded-lg bg-[#14141f] border border-[#2a2a42] text-center">
                <div className="text-lg font-bold text-[#c4b69c]">75 Slots</div>
                <div className="text-[11px] text-[#9b9a97] font-medium uppercase tracking-wider">Daily Limit</div>
              </div>
              <div className="p-3 rounded-lg bg-[#14141f] border border-[#2a2a42] text-center">
                <div className="text-lg font-bold text-[#4a9e7e]">2X Cap</div>
                <div className="text-[11px] text-[#9b9a97] font-medium uppercase tracking-wider">$40 Max / Slot</div>
              </div>
            </div>

            {/* Auth Form Card */}
            <div className="card shadow-lg">
              <div className="tab-group mb-6">
                <button
                  type="button"
                  className={`tab ${!isSignUp ? 'active' : ''}`}
                  onClick={() => setIsSignUp(false)}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  className={`tab ${isSignUp ? 'active' : ''}`}
                  onClick={() => setIsSignUp(true)}
                >
                  Create Account
                </button>
              </div>

              <form onSubmit={handleAuth} className="space-y-4">
                {isSignUp && (
                  <div className="input-group mb-0">
                    <label className="input-label">Full Name</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. Alex Vance"
                      value={authFullName}
                      onChange={(e) => setAuthFullName(e.target.value)}
                    />
                  </div>
                )}

                <div className="input-group mb-0">
                  <label className="input-label">Email Address</label>
                  <input
                    type="email"
                    required
                    className="input"
                    placeholder="name@example.com"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                  />
                </div>

                <div className="input-group mb-0">
                  <label className="input-label">Password</label>
                  <input
                    type="password"
                    required
                    className="input"
                    placeholder="••••••••"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  disabled={authSubmitting}
                  className="btn btn-primary btn-full mt-2"
                >
                  {authSubmitting ? (
                    <div className="spinner" />
                  ) : isSignUp ? (
                    'Register & Enter Platform'
                  ) : (
                    'Log In to Dashboard'
                  )}
                </button>
              </form>

              <div className="mt-6 pt-4 border-t border-[#2a2a42] text-center">
                <p className="text-xs text-[#9b9a97]">
                  All deposits are verified directly via BEP-20 USDT transaction hashes.
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* =======================================================
             LOGGED-IN VIEW: ALL-IN-ONE SIMPLE DASHBOARD
             ======================================================= */
          <div className="fade-in space-y-6">
            {/* Top Greeting & Balance Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-[#14141f] border border-[#2a2a42]">
              <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                  <span>Welcome back, {stats.fullName || 'Investor'}</span>
                </h1>
                <p className="text-xs text-[#9b9a97]">
                  Manage your active slots, deposit USDT (BEP-20), and monitor daily 5% returns.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('deposit')}
                  className="btn btn-primary btn-sm"
                >
                  <ArrowDownToLine className="w-3.5 h-3.5" />
                  Deposit
                </button>
                <button
                  onClick={() => setActiveTab('withdraw')}
                  className="btn btn-outline btn-sm"
                >
                  <ArrowUpFromLine className="w-3.5 h-3.5" />
                  Withdraw
                </button>
              </div>
            </div>

            {/* 4 Matte Stats Cards */}
            <div className="stats-grid">
              {/* Stat 1: Balance */}
              <div className="stat-card">
                <div className="flex items-center justify-between mb-2">
                  <span className="stat-label">Available Balance</span>
                  <Wallet className="w-4 h-4 text-[#53917e]" />
                </div>
                <div className="stat-value accent">
                  ${stats.balance.toFixed(2)}{' '}
                  <span className="text-xs font-mono text-[#9b9a97] font-normal">USDT</span>
                </div>
                <div className="text-[11px] text-[#9b9a97] mt-1">Ready to book slots or withdraw</div>
              </div>

              {/* Stat 2: Active Slots */}
              <div className="stat-card">
                <div className="flex items-center justify-between mb-2">
                  <span className="stat-label">Active Slots</span>
                  <Layers className="w-4 h-4 text-[#c4b69c]" />
                </div>
                <div className="stat-value warm">
                  {stats.activeSlotsCount}{' '}
                  <span className="text-xs font-mono text-[#9b9a97] font-normal">
                    (${stats.activeSlotsCount * 20} invested)
                  </span>
                </div>
                <div className="text-[11px] text-[#9b9a97] mt-1">
                  Earning ${(stats.activeSlotsCount * 1.0).toFixed(2)}/day
                </div>
              </div>

              {/* Stat 3: Today's ROI */}
              <div className="stat-card">
                <div className="flex items-center justify-between mb-2">
                  <span className="stat-label">Today's Earnings</span>
                  <TrendingUp className="w-4 h-4 text-[#4a9e7e]" />
                </div>
                <div className="stat-value text-[#4a9e7e]">
                  +${stats.todayEarned.toFixed(2)}{' '}
                  <span className="text-xs font-mono text-[#9b9a97] font-normal">USDT</span>
                </div>
                <div className="text-[11px] text-[#9b9a97] mt-1">5% credited today</div>
              </div>

              {/* Stat 4: Total Payout Earned */}
              <div className="stat-card">
                <div className="flex items-center justify-between mb-2">
                  <span className="stat-label">Total Earned</span>
                  <Coins className="w-4 h-4 text-[#5a7fa8]" />
                </div>
                <div className="stat-value text-[#e8e6e3]">
                  ${stats.totalEarned.toFixed(2)}{' '}
                  <span className="text-xs font-mono text-[#9b9a97] font-normal">USDT</span>
                </div>
                <div className="text-[11px] text-[#9b9a97] mt-1">
                  {stats.completedSlotsCount} completed slot(s)
                </div>
              </div>
            </div>

            {/* Daily Availability Banner */}
            <div className="availability-bar justify-between flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-[#53917e] animate-pulse" />
                <div>
                  <div className="text-xs font-bold text-white uppercase tracking-wider">
                    Today's Slot Pool
                  </div>
                  <div className="text-xs text-[#9b9a97]">
                    Strict maximum of 75 slots open per 24h cycle
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="text-xs text-[#9b9a97]">Available Today: </span>
                  <span className="availability-count">
                    {stats.availableSlots} / {stats.maxSlots}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-24 sm:w-32 h-2.5 bg-[#0d0d14] rounded-full overflow-hidden border border-[#2a2a42]">
                  <div
                    className="h-full bg-[#53917e] transition-all duration-500"
                    style={{
                      width: `${Math.min(100, ((stats.maxSlots - stats.availableSlots) / stats.maxSlots) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Main Tabs Navigation */}
            <div className="tab-group">
              <button
                type="button"
                className={`tab ${activeTab === 'slots' ? 'active' : ''}`}
                onClick={() => setActiveTab('slots')}
              >
                <span className="flex items-center justify-center gap-2">
                  <Layers className="w-4 h-4" />
                  <span>Book Slots</span>
                </span>
              </button>
              <button
                type="button"
                className={`tab ${activeTab === 'deposit' ? 'active' : ''}`}
                onClick={() => setActiveTab('deposit')}
              >
                <span className="flex items-center justify-center gap-2">
                  <ArrowDownToLine className="w-4 h-4" />
                  <span>Deposit USDT</span>
                </span>
              </button>
              <button
                type="button"
                className={`tab ${activeTab === 'withdraw' ? 'active' : ''}`}
                onClick={() => setActiveTab('withdraw')}
              >
                <span className="flex items-center justify-center gap-2">
                  <ArrowUpFromLine className="w-4 h-4" />
                  <span>Withdraw</span>
                </span>
              </button>
              <button
                type="button"
                className={`tab ${activeTab === 'history' ? 'active' : ''}`}
                onClick={() => setActiveTab('history')}
              >
                <span className="flex items-center justify-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>History & Slots</span>
                </span>
              </button>
            </div>

            {/* =======================================================
                TAB 1: BOOK SLOTS
                ======================================================= */}
            {activeTab === 'slots' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Left: Slot Purchase Controller */}
                <div className="md:col-span-2 card">
                  <div className="card-header">
                    <Layers />
                    <span>Activate Daily Slots ($20 each)</span>
                  </div>

                  <p className="text-xs text-[#9b9a97] mb-6">
                    Each slot costs <strong className="text-white">$20.00 USDT</strong> and yields{' '}
                    <strong className="text-[#53917e]">5% daily ($1.00/day)</strong> until it reaches{' '}
                    <strong className="text-[#c4b69c]">$40.00 (2x cap)</strong>, then automatically completes.
                  </p>

                  {/* Quantity selector */}
                  <div className="p-4 rounded-xl bg-[#14141f] border border-[#2a2a42] mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-semibold uppercase tracking-wider text-[#9b9a97]">
                        Select Quantity
                      </span>
                      <span className="text-xs font-mono text-[#c4b69c]">
                        Cost: ${(slotQuantity * 20).toFixed(2)} USDT
                      </span>
                    </div>

                    <div className="flex items-center justify-center gap-4 py-2">
                      <button
                        type="button"
                        onClick={() => setSlotQuantity((q) => Math.max(1, q - 1))}
                        disabled={slotQuantity <= 1}
                        className="w-10 h-10 rounded-lg bg-[#1a1a2e] border border-[#33334d] flex items-center justify-center text-white hover:border-[#53917e] disabled:opacity-30 transition"
                      >
                        <Minus className="w-4 h-4" />
                      </button>

                      <div className="text-3xl font-extrabold font-mono text-white min-w-[60px] text-center">
                        {slotQuantity}
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setSlotQuantity((q) => Math.min(stats.availableSlots || 75, q + 1))
                        }
                        disabled={slotQuantity >= stats.availableSlots}
                        className="w-10 h-10 rounded-lg bg-[#1a1a2e] border border-[#33334d] flex items-center justify-center text-white hover:border-[#53917e] disabled:opacity-30 transition"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Quick quantity presets */}
                    <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-[#2a2a42]">
                      {[1, 2, 5, 10].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setSlotQuantity(Math.min(stats.availableSlots, preset))}
                          className={`px-3 py-1 rounded text-xs font-mono font-medium border transition ${
                            slotQuantity === preset
                              ? 'bg-[#53917e]/20 border-[#53917e] text-white'
                              : 'bg-[#1a1a2e] border-[#2a2a42] text-[#9b9a97] hover:text-white'
                          }`}
                        >
                          {preset} {preset === 1 ? 'Slot' : 'Slots'} (${preset * 20})
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Summary Breakdown */}
                  <div className="space-y-2 mb-6 text-xs text-[#9b9a97] font-mono">
                    <div className="flex justify-between">
                      <span>Total Investment:</span>
                      <span className="text-white">${(slotQuantity * 20).toFixed(2)} USDT</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Daily 5% ROI:</span>
                      <span className="text-[#53917e]">
                        +${(slotQuantity * 1.0).toFixed(2)} USDT / day
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Payout at 2x Cap:</span>
                      <span className="text-[#c4b69c]">${(slotQuantity * 40).toFixed(2)} USDT</span>
                    </div>
                    <div className="flex justify-between border-t border-[#2a2a42] pt-2">
                      <span>Your Balance:</span>
                      <span className={stats.balance < slotQuantity * 20 ? 'text-[#b85450]' : 'text-white'}>
                        ${stats.balance.toFixed(2)} USDT
                      </span>
                    </div>
                  </div>

                  {/* Action button */}
                  {stats.balance < slotQuantity * 20 ? (
                    <button
                      type="button"
                      onClick={() => setActiveTab('deposit')}
                      className="btn btn-warm btn-full"
                    >
                      <ArrowDownToLine className="w-4 h-4" />
                      Deposit ${(slotQuantity * 20 - stats.balance).toFixed(2)} More to Book
                    </button>
                  ) : stats.availableSlots <= 0 ? (
                    <button disabled className="btn btn-primary btn-full">
                      All 75 Slots Sold Out Today
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleBookSlots}
                      disabled={bookingLoading}
                      className="btn btn-primary btn-full"
                    >
                      {bookingLoading ? (
                        <div className="spinner" />
                      ) : (
                        `Confirm & Activate ${slotQuantity} Slot(s) for $${slotQuantity * 20} USDT`
                      )}
                    </button>
                  )}
                </div>

                {/* Right: Rules & Info Box */}
                <div className="card space-y-4">
                  <div className="card-header">
                    <ShieldCheck />
                    <span>Slot Rules & Policy</span>
                  </div>

                  <ul className="space-y-3 text-xs text-[#9b9a97]">
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#53917e] mt-1.5 shrink-0" />
                      <span>
                        <strong className="text-white">5% Daily Yield:</strong> Each $20 slot pays out $1.00 USDT every 24 hours.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#c4b69c] mt-1.5 shrink-0" />
                      <span>
                        <strong className="text-white">200% Payout Cap:</strong> Slot automatically halts once it distributes exactly $40.00.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#5a7fa8] mt-1.5 shrink-0" />
                      <span>
                        <strong className="text-white">Strict 75/Day Cap:</strong> Only 75 global slots are minted each day to preserve sustainability.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#4a9e7e] mt-1.5 shrink-0" />
                      <span>
                        <strong className="text-white">Anytime Withdrawal:</strong> ROI balance is immediately available for withdrawal.
                      </span>
                    </li>
                  </ul>

                  <div className="p-3 rounded-lg bg-[#16162a] border border-[#2a2a42] text-[11px] text-[#9b9a97] mt-4">
                    Daily distribution is executed every 24 hours UTC. Payouts credit instantly to your total balance.
                  </div>
                </div>
              </div>
            )}

            {/* =======================================================
                TAB 2: DEPOSIT USDT (BEP-20)
                ======================================================= */}
            {activeTab === 'deposit' && (
              <div className="max-w-xl mx-auto card space-y-6">
                <div className="card-header">
                  <ArrowDownToLine />
                  <span>Deposit USDT (BEP-20 / Binance Smart Chain)</span>
                </div>

                {/* Deposit Steps */}
                <div className="space-y-4">
                  <div>
                    <label className="input-label">Step 1: Send USDT (BEP-20) to this official address</label>
                    <div
                      onClick={handleCopyWallet}
                      className="wallet-display flex items-center justify-between gap-2"
                      title="Click to copy"
                    >
                      <span className="truncate">{ADMIN_BEP20_WALLET}</span>
                      <button type="button" className="shrink-0 p-1 rounded bg-[#22223a] text-white">
                        {copiedWallet ? <Check className="w-3.5 h-3.5 text-[#4a9e7e]" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <span className="text-[11px] text-[#9b9a97] mt-1 block">
                      ⚠️ Send <strong>ONLY BEP-20 (BSC) USDT</strong>. Other tokens or chains will be lost.
                    </span>
                  </div>

                  <form onSubmit={handleDepositSubmit} className="space-y-4 pt-2">
                    <div className="input-group mb-0">
                      <label className="input-label">Step 2: Enter Amount Deposited ($ USDT)</label>
                      <input
                        type="number"
                        min="20"
                        step="1"
                        required
                        className="input"
                        placeholder="20"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                      />
                      <span className="text-[11px] text-[#9b9a97] mt-1 block">
                        Minimum deposit: $20.00 (1 slot)
                      </span>
                    </div>

                    <div className="input-group mb-0">
                      <label className="input-label">Step 3: Paste Transaction Hash (TxHash)</label>
                      <input
                        type="text"
                        required
                        className="input font-mono text-xs"
                        placeholder="0x..."
                        value={depositTxHash}
                        onChange={(e) => setDepositTxHash(e.target.value)}
                      />
                      <span className="text-[11px] text-[#9b9a97] mt-1 block">
                        Copy the transaction hash from your wallet / BscScan after sending.
                      </span>
                    </div>

                    <button
                      type="submit"
                      disabled={depositSubmitting}
                      className="btn btn-primary btn-full mt-4"
                    >
                      {depositSubmitting ? <div className="spinner" /> : 'Submit Deposit for Verification'}
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* =======================================================
                TAB 3: WITHDRAWAL
                ======================================================= */}
            {activeTab === 'withdraw' && (
              <div className="max-w-xl mx-auto card space-y-6">
                <div className="card-header">
                  <ArrowUpFromLine />
                  <span>Withdraw USDT (BEP-20)</span>
                </div>

                <div className="p-3 rounded-lg bg-[#14141f] border border-[#2a2a42] flex justify-between items-center text-xs">
                  <span className="text-[#9b9a97]">Available to Withdraw:</span>
                  <span className="text-base font-bold font-mono text-[#53917e]">
                    ${stats.balance.toFixed(2)} USDT
                  </span>
                </div>

                <form onSubmit={handleWithdrawSubmit} className="space-y-4">
                  <div className="input-group mb-0">
                    <label className="input-label">Destination BEP-20 Wallet Address</label>
                    <input
                      type="text"
                      required
                      className="input font-mono text-xs"
                      placeholder="0x..."
                      value={withdrawAddress}
                      onChange={(e) => setWithdrawAddress(e.target.value)}
                    />
                  </div>

                  <div className="input-group mb-0">
                    <div className="flex justify-between items-center mb-1">
                      <label className="input-label mb-0">Amount to Withdraw ($ USDT)</label>
                      <button
                        type="button"
                        onClick={() => setWithdrawAmount(stats.balance.toString())}
                        className="text-[11px] font-mono text-[#53917e] hover:underline"
                      >
                        MAX
                      </button>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      max={stats.balance}
                      required
                      className="input"
                      placeholder="0.00"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                    />
                  </div>

                  <div className="text-[11px] text-[#9b9a97] space-y-1">
                    <p>• Withdrawals are processed directly in BEP-20 USDT by admin.</p>
                    <p>• Once submitted, the amount is deducted and queued for dispatch.</p>
                  </div>

                  <button
                    type="submit"
                    disabled={withdrawSubmitting || stats.balance <= 0}
                    className="btn btn-warm btn-full"
                  >
                    {withdrawSubmitting ? <div className="spinner" /> : 'Confirm Withdrawal Request'}
                  </button>
                </form>
              </div>
            )}

            {/* =======================================================
                TAB 4: MY SLOTS & TRANSACTION HISTORY
                ======================================================= */}
            {activeTab === 'history' && (
              <div className="space-y-6">
                {/* Active Slots Cards */}
                <div className="card">
                  <div className="card-header">
                    <Layers />
                    <span>My Slot Bookings ({stats.slots?.length || 0})</span>
                  </div>

                  {stats.slots?.length === 0 ? (
                    <div className="empty-state">
                      <Layers />
                      <p>You do not have any slots yet.</p>
                      <button
                        onClick={() => setActiveTab('slots')}
                        className="btn btn-primary btn-sm mt-3"
                      >
                        Book Your First Slot ($20)
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {stats.slots.map((slot: any, idx: number) => {
                        const earned = Number(slot.total_earned || 0);
                        const max = Number(slot.max_payout || 40);
                        const progress = Math.min(100, (earned / max) * 100);
                        const isActive = slot.status === 'active';

                        return (
                          <div
                            key={slot.id || idx}
                            className="p-3.5 rounded-lg bg-[#14141f] border border-[#2a2a42] space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-mono font-bold text-white">
                                Slot #{idx + 1}
                              </span>
                              <span
                                className={`badge ${isActive ? 'badge-success' : 'badge-info'}`}
                              >
                                {isActive ? 'Active (5%/d)' : 'Completed (2x)'}
                              </span>
                            </div>

                            <div className="flex justify-between text-xs text-[#9b9a97] font-mono">
                              <span>Invested:</span>
                              <span className="text-white">${Number(slot.amount).toFixed(2)}</span>
                            </div>

                            <div className="flex justify-between text-xs text-[#9b9a97] font-mono">
                              <span>Total Earned:</span>
                              <span className="text-[#53917e] font-bold">
                                ${earned.toFixed(2)} / ${max.toFixed(2)}
                              </span>
                            </div>

                            {/* Progress bar */}
                            <div>
                              <div className="progress-bar">
                                <div
                                  className="progress-fill"
                                  style={{
                                    width: `${progress}%`,
                                    background: isActive ? '#53917e' : '#5a7fa8',
                                  }}
                                />
                              </div>
                              <span className="text-[10px] text-[#9b9a97] font-mono mt-1 block text-right">
                                {progress.toFixed(0)}% of 2x cap
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Transaction History Table */}
                <div className="card">
                  <div className="card-header">
                    <Clock />
                    <span>Transaction History</span>
                  </div>

                  {stats.transactions?.length === 0 ? (
                    <div className="empty-state">
                      <Clock />
                      <p>No transactions found.</p>
                    </div>
                  ) : (
                    <div className="table-container">
                      <table>
                        <thead>
                          <tr>
                            <th>Type</th>
                            <th>Amount</th>
                            <th>Status</th>
                            <th>Date (UTC)</th>
                            <th>Details</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.transactions.map((tx: any) => {
                            const isDeposit = tx.type === 'deposit';
                            const isWithdrawal = tx.type === 'withdrawal';
                            const isRoi = tx.type === 'roi_distribution';

                            return (
                              <tr key={tx.id}>
                                <td className="font-semibold capitalize text-white">
                                  {isDeposit
                                    ? '📥 Deposit'
                                    : isWithdrawal
                                    ? '📤 Withdrawal'
                                    : isRoi
                                    ? '✨ Daily 5% ROI'
                                    : '⚡ Slot Purchase'}
                                </td>
                                <td className="font-mono font-bold text-white">
                                  {isWithdrawal ? '-' : '+'}${Number(tx.amount).toFixed(2)} USDT
                                </td>
                                <td>
                                  <span
                                    className={`badge ${
                                      tx.status === 'approved'
                                        ? 'badge-success'
                                        : tx.status === 'pending'
                                        ? 'badge-warning'
                                        : 'badge-danger'
                                    }`}
                                  >
                                    {tx.status}
                                  </span>
                                </td>
                                <td className="text-xs text-[#9b9a97] font-mono">
                                  {new Date(tx.created_at).toLocaleString()}
                                </td>
                                <td className="text-xs font-mono text-[#9b9a97] max-w-[150px] truncate">
                                  {tx.tx_hash
                                    ? `Tx: ${tx.tx_hash.slice(0, 10)}...`
                                    : tx.destination_address
                                    ? `To: ${tx.destination_address.slice(0, 10)}...`
                                    : '-'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-20 border-t border-[#1f1f35] py-8 text-center text-xs text-[#9b9a97]">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#53917e]" />
            <span className="font-bold text-white">SlotProfit Zone</span>
            <span>— 5% Daily ROI Platform</span>
          </div>
          <div className="text-[11px] text-[#6b6a68]">
            Max 75 Slots/Day • 2x Payout Cap • Built for Speed & Transparency
          </div>
        </div>
      </footer>
    </div>
  );
}
