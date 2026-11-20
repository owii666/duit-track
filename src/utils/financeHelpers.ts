import { Transaction, Wallet } from '../types';

/**
 * Returns Rupiah formatted currency.
 */
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

/**
 * Safely parses a YYYY-MM-DD date string into a local Date object
 * to avoid timezone offset shifts.
 */
export function parseLocalDate(dateStr: string): Date {
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // 0-indexed
    const day = parseInt(parts[2], 10);
    return new Date(year, month, day);
  }
  return new Date(dateStr);
}

/**
 * Returns today's date formatted as a local YYYY-MM-DD string.
 */
export function getTodayLocalDateStr(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats a Date object as a local YYYY-MM-DD string.
 */
export function formatLocalDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Summarizes income, expense, and savings for the current month.
 */
export function getMonthlySummary(transactions: Transaction[], year?: number, month?: number) {
  const now = new Date();
  const currentYear = year !== undefined ? year : now.getFullYear();
  const currentMonth = month !== undefined ? month : now.getMonth(); // 0-indexed

  let income = 0;
  let expense = 0;
  let saving = 0;

  transactions.forEach(t => {
    const tDate = parseLocalDate(t.date);
    if (tDate.getFullYear() === currentYear && tDate.getMonth() === currentMonth) {
      if (t.type === 'income') income += t.amount;
      else if (t.type === 'expense') expense += t.amount;
      else if (t.type === 'saving') saving += t.amount;
    }
  });

  const balance = income - expense - saving;

  return { income, expense, saving, balance };
}

/**
 * Calculates current overall balance.
 */
export function calculateOverallBalance(transactions: Transaction[], wallets: Wallet[] = []): number {
  const initialWalletsSum = wallets.reduce((sum, w) => sum + (w.initialBalance || 0), 0);
  return initialWalletsSum + transactions.reduce((sum, t) => {
    if (t.type === 'income') return sum + t.amount;
    if (t.type === 'expense') return sum - t.amount;
    if (t.type === 'saving') return sum - t.amount; // savings is money put aside, so it reduces spendable balance
    return sum;
  }, 0);
}

/**
 * Predicts the "Tanggal Bokek" (when balance hits 0).
 * Based on the last 30 days of expense average.
 */
export function predictBrokeDate(transactions: Transaction[], currentBalance: number): {
  dateStr: string;
  daysRemaining: number;
  status: 'safe' | 'warning' | 'danger';
  averageExpense: number;
} {
  const expenses = transactions.filter(t => t.type === 'expense');
  if (expenses.length === 0 || currentBalance <= 0) {
    return {
      dateStr: 'Belum ada pengeluaran',
      daysRemaining: Infinity,
      status: 'safe',
      averageExpense: 0
    };
  }

  // Get total expense in last 30 days
  const now = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(now.getDate() - 30);

  const recentExpenses = expenses.filter(e => {
    const d = parseLocalDate(e.date);
    return d >= thirtyDaysAgo && d <= now;
  });

  const totalRecent = recentExpenses.reduce((sum, e) => sum + e.amount, 0);
  
  // Calculate unique active days in recent expenses
  const uniqueDays = new Set(recentExpenses.map(e => e.date)).size;
  const daysDivider = Math.max(uniqueDays, 1);
  const averageDailyExpense = totalRecent / 30; // average per day over 30 days span

  if (averageDailyExpense <= 0) {
    return {
      dateStr: 'Aman Sentosa',
      daysRemaining: Infinity,
      status: 'safe',
      averageExpense: 0
    };
  }

  const daysRemaining = Math.floor(currentBalance / averageDailyExpense);

  if (daysRemaining > 90) {
    return {
      dateStr: 'Aman Sentosa (>3 bulan)',
      daysRemaining,
      status: 'safe',
      averageExpense: averageDailyExpense
    };
  }

  const brokeDate = new Date();
  brokeDate.setDate(now.getDate() + daysRemaining);

  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
  const dateStr = brokeDate.toLocaleDateString('id-ID', options);

  let status: 'safe' | 'warning' | 'danger' = 'safe';
  if (daysRemaining < 7) {
    status = 'danger';
  } else if (daysRemaining < 21) {
    status = 'warning';
  }

  return {
    dateStr,
    daysRemaining,
    status,
    averageExpense: averageDailyExpense
  };
}

/**
 * Returns 35 days (5 weeks x 7 days) of heatmap contribution data.
 * Ending today.
 */
export interface HeatmapCell {
  date: string;
  count: number;
  amount: number;
  dayOfWeek: number;
  intensity: 0 | 1 | 2 | 3 | 4;
}

export function getHeatmapData(transactions: Transaction[]): HeatmapCell[] {
  const getLocalDateString = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const today = new Date();
  const cells: HeatmapCell[] = [];

  // Compile transactions count and amount per date
  const txMap = new Map<string, { count: number; amount: number }>();
  transactions.forEach(t => {
    const current = txMap.get(t.date) || { count: 0, amount: 0 };
    txMap.set(t.date, {
      count: current.count + 1,
      amount: current.amount + (t.type === 'expense' ? t.amount : 0)
    });
  });

  // Generate 35 days ago to today
  // Let's align so that the grid shows 5 columns of 7 rows (or 7 columns of 5 rows)
  // Let's make it 35 days (5 columns of 7 days, Monday to Sunday)
  // To keep it clean, let's just generate the last 35 days chronologically
  for (let i = 34; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = getLocalDateString(d);
    const dayOfWeek = d.getDay(); // 0 (Sun) - 6 (Sat)
    
    const txInfo = txMap.get(dateStr) || { count: 0, amount: 0 };
    
    // Determine intensity
    let intensity: 0 | 1 | 2 | 3 | 4 = 0;
    if (txInfo.count > 0) {
      if (txInfo.count === 1) intensity = 1;
      else if (txInfo.count === 2) intensity = 2;
      else if (txInfo.count <= 4) intensity = 3;
      else intensity = 4;
    }

    cells.push({
      date: dateStr,
      count: txInfo.count,
      amount: txInfo.amount,
      dayOfWeek,
      intensity
    });
  }

  return cells;
}

/**
 * Calculates current balance for each wallet
 */
export function calculateWalletBalances(wallets: Wallet[], transactions: Transaction[]): Record<string, number> {
  const balances: Record<string, number> = {};
  
  // Set initial balances
  wallets.forEach(w => {
    balances[w.id] = w.initialBalance || 0;
  });

  // Apply transactions
  transactions.forEach(t => {
    if (t.type === 'income' && t.walletId) {
      balances[t.walletId] = (balances[t.walletId] || 0) + t.amount;
    } else if (t.type === 'expense' && t.walletId) {
      balances[t.walletId] = (balances[t.walletId] || 0) - t.amount;
    } else if (t.type === 'saving' && t.walletId) {
      balances[t.walletId] = (balances[t.walletId] || 0) - t.amount;
    } else if (t.type === 'transfer') {
      if (t.walletId) {
        balances[t.walletId] = (balances[t.walletId] || 0) - t.amount;
      }
      if (t.toWalletId) {
        balances[t.toWalletId] = (balances[t.toWalletId] || 0) + t.amount;
      }
    }
  });

  return balances;
}
