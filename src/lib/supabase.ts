import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://eryfyevfmfnsmdounlrb.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVyeWZ5ZXZmbWZuc21kb3VubHJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwODc5ODQsImV4cCI6MjEwODY2Mzk4NH0.xinn6okU8ggdbwFjfeRHbcM5d_DZ9HtqUiKXeugc3Dk';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// =====================
// AUTH FUNCTIONS
// =====================

export async function signUp(email: string, password: string, fullName: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  });
  return { data, error };
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  return { user, error };
}

export function onAuthStateChange(callback: (event: string, session: any) => void) {
  return supabase.auth.onAuthStateChange(callback);
}

// =====================
// USER PROFILE
// =====================

export async function getUserProfile(userId: string) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error fetching user profile:', error.message);
    return null;
  }
  return data;
}

// =====================
// TRANSACTIONS
// =====================

export async function createDepositRequest(userId: string, txHash: string, amount: number) {
  const { data, error } = await supabase
    .from('transactions')
    .insert([
      {
        user_id: userId,
        type: 'deposit',
        amount: Number(amount),
        tx_hash: txHash.trim(),
        status: 'pending',
      },
    ])
    .select()
    .single();

  return { data, error };
}

export async function createWithdrawRequest(userId: string, destinationAddress: string, amount: number) {
  // Call RPC to safely check balance, deduct, and create withdrawal transaction atomically
  const { data, error } = await supabase.rpc('request_withdrawal', {
    p_user_id: userId,
    p_destination: destinationAddress.trim(),
    p_amount: Number(amount),
  });

  return { data, error };
}

export async function getUserTransactions(userId: string) {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Error fetching transactions:', error);
    return [];
  }
  return data || [];
}

// =====================
// SLOTS
// =====================

export async function getDailySlotsConfig() {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('daily_slots_config')
    .select('*')
    .eq('booking_date', today)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching daily slots:', error);
  }

  return data || { booking_date: today, slots_booked: 0, max_slots: 75 };
}

export async function getUserSlots(userId: string) {
  const { data, error } = await supabase
    .from('slot_bookings')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching user slots:', error);
    return [];
  }
  return data || [];
}

export async function bookSlots(userId: string, quantity: number) {
  const { data, error } = await supabase.rpc('process_slot_booking', {
    p_user_id: userId,
    p_quantity: quantity,
  });

  return { data, error };
}

// =====================
// DASHBOARD STATS
// =====================

export async function getDashboardStats(userId: string) {
  const [profile, slots, txs, dailyConfig] = await Promise.all([
    getUserProfile(userId),
    getUserSlots(userId),
    getUserTransactions(userId),
    getDailySlotsConfig(),
  ]);

  const activeSlots = slots.filter((s: any) => s.status === 'active');
  const completedSlots = slots.filter((s: any) => s.status === 'completed');

  const totalEarned = slots.reduce((acc: number, s: any) => acc + Number(s.total_earned || 0), 0);
  const totalInvested = (activeSlots.length + completedSlots.length) * 20;

  // Today's UTC string
  const todayDateStr = new Date().toISOString().split('T')[0];
  const todayEarned = txs
    .filter((tx: any) => tx.type === 'roi_distribution' && tx.created_at?.startsWith(todayDateStr))
    .reduce((acc: number, tx: any) => acc + Number(tx.amount || 0), 0);

  const maxSlots = dailyConfig?.max_slots ?? 75;
  const slotsBooked = dailyConfig?.slots_booked ?? 0;
  const availableSlots = Math.max(0, maxSlots - slotsBooked);

  return {
    balance: Number(profile?.balance || 0),
    fullName: profile?.full_name || '',
    email: profile?.email || '',
    activeSlotsCount: activeSlots.length,
    completedSlotsCount: completedSlots.length,
    totalSlotsCount: slots.length,
    totalInvested,
    totalEarned,
    todayEarned,
    availableSlots,
    slotsBooked,
    maxSlots,
    slots,
    transactions: txs,
  };
}

// =====================
// ADMIN FUNCTIONS
// =====================

export async function getAdminTransactions() {
  const { data, error } = await supabase
    .from('transactions')
    .select('*, users(full_name, email)')
    .order('created_at', { ascending: false })
    .limit(100);

  return { data: data || [], error };
}

export async function getAdminAllSlots() {
  const { data, error } = await supabase
    .from('slot_bookings')
    .select('*, users(full_name, email)')
    .order('created_at', { ascending: false })
    .limit(100);

  return { data: data || [], error };
}

export async function approveDeposit(txId: string) {
  const { data, error } = await supabase.rpc('admin_approve_deposit', {
    p_tx_id: txId,
  });
  return { data, error };
}

export async function rejectDeposit(txId: string) {
  const { data, error } = await supabase
    .from('transactions')
    .update({ status: 'rejected', updated_at: new Date().toISOString() })
    .eq('id', txId)
    .eq('status', 'pending');
  return { data, error };
}

export async function approveWithdrawal(txId: string) {
  const { data, error } = await supabase
    .from('transactions')
    .update({ status: 'approved', updated_at: new Date().toISOString() })
    .eq('id', txId)
    .eq('status', 'pending');
  return { data, error };
}

export async function rejectWithdrawal(txId: string) {
  const { data, error } = await supabase.rpc('admin_reject_withdrawal', {
    p_tx_id: txId,
  });
  return { data, error };
}

export async function triggerDailyRoiDistribution() {
  const { data, error } = await supabase.rpc('distribute_daily_roi');
  return { data, error };
}
