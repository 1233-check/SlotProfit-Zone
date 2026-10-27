-- ==============================================================================
-- SLOTPROFIT ZONE - Complete Supabase Database Schema
-- 5% Daily ROI | 75 Slots/Day | $20/Slot | 2x Payout Cap ($40 max)
-- ==============================================================================

-- 1. Create Public Users Table (mirrors auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  balance NUMERIC(14, 2) DEFAULT 0.00 NOT NULL CHECK (balance >= 0),
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Transactions Table
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'roi_distribution', 'slot_purchase')),
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  tx_hash TEXT,
  destination_address TEXT,
  status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. Slot Bookings Table
CREATE TABLE IF NOT EXISTS public.slot_bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC(14, 2) DEFAULT 20.00 NOT NULL,
  daily_roi_rate NUMERIC(6, 4) DEFAULT 0.05 NOT NULL, -- 5% daily = $1.00/day
  total_earned NUMERIC(14, 2) DEFAULT 0.00 NOT NULL,
  max_payout NUMERIC(14, 2) DEFAULT 40.00 NOT NULL,   -- 2x cap = $40.00
  status TEXT DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'completed')),
  last_roi_distributed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 4. Daily Slots Configuration (75 slots per day limit)
CREATE TABLE IF NOT EXISTS public.daily_slots_config (
  booking_date DATE PRIMARY KEY DEFAULT CURRENT_DATE,
  slots_booked INT DEFAULT 0 NOT NULL,
  max_slots INT DEFAULT 75 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slot_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_slots_config ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies
-- Users table: users can read their own profile, anyone authenticated can read
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
CREATE POLICY "Users can read own profile" ON public.users FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
CREATE POLICY "Users can insert own profile" ON public.users FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (true);

-- Transactions table
DROP POLICY IF EXISTS "Transactions are viewable by everyone" ON public.transactions;
CREATE POLICY "Transactions are viewable by everyone" ON public.transactions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert transactions" ON public.transactions;
CREATE POLICY "Authenticated users can insert transactions" ON public.transactions FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow updating transactions" ON public.transactions;
CREATE POLICY "Allow updating transactions" ON public.transactions FOR UPDATE USING (true);

-- Slot bookings table
DROP POLICY IF EXISTS "Slots are viewable by everyone" ON public.slot_bookings;
CREATE POLICY "Slots are viewable by everyone" ON public.slot_bookings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert slot bookings" ON public.slot_bookings;
CREATE POLICY "Allow insert slot bookings" ON public.slot_bookings FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update slot bookings" ON public.slot_bookings;
CREATE POLICY "Allow update slot bookings" ON public.slot_bookings FOR UPDATE USING (true);

-- Daily slots config
DROP POLICY IF EXISTS "Daily slots config viewable by everyone" ON public.daily_slots_config;
CREATE POLICY "Daily slots config viewable by everyone" ON public.daily_slots_config FOR SELECT USING (true);

DROP POLICY IF EXISTS "Daily slots config editable by anyone" ON public.daily_slots_config;
CREATE POLICY "Daily slots config editable by anyone" ON public.daily_slots_config FOR ALL USING (true);

-- 7. Trigger on auth.users -> public.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, balance)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    0.00
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      full_name = COALESCE(EXCLUDED.full_name, public.users.full_name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 8. RPC: process_slot_booking (Atomic purchase with 75 daily slots constraint)
CREATE OR REPLACE FUNCTION public.process_slot_booking(
  p_user_id UUID,
  p_quantity INT
)
RETURNS JSON AS $$
DECLARE
  v_user_balance NUMERIC;
  v_cost_per_slot NUMERIC := 20.00;
  v_total_cost NUMERIC;
  v_today DATE := CURRENT_DATE;
  v_booked INT;
  v_max INT;
  v_i INT;
BEGIN
  IF p_quantity <= 0 THEN
    RETURN json_build_object('success', false, 'message', 'Quantity must be at least 1 slot');
  END IF;

  v_total_cost := p_quantity * v_cost_per_slot;

  -- Lock and check user balance
  SELECT balance INTO v_user_balance FROM public.users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'User account not found');
  END IF;

  IF v_user_balance < v_total_cost THEN
    RETURN json_build_object('success', false, 'message', 'Insufficient balance. Need $' || v_total_cost || ' USDT');
  END IF;

  -- Lock daily config row
  SELECT slots_booked, max_slots INTO v_booked, v_max
  FROM public.daily_slots_config
  WHERE booking_date = v_today
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.daily_slots_config (booking_date, slots_booked, max_slots)
    VALUES (v_today, 0, 75)
    RETURNING slots_booked, max_slots INTO v_booked, v_max;
  END IF;

  IF (v_booked + p_quantity) > v_max THEN
    RETURN json_build_object('success', false, 'message', 'Daily slot limit reached! Only ' || (v_max - v_booked) || ' slots available today.');
  END IF;

  -- Deduct user balance
  UPDATE public.users
  SET balance = balance - v_total_cost
  WHERE id = p_user_id;

  -- Increment booked slots
  UPDATE public.daily_slots_config
  SET slots_booked = slots_booked + p_quantity
  WHERE booking_date = v_today;

  -- Insert slot records (each $20, 5% daily ROI, $40 max payout)
  FOR v_i IN 1..p_quantity LOOP
    INSERT INTO public.slot_bookings (user_id, amount, daily_roi_rate, total_earned, max_payout, status)
    VALUES (p_user_id, 20.00, 0.05, 0.00, 40.00, 'active');
  END LOOP;

  -- Record slot purchase transaction
  INSERT INTO public.transactions (user_id, type, amount, status)
  VALUES (p_user_id, 'slot_purchase', v_total_cost, 'approved');

  RETURN json_build_object(
    'success', true,
    'message', 'Successfully activated ' || p_quantity || ' slot(s)!',
    'slots_bought', p_quantity,
    'total_cost', v_total_cost
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. RPC: request_withdrawal (Atomic withdrawal check & lock)
CREATE OR REPLACE FUNCTION public.request_withdrawal(
  p_user_id UUID,
  p_destination TEXT,
  p_amount NUMERIC
)
RETURNS JSON AS $$
DECLARE
  v_user_balance NUMERIC;
BEGIN
  IF p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'message', 'Amount must be greater than 0');
  END IF;

  IF p_destination IS NULL OR length(trim(p_destination)) < 10 THEN
    RETURN json_build_object('success', false, 'message', 'Invalid destination wallet address');
  END IF;

  -- Lock user balance
  SELECT balance INTO v_user_balance FROM public.users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'User account not found');
  END IF;

  IF v_user_balance < p_amount THEN
    RETURN json_build_object('success', false, 'message', 'Insufficient balance');
  END IF;

  -- Deduct immediately upon request
  UPDATE public.users
  SET balance = balance - p_amount
  WHERE id = p_user_id;

  -- Insert pending withdrawal
  INSERT INTO public.transactions (user_id, type, amount, destination_address, status)
  VALUES (p_user_id, 'withdrawal', p_amount, trim(p_destination), 'pending');

  RETURN json_build_object(
    'success', true,
    'message', 'Withdrawal request submitted for $' || p_amount || ' USDT'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. RPC: admin_approve_deposit
CREATE OR REPLACE FUNCTION public.admin_approve_deposit(
  p_tx_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_tx RECORD;
BEGIN
  SELECT * INTO v_tx FROM public.transactions WHERE id = p_tx_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Transaction not found');
  END IF;

  IF v_tx.status != 'pending' THEN
    RETURN json_build_object('success', false, 'message', 'Transaction is not pending');
  END IF;

  IF v_tx.type != 'deposit' THEN
    RETURN json_build_object('success', false, 'message', 'Transaction is not a deposit');
  END IF;

  -- Approve transaction
  UPDATE public.transactions
  SET status = 'approved', updated_at = NOW()
  WHERE id = p_tx_id;

  -- Add funds to user's balance
  UPDATE public.users
  SET balance = balance + v_tx.amount
  WHERE id = v_tx.user_id;

  RETURN json_build_object('success', true, 'message', 'Deposit of $' || v_tx.amount || ' approved!');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. RPC: admin_reject_withdrawal (Refunds balance back to user)
CREATE OR REPLACE FUNCTION public.admin_reject_withdrawal(
  p_tx_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_tx RECORD;
BEGIN
  SELECT * INTO v_tx FROM public.transactions WHERE id = p_tx_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Transaction not found');
  END IF;

  IF v_tx.status != 'pending' THEN
    RETURN json_build_object('success', false, 'message', 'Transaction is not pending');
  END IF;

  IF v_tx.type != 'withdrawal' THEN
    RETURN json_build_object('success', false, 'message', 'Transaction is not a withdrawal');
  END IF;

  -- Reject transaction
  UPDATE public.transactions
  SET status = 'rejected', updated_at = NOW()
  WHERE id = p_tx_id;

  -- Refund funds back to user
  UPDATE public.users
  SET balance = balance + v_tx.amount
  WHERE id = v_tx.user_id;

  RETURN json_build_object('success', true, 'message', 'Withdrawal rejected and $' || v_tx.amount || ' refunded to user');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. RPC: distribute_daily_roi (Distribute 5% to each active slot up to 2x cap)
CREATE OR REPLACE FUNCTION public.distribute_daily_roi()
RETURNS JSON AS $$
DECLARE
  v_slot RECORD;
  v_daily_payout NUMERIC;
  v_actual_payout NUMERIC;
  v_total_distributed NUMERIC := 0.00;
  v_processed_count INT := 0;
  v_new_total NUMERIC;
  v_new_status TEXT;
BEGIN
  FOR v_slot IN
    SELECT * FROM public.slot_bookings
    WHERE status = 'active'
    FOR UPDATE
  LOOP
    -- 5% of $20 = $1.00 daily
    v_daily_payout := ROUND(v_slot.amount * v_slot.daily_roi_rate, 2);

    -- Check 2x cap ($40.00 max)
    IF (v_slot.total_earned + v_daily_payout) >= v_slot.max_payout THEN
      v_actual_payout := v_slot.max_payout - v_slot.total_earned;
      v_new_total := v_slot.max_payout;
      v_new_status := 'completed';
    ELSE
      v_actual_payout := v_daily_payout;
      v_new_total := v_slot.total_earned + v_daily_payout;
      v_new_status := 'active';
    END IF;

    IF v_actual_payout > 0 THEN
      -- Update slot
      UPDATE public.slot_bookings
      SET total_earned = v_new_total,
          status = v_new_status,
          last_roi_distributed_at = NOW()
      WHERE id = v_slot.id;

      -- Credit user balance
      UPDATE public.users
      SET balance = balance + v_actual_payout
      WHERE id = v_slot.user_id;

      -- Create transaction entry for user history
      INSERT INTO public.transactions (user_id, type, amount, status)
      VALUES (v_slot.user_id, 'roi_distribution', v_actual_payout, 'approved');

      v_total_distributed := v_total_distributed + v_actual_payout;
      v_processed_count := v_processed_count + 1;
    END IF;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'slots_processed', v_processed_count,
    'total_distributed', v_total_distributed
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
