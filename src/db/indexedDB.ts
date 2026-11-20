import { Transaction, StreakDay, AppSettings, Goal, MonthlyBudget, Wallet } from '../types';

const DB_NAME = 'neobrutalist_finance_db';
const DB_VERSION = 4;

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  dailyReminderTime: '20:00',
  freezeCount: 1,
  notificationsEnabled: true,
  categories: {
    income: ['Gaji', 'Sampingan', 'Investasi', 'Hadiah', 'Lainnya'],
    expense: ['Makan', 'Transport', 'Belanja', 'Hiburan', 'Tagihan', 'Kesehatan', 'Pendidikan', 'Lainnya'],
    saving: ['Dana Darurat', 'Investasi', 'Tabungan', 'Liburan', 'Lainnya']
  }
};

export function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Error opening IndexedDB');
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = request.result;

      // Create transactions store
      if (!db.objectStoreNames.contains('transactions')) {
        db.createObjectStore('transactions', { keyPath: 'id', autoIncrement: true });
      }

      // Create streaks store
      if (!db.objectStoreNames.contains('streaks')) {
        db.createObjectStore('streaks', { keyPath: 'date' });
      }

      // Create settings store
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings');
      }

      // Create goals store
      if (!db.objectStoreNames.contains('goals')) {
        db.createObjectStore('goals', { keyPath: 'id' });
      }

      // Create budgets store
      if (!db.objectStoreNames.contains('budgets')) {
        db.createObjectStore('budgets', { keyPath: 'id' });
      }
      
      // Create wallets store
      if (!db.objectStoreNames.contains('wallets')) {
        db.createObjectStore('wallets', { keyPath: 'id' });
      }
    };
  });
}

export async function addTransaction(transaction: Transaction): Promise<number> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('transactions', 'readwrite');
    const store = tx.objectStore('transactions');
    const request = store.add(transaction);

    request.onsuccess = () => {
      resolve(request.result as number);
    };

    request.onerror = () => reject(request.error);
  });
}

export async function getTransactions(): Promise<Transaction[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('transactions', 'readonly');
    const store = tx.objectStore('transactions');
    const request = store.getAll();

    request.onsuccess = () => {
      // Sort newest first
      const results = request.result as Transaction[];
      results.sort((a, b) => b.createdAt - a.createdAt);
      resolve(results);
    };

    request.onerror = () => reject(request.error);
  });
}

export async function deleteTransaction(id: number): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('transactions', 'readwrite');
    const store = tx.objectStore('transactions');
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function updateTransaction(transaction: Transaction): Promise<void> {
  if (transaction.id === undefined) return;
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('transactions', 'readwrite');
    const store = tx.objectStore('transactions');
    const request = store.put(transaction);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Streaks operations
export async function getStreaks(): Promise<StreakDay[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('streaks', 'readonly');
    const store = tx.objectStore('streaks');
    const request = store.getAll();

    request.onsuccess = () => {
      const results = request.result as StreakDay[];
      results.sort((a, b) => a.date.localeCompare(b.date));
      resolve(results);
    };

    request.onerror = () => reject(request.error);
  });
}

export async function saveStreakDay(streakDay: StreakDay): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('streaks', 'readwrite');
    const store = tx.objectStore('streaks');
    const request = store.put(streakDay);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Settings operations
export async function getSettings(): Promise<AppSettings> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readonly');
    const store = tx.objectStore('settings');
    const request = store.get('app_settings');

    request.onsuccess = () => {
      if (request.result) {
        resolve(request.result as AppSettings);
      } else {
        // Init with default
        saveSettings(DEFAULT_SETTINGS).then(() => resolve(DEFAULT_SETTINGS));
      }
    };

    request.onerror = () => reject(request.error);
  });
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readwrite');
    const store = tx.objectStore('settings');
    const request = store.put(settings, 'app_settings');

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Goals operations
export async function getGoals(): Promise<Goal[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('goals', 'readonly');
    const store = tx.objectStore('goals');
    const request = store.getAll();

    request.onsuccess = () => {
      const results = request.result as Goal[];
      results.sort((a, b) => b.createdAt - a.createdAt);
      resolve(results);
    };

    request.onerror = () => reject(request.error);
  });
}

export async function saveGoal(goal: Goal): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('goals', 'readwrite');
    const store = tx.objectStore('goals');
    const request = store.put(goal);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteGoal(id: string): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('goals', 'readwrite');
    const store = tx.objectStore('goals');
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getBudgets(): Promise<MonthlyBudget[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('budgets', 'readonly');
    const store = tx.objectStore('budgets');
    const request = store.getAll();

    request.onsuccess = () => {
      const results = request.result as MonthlyBudget[];
      results.sort((a, b) => b.createdAt - a.createdAt);
      resolve(results);
    };

    request.onerror = () => reject(request.error);
  });
}

export async function saveBudget(budget: MonthlyBudget): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('budgets', 'readwrite');
    const store = tx.objectStore('budgets');
    const request = store.put(budget);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteBudget(id: string): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('budgets', 'readwrite');
    const store = tx.objectStore('budgets');
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Wallets operations
export async function getWallets(): Promise<Wallet[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('wallets', 'readonly');
    const store = tx.objectStore('wallets');
    const request = store.getAll();

    request.onsuccess = () => {
      const results = request.result as Wallet[];
      results.sort((a, b) => a.createdAt - b.createdAt);
      resolve(results);
    };

    request.onerror = () => reject(request.error);
  });
}

export async function saveWallet(wallet: Wallet): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('wallets', 'readwrite');
    const store = tx.objectStore('wallets');
    const request = store.put(wallet);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteWallet(id: string): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('wallets', 'readwrite');
    const store = tx.objectStore('wallets');
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Reset data
export async function resetAllData(): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['transactions', 'streaks', 'settings', 'goals', 'budgets', 'wallets'], 'readwrite');
    tx.objectStore('transactions').clear();
    tx.objectStore('streaks').clear();
    tx.objectStore('settings').clear();
    tx.objectStore('goals').clear();
    if (db.objectStoreNames.contains('budgets')) {
      tx.objectStore('budgets').clear();
    }
    if (db.objectStoreNames.contains('wallets')) {
      tx.objectStore('wallets').clear();
    }

    tx.oncomplete = () => {
      // Re-save defaults
      saveSettings(DEFAULT_SETTINGS).then(() => resolve());
    };

    tx.onerror = () => reject(tx.error);
  });
}

