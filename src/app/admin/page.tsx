'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  getAdminTransactions,
  getAdminAllSlots,
  approveDeposit,
  rejectDeposit,
  approveWithdrawal,
  rejectWithdrawal,
  triggerDailyRoiDistribution,
} from '@/lib/supabase';
import toast from 'react-hot-toast';
import {
  ShieldAlert,
  ArrowLeft,
  Check,
  X,
  RefreshCw,
  Coins,
  ArrowDownToLine,
  ArrowUpFromLine,
  Layers,
  ExternalLink,
  Sparkles,
  Lock,
} from 'lucide-react';

const ADMIN_PASSCODE = 'admin123';

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [transactions, setTransactions] = useState<any[]>([]);
  const [slots, setSlots] = useState<any[]>([]);
  const [adminTab, setAdminTab] = useState<'deposits' | 'withdrawals' | 'slots' | 'all'>('deposits');

  const loadAdminData = useCallback(async () => {
    try {
      setLoading(true);
      const [txRes, slotRes] = await Promise.all([
        getAdminTransactions(),
        getAdminAllSlots(),
      ]);
      setTransactions(txRes.data || []);
      setSlots(slotRes.data || []);
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadAdminData();
    }
  }, [isAuthenticated, loadAdminData]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode === ADMIN_PASSCODE) {
      setIsAuthenticated(true);
      toast.success('Admin authorized');
    } else {
      toast.error('Incorrect admin passcode');
    }
  };

  // Actions
  const handleApproveDeposit = async (txId: string) => {
    try {
      setActionLoading(txId);
      const { data, error } = await approveDeposit(txId);
      if (error) throw error;
      if (data && !data.success) {
        toast.error(data.message || 'Approval failed');
      } else {
        toast.success(data?.message || 'Deposit approved and balance credited!');
        await loadAdminData();
      }
    } catch (err: any) {
      toast.error(err.message || 'Deposit approval failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectDeposit = async (txId: string) => {
    try {
      setActionLoading(txId);
      const { error } = await rejectDeposit(txId);
      if (error) throw error;
      toast.success('Deposit rejected');
      await loadAdminData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject deposit');
    } finally {
      setActionLoading(null);
    }
  };

  const handleApproveWithdrawal = async (txId: string) => {
    try {
      setActionLoading(txId);
      const { error } = await approveWithdrawal(txId);
      if (error) throw error;
      toast.success('Withdrawal marked as sent & approved!');
      await loadAdminData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve withdrawal');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectWithdrawal = async (txId: string) => {
    try {
      setActionLoading(txId);
      const { data, error } = await rejectWithdrawal(txId);
      if (error) throw error;
      if (data && !data.success) {
        toast.error(data.message || 'Rejection failed');
      } else {
        toast.success(data?.message || 'Withdrawal rejected & refunded to user');
        await loadAdminData();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject withdrawal');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDistributeDailyRoi = async () => {
    if (!confirm('Are you sure you want to run 5% daily ROI distribution now?')) return;
    try {
      setActionLoading('roi');
      const { data, error } = await triggerDailyRoiDistribution();
      if (error) throw error;
      toast.success(
        `ROI Distributed! Processed ${data?.slots_processed || 0} slots ($${data?.total_distributed || 0} USDT)`
      );
      await loadAdminData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to run ROI distribution');
    } finally {
      setActionLoading(null);
    }
  };

  const pendingDeposits = transactions.filter((t) => t.type === 'deposit' && t.status === 'pending');
  const pendingWithdrawals = transactions.filter((t) => t.type === 'withdrawal' && t.status === 'pending');

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0d0d14] flex items-center justify-center p-4">
        <div className="card max-w-sm w-full text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-[#1f1f35] border border-[#33334d] flex items-center justify-center mx-auto text-[#c4b69c]">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-white">Admin Authentication</h1>
          <p className="text-xs text-[#9b9a97]">Enter administrator passcode to access management tools</p>

          <form onSubmit={handleLogin} className="space-y-3 pt-2">
            <input
              type="password"
              required
              className="input text-center text-sm font-mono tracking-widest"
              placeholder="Passcode (default: admin123)"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
            />
            <button type="submit" className="btn btn-primary btn-full">
              Enter Admin Portal
            </button>
          </form>

          <Link
            href="/"
            className="inline-flex items-center gap-1 text-xs text-[#9b9a97] hover:text-white pt-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Main Site
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0d14] text-[#e8e6e3]">
      {/* Header */}
      <header className="site-header">
        <div className="header-inner">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-1.5 rounded bg-[#1a1a2e] text-[#9b9a97] hover:text-white border border-[#2a2a42] transition"
              title="Return to user page"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="site-logo">
              <span className="dot" />
              <span>SLOTPROFIT ADMIN</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleDistributeDailyRoi}
              disabled={actionLoading === 'roi'}
              className="btn btn-primary btn-sm"
              title="Distribute 5% to all active slots"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{actionLoading === 'roi' ? 'Distributing...' : 'Run 5% Daily ROI'}</span>
            </button>

            <button
              onClick={loadAdminData}
              disabled={loading}
              className="p-1.5 rounded bg-[#1a1a2e] text-[#9b9a97] hover:text-white border border-[#2a2a42]"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="page-container">
        {/* Top Overview Cards */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Pending Deposits</div>
            <div className="stat-value warm">{pendingDeposits.length}</div>
            <div className="text-[11px] text-[#9b9a97] mt-1">Awaiting hash verification</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Pending Withdrawals</div>
            <div className="stat-value text-[#b85450]">{pendingWithdrawals.length}</div>
            <div className="text-[11px] text-[#9b9a97] mt-1">Ready for BEP-20 transfer</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Active Slots</div>
            <div className="stat-value accent">
              {slots.filter((s) => s.status === 'active').length}
            </div>
            <div className="text-[11px] text-[#9b9a97] mt-1">Earning 5% daily</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Completed Slots</div>
            <div className="stat-value text-[#5a7fa8]">
              {slots.filter((s) => s.status === 'completed').length}
            </div>
            <div className="text-[11px] text-[#9b9a97] mt-1">Reached 2x cap</div>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="tab-group mb-6">
          <button
            type="button"
            className={`tab ${adminTab === 'deposits' ? 'active' : ''}`}
            onClick={() => setAdminTab('deposits')}
          >
            Pending Deposits ({pendingDeposits.length})
          </button>
          <button
            type="button"
            className={`tab ${adminTab === 'withdrawals' ? 'active' : ''}`}
            onClick={() => setAdminTab('withdrawals')}
          >
            Pending Withdrawals ({pendingWithdrawals.length})
          </button>
          <button
            type="button"
            className={`tab ${adminTab === 'slots' ? 'active' : ''}`}
            onClick={() => setAdminTab('slots')}
          >
            All Slots ({slots.length})
          </button>
          <button
            type="button"
            className={`tab ${adminTab === 'all' ? 'active' : ''}`}
            onClick={() => setAdminTab('all')}
          >
            All Transactions ({transactions.length})
          </button>
        </div>

        {/* TAB 1: PENDING DEPOSITS */}
        {adminTab === 'deposits' && (
          <div className="card">
            <div className="card-header">
              <ArrowDownToLine />
              <span>Pending Deposits Verification</span>
            </div>

            {pendingDeposits.length === 0 ? (
              <div className="empty-state">
                <p>No pending deposits waiting for review.</p>
              </div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Amount</th>
                      <th>TxHash Proof</th>
                      <th>Time</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingDeposits.map((tx) => (
                      <tr key={tx.id}>
                        <td>
                          <div className="font-semibold text-white">
                            {tx.users?.full_name || 'User'}
                          </div>
                          <div className="text-xs text-[#9b9a97] font-mono">{tx.users?.email}</div>
                        </td>
                        <td className="font-mono font-bold text-[#53917e]">
                          ${Number(tx.amount).toFixed(2)} USDT
                        </td>
                        <td className="font-mono text-xs">
                          {tx.tx_hash ? (
                            <a
                              href={`https://bscscan.com/tx/${tx.tx_hash}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[#c4b69c] hover:underline flex items-center gap-1"
                            >
                              <span>{tx.tx_hash.slice(0, 16)}...</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="text-xs text-[#9b9a97]">
                          {new Date(tx.created_at).toLocaleString()}
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleApproveDeposit(tx.id)}
                              disabled={actionLoading === tx.id}
                              className="px-3 py-1 rounded bg-[#4a9e7e] hover:bg-[#3d8569] text-white text-xs font-semibold flex items-center gap-1 transition"
                            >
                              <Check className="w-3.5 h-3.5" /> Approve
                            </button>
                            <button
                              onClick={() => handleRejectDeposit(tx.id)}
                              disabled={actionLoading === tx.id}
                              className="px-3 py-1 rounded bg-[#b85450] hover:bg-[#9e433f] text-white text-xs font-semibold flex items-center gap-1 transition"
                            >
                              <X className="w-3.5 h-3.5" /> Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: PENDING WITHDRAWALS */}
        {adminTab === 'withdrawals' && (
          <div className="card">
            <div className="card-header">
              <ArrowUpFromLine />
              <span>Pending Withdrawals Dispatch</span>
            </div>

            {pendingWithdrawals.length === 0 ? (
              <div className="empty-state">
                <p>No pending withdrawals waiting for payout.</p>
              </div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Amount</th>
                      <th>Destination Address (BEP-20)</th>
                      <th>Time</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingWithdrawals.map((tx) => (
                      <tr key={tx.id}>
                        <td>
                          <div className="font-semibold text-white">
                            {tx.users?.full_name || 'User'}
                          </div>
                          <div className="text-xs text-[#9b9a97] font-mono">{tx.users?.email}</div>
                        </td>
                        <td className="font-mono font-bold text-[#b85450]">
                          ${Number(tx.amount).toFixed(2)} USDT
                        </td>
                        <td className="font-mono text-xs text-[#c4b69c] select-all">
                          {tx.destination_address}
                        </td>
                        <td className="text-xs text-[#9b9a97]">
                          {new Date(tx.created_at).toLocaleString()}
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleApproveWithdrawal(tx.id)}
                              disabled={actionLoading === tx.id}
                              className="px-3 py-1 rounded bg-[#4a9e7e] hover:bg-[#3d8569] text-white text-xs font-semibold flex items-center gap-1 transition"
                            >
                              <Check className="w-3.5 h-3.5" /> Mark Sent
                            </button>
                            <button
                              onClick={() => handleRejectWithdrawal(tx.id)}
                              disabled={actionLoading === tx.id}
                              className="px-3 py-1 rounded bg-[#b85450] hover:bg-[#9e433f] text-white text-xs font-semibold flex items-center gap-1 transition"
                            >
                              <X className="w-3.5 h-3.5" /> Reject & Refund
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: ALL SLOTS */}
        {adminTab === 'slots' && (
          <div className="card">
            <div className="card-header">
              <Layers />
              <span>All Slot Bookings</span>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Invested</th>
                    <th>Earned / Cap</th>
                    <th>Status</th>
                    <th>Booked At</th>
                  </tr>
                </thead>
                <tbody>
                  {slots.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <div className="font-semibold text-white">{s.users?.full_name || 'User'}</div>
                        <div className="text-xs text-[#9b9a97] font-mono">{s.users?.email}</div>
                      </td>
                      <td className="font-mono font-bold text-white">
                        ${Number(s.amount).toFixed(2)}
                      </td>
                      <td className="font-mono text-xs text-[#53917e]">
                        ${Number(s.total_earned).toFixed(2)} / ${Number(s.max_payout).toFixed(2)}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            s.status === 'active' ? 'badge-success' : 'badge-info'
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="text-xs text-[#9b9a97]">
                        {new Date(s.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: ALL TRANSACTIONS */}
        {adminTab === 'all' && (
          <div className="card">
            <div className="card-header">
              <Coins />
              <span>All Transaction Records</span>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>User</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td className="font-semibold capitalize text-white">{tx.type}</td>
                      <td>
                        <div className="text-xs font-semibold text-white">{tx.users?.full_name || 'User'}</div>
                        <div className="text-[11px] text-[#9b9a97] font-mono">{tx.users?.email}</div>
                      </td>
                      <td className="font-mono font-bold text-white">
                        ${Number(tx.amount).toFixed(2)}
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
                      <td className="text-xs text-[#9b9a97]">
                        {new Date(tx.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
