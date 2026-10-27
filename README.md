# SlotProfit Zone ⚡

A simple, transparent, and high-performance 5% Daily ROI platform built with Next.js 16, Supabase, and Tailwind CSS. Featuring a refined matte dark design.

## Features

- **5% Daily ROI**: Fixed $20.00 USDT per slot = $1.00 daily earnings per slot.
- **75 Slots Daily Limit**: Strictly 75 global slots minted every 24 hours to ensure platform sustainability.
- **200% Payout Cap**: Each slot halts automatically once it delivers $40.00 (2x return).
- **All-in-One Dashboard**: Everything (balance, slot booking, USDT deposits, withdrawals, slot progress tracking, and transaction history) operates seamlessly under a single page.
- **BEP-20 USDT Deposits & Withdrawals**: Direct transaction hash verification for fast deposits and admin payouts.
- **Dedicated Admin Control Panel**: `/admin` (passcode protected) with one-click 5% daily ROI distribution, deposit approval/rejection, and withdrawal dispatch.
- **Refined Matte Palette**: Deep charcoal (`#0d0d14`), muted teal (`#16213e`), soft slate (`#1a1a2e`), and warm sand (`#c4b69c`) accents.

## Database Setup

1. Open your Supabase Dashboard (`https://supabase.com/dashboard/project/eryfyevfmfnsmdounlrb/sql/new`).
2. Run the SQL script from `supabase_schema.sql`.
3. That's it! Tables, constraints, RLS policies, and atomic transaction RPC functions are fully set up.

## Local Development

```bash
npm install
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000).

## Admin Portal

Visit `/admin` (Default passcode: `admin123`).
