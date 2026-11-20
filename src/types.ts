export interface TransactionComment {
  id: string;
  user: string;
  text: string;
  createdAt: number;
}

export interface Transaction {
  id?: number;
  type: 'income' | 'expense' | 'saving' | 'transfer';
  amount: number;
  category: string;
  note: string;
  date: string; // YYYY-MM-DD
  createdAt: number; // timestamp
  photo?: string; // base64 string
  likes?: number;
  likedByCurrentUser?: boolean;
  comments?: TransactionComment[];
  walletId?: string;
  toWalletId?: string;
}

export interface Wallet {
  id: string;
  name: string;
  initialBalance: number;
  createdAt: number;
}

export interface StreakDay {
  date: string; // YYYY-MM-DD
  hasActivity: boolean;
  streakCount: number;
}

export interface GoalLog {
  id: string;
  type: 'add' | 'subtract';
  amount: number;
  date: string;
  note: string;
}

export interface Goal {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  photo?: string; // base64 string
  logs: GoalLog[];
  createdAt: number;
}

export interface AppSettings {
  theme: 'light';
  dailyReminderTime: string;
  freezeCount: number;
  notificationsEnabled: boolean;
  categories: {
    income: string[];
    expense: string[];
    saving: string[];
  };
  userPhoto?: string; // base64 string
}
export interface MonthlyBudget {
  id: string;
  category: string;
  targetAmount: number; // Nominal budget limit (Rp)
  month?: number; // 0-11 (optional: specific month, if undefined applies to all months)
  year?: number;  // YYYY (optional: specific year, if undefined applies to all years)
  createdAt: number;
}
