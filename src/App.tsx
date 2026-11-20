import React, { useState, useEffect } from 'react';
import { Transaction, StreakDay, AppSettings, Goal } from './types';
import { 
  getTransactions, 
  getStreaks, 
  getSettings, 
  addTransaction, 
  deleteTransaction, 
  saveSettings, 
  saveStreakDay, 
  resetAllData,
  getGoals,
  DEFAULT_SETTINGS 
} from './db/indexedDB';
import { processStreaks } from './utils/streakLogic';
import { getTodayLocalDateStr } from './utils/financeHelpers';
import Dashboard from './components/Dashboard';
import TransactionModal from './components/TransactionModal';
import History from './components/History';
import Statistics from './components/Statistics';
import Profile from './components/Profile';
import Goals from './components/Goals';
import { Home, History as HistoryIcon, BarChart2, User, Plus, Sparkles, Flame, Target } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'goals' | 'history' | 'stats' | 'profile'>('home');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [streakDays, setStreakDays] = useState<StreakDay[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Onboarding component state
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [onboardingName, setOnboardingName] = useState('');
  const [onboardingGoal, setOnboardingGoal] = useState('menabung');

  // Modal control
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addModalType, setAddModalType] = useState<'income' | 'expense' | 'saving' | 'transfer'>('expense');

  // Interactive Floating Action Button state
  const [isFabCollapsed, setIsFabCollapsed] = useState(false);
  const [lastActivityTime, setLastActivityTime] = useState(Date.now());

  // Delete Confirmation Modal state
  const [txToDelete, setTxToDelete] = useState<number | null>(null);

  // PWA Install Prompt state
  const [installPromptEvent, setInstallPromptEvent] = useState<any>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPromptEvent(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Standalone Android App Detection and Automated Reminder Alarm checking
  useEffect(() => {
    // 1. Detect Standalone (Android home screen / Installed PWA)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
    
    const requestAndSetupWelcomeNotification = async () => {
      if (!('Notification' in window)) return;

      // Automatically ask permission for installed app users or active users
      if (Notification.permission === 'default' && (isStandalone || localStorage.getItem('finance_onboarding_completed') === 'true')) {
        try {
          const permission = await Notification.requestPermission();
          if (permission === 'granted') {
            // Send instant neat welcome greeting to verify notifications work perfectly
            triggerLocalReminder(
              '📲 Daptrack Aktif di HP-mu!',
              'Daptrack siap mengirimkan pengingat harian otomatis agar kamu makin disiplin mengelola uang harian!'
            );
          }
        } catch (err) {
          console.error('Failed to request notification permission:', err);
        }
      } else if (Notification.permission === 'granted' && isStandalone) {
        // Standalone user entered the app - send a subtle welcoming trigger if not sent today
        const todayDateStr = getTodayLocalDateStr();
        const lastWelcomeDate = localStorage.getItem('finance_last_welcome_date');
        if (lastWelcomeDate !== todayDateStr) {
          localStorage.setItem('finance_last_welcome_date', todayDateStr);
          triggerLocalReminder(
            '🔥 Selamat Datang Kembali di Daptrack!',
            'Mari catat keuangan harianmu hari ini untuk menjaga rekor streak-mu tetap berkobar!'
          );
        }
      }
    };

    requestAndSetupWelcomeNotification();

    // 2. High performance clock checks to alarm user at their selected time
    const alarmCheckTimer = setInterval(async () => {
      // Re-fetch current database settings
      const dbSettings = await getSettings();
      if (!dbSettings || !dbSettings.notificationsEnabled || Notification.permission !== 'granted') return;

      const now = new Date();
      const currentHour = String(now.getHours()).padStart(2, '0');
      const currentMin = String(now.getMinutes()).padStart(2, '0');
      const currentTimeStr = `${currentHour}:${currentMin}`;

      if (currentTimeStr === dbSettings.dailyReminderTime) {
        const todayStr = getTodayLocalDateStr();
        const lastReminderDay = localStorage.getItem('finance_last_reminder_day');

        if (lastReminderDay !== todayStr) {
          localStorage.setItem('finance_last_reminder_day', todayStr);
          triggerLocalReminder(
            '🔔 Waktunya Catat Keuangan!',
            'Yuk luangkan waktu 1 menit untuk mencatat transaksi harianmu sekarang. Pertahankan rekor streak-mu! 🚀'
          );
        }
      }
    }, 15000); // Check every 15 seconds for ultra-precise alarm activation

    return () => clearInterval(alarmCheckTimer);
  }, []);

  const triggerLocalReminder = async (title: string, body: string) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        if (registration && registration.showNotification) {
          registration.showNotification(title, {
            body,
            icon: '/assets/logo.png',
            badge: '/assets/logo.png',
            vibrate: [200, 100, 200],
            tag: 'daptrack-reminder-alarm',
            renotify: true,
            data: { url: '/' }
          } as any);
          return;
        }
      }
      // Standard browser notification fallback
      new Notification(title, { body, icon: '/assets/logo.png' });
    } catch (err) {
      console.error('Service Worker notification failed, falling back:', err);
      try {
        new Notification(title, { body, icon: '/assets/logo.png' });
      } catch (e) {
        console.error('Standard browser notification failed:', e);
      }
    }
  };

  // Streak derived state
  const [streakInfo, setStreakInfo] = useState<{
    currentStreak: number;
    weeklyProgress: boolean[];
    freezeCount: number;
    streakTriggeredMilestone: boolean;
    milestoneTier: string;
  }>({
    currentStreak: 0,
    weeklyProgress: [false, false, false, false, false, false, false],
    freezeCount: 1,
    streakTriggeredMilestone: false,
    milestoneTier: 'Pemula'
  });

  // Check onboarding on mount
  useEffect(() => {
    const isCompleted = localStorage.getItem('finance_onboarding_completed') === 'true';
    if (!isCompleted) {
      setShowOnboarding(true);
    }
    loadDatabaseValues();
  }, []);

  // Monitor FAB inactivity
  useEffect(() => {
    // Setup interval to check elapsed time since last action/interaction
    const checkTimer = setInterval(() => {
      const elapsed = Date.now() - lastActivityTime;
      if (elapsed >= 10000 && !isFabCollapsed) {
        setIsFabCollapsed(true);
      }
    }, 1000);

    return () => clearInterval(checkTimer);
  }, [lastActivityTime, isFabCollapsed]);

  const loadDatabaseValues = async () => {
    try {
      const dbSettings = await getSettings();
      // Enforce theme to be strictly 'light' as requested
      const enforcedSettings: AppSettings = { ...dbSettings, theme: 'light' };
      setSettings(enforcedSettings);
      document.documentElement.removeAttribute('data-theme');

      const dbTx = await getTransactions();
      setTransactions(dbTx);

      const dbStreaks = await getStreaks();
      setStreakDays(dbStreaks);

      const dbGoals = await getGoals();
      setGoals(dbGoals);

      // Process and sync daily streaks
      const info = processStreaks(
        dbTx,
        dbStreaks,
        enforcedSettings,
        async (sd) => { await saveStreakDay(sd); },
        async (s) => { await saveSettings(s); }
      );
      setStreakInfo(info);

    } catch (err) {
      console.error('Error loading local IndexedDB files: ', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Complete onboarding
  const handleCompleteOnboarding = () => {
    if (!onboardingName.trim()) return;
    localStorage.setItem('finance_user_name', onboardingName.trim());
    localStorage.setItem('finance_user_purpose', onboardingGoal);
    localStorage.setItem('finance_onboarding_completed', 'true');
    setShowOnboarding(false);
    
    // Dispatch events to sync headers immediately
    window.dispatchEvent(new Event('user_name_updated'));
    loadDatabaseValues();
  };

  // Save new transaction
  const handleSaveTransaction = async (tx: Transaction) => {
    try {
      await addTransaction(tx);
      setIsAddModalOpen(false);
      
      // Reload everything to sync streak status & predictions
      await loadDatabaseValues();

    } catch (err) {
      console.error('Failed to save transaction: ', err);
    }
  };

  // Delete transaction
  const handleDeleteTransaction = (id: number) => {
    setTxToDelete(id);
  };

  // Settings sync
  const handleUpdateSettings = async (updatedSettings: AppSettings) => {
    try {
      const enforced: AppSettings = { ...updatedSettings, theme: 'light' };
      setSettings(enforced);
      await saveSettings(enforced);
      document.documentElement.removeAttribute('data-theme');
    } catch (err) {
      console.error('Failed to save settings: ', err);
    }
  };

  // Clear everything (Factory Reset)
  const handleResetAllData = async () => {
    await resetAllData();
    localStorage.removeItem('finance_onboarding_completed');
    localStorage.removeItem('finance_user_name');
    localStorage.removeItem('finance_user_purpose');
    localStorage.removeItem('finance_profile_photo');
    setActiveTab('home');
    setOnboardingName('');
    setOnboardingStep(1);
    setShowOnboarding(true);
    await loadDatabaseValues();
  };

  // Trigger add sheet helper from dashboard
  const handleOpenAddModal = (type: 'income' | 'expense' | 'saving' | 'transfer') => {
    setAddModalType(type);
    setIsAddModalOpen(true);
    // Reset FAB slide state
    setLastActivityTime(Date.now());
    setIsFabCollapsed(false);
  };

  const handleFabClick = () => {
    if (isFabCollapsed) {
      // If partially hidden, clicking it slides it back fully
      setIsFabCollapsed(false);
      setLastActivityTime(Date.now());
    } else {
      // If fully visible, clicking it launches the modal
      setAddModalType('expense');
      setIsAddModalOpen(true);
      setLastActivityTime(Date.now());
    }
  };

  // Render onboarding screen
  if (showOnboarding) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] text-neutral-900 flex items-center justify-center p-4 font-sans select-none">
        <div className="w-full max-w-sm bg-white border-3 border-neutral-900 rounded-2xl p-6 neo-shadow-lg space-y-6 relative overflow-hidden">
          {/* Accent decoration */}
          <div className="absolute top-0 right-0 w-24 h-24 bg-[var(--color-accent)] opacity-15 rounded-bl-full pointer-events-none" />

          {/* Onboarding Step 1: Welcome */}
          {onboardingStep === 1 && (
            <div className="space-y-6 animate-fade-in text-center py-4">
              <div className="inline-flex p-3 bg-amber-50 border-2 border-neutral-900 rounded-full">
                <Sparkles size={36} className="text-amber-500 animate-pulse" />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-black tracking-tight leading-tight">Disiplin Keuangan Jadi Seru!</h1>
                <p className="text-xs text-neutral-500 font-bold leading-relaxed px-2">
                  Kelola pengeluaran, pantau streak harian ala Duolingo, dan capai target impian tabunganmu lewat feed interaktif!
                </p>
              </div>

              <button
                onClick={() => setOnboardingStep(2)}
                className="neo-btn bg-[var(--color-accent)] hover:bg-yellow-400 w-full py-2.5 font-black text-sm flex items-center justify-center gap-1"
              >
                Mulai Sekarang!
              </button>
            </div>
          )}

          {/* Onboarding Step 2: Name Input */}
          {onboardingStep === 2 && (
            <div className="space-y-5 animate-fade-in py-2">
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Langkah 1 dari 2</span>
                <h2 className="text-lg font-black text-neutral-900">Siapa nama panggilanmu?</h2>
                <p className="text-xs text-neutral-500 font-medium font-sans">Beri tahu kami agar aplikasi terasa lebih personal.</p>
              </div>

              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Masukkan namamu (misal: Budi, Susi)..."
                  value={onboardingName}
                  onChange={e => setOnboardingName(e.target.value)}
                  className="w-full px-4 py-3 bg-neutral-50 border-2 border-neutral-900 rounded-lg text-sm font-bold focus:outline-none focus:bg-white"
                  maxLength={15}
                  required
                />

                <div className="flex gap-2">
                  <button
                    onClick={() => setOnboardingStep(1)}
                    className="w-1/3 neo-btn bg-neutral-100 hover:bg-neutral-200 py-2.5 text-xs font-black"
                  >
                    Kembali
                  </button>
                  <button
                    onClick={() => onboardingName.trim() && setOnboardingStep(3)}
                    disabled={!onboardingName.trim()}
                    className={`flex-1 neo-btn ${onboardingName.trim() ? 'bg-[var(--color-accent)]' : 'bg-neutral-200 text-neutral-400 cursor-not-allowed border-neutral-300'} py-2.5 text-xs font-black`}
                  >
                    Lanjut
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Onboarding Step 3: Goals Selection */}
          {onboardingStep === 3 && (
            <div className="space-y-5 animate-fade-in py-2">
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Langkah 2 dari 2</span>
                <h2 className="text-lg font-black text-neutral-900">Apa tujuan keuangan utamamu?</h2>
                <p className="text-xs text-neutral-500 font-medium">Ini membantu menyelaraskan fokus pencatatanmu.</p>
              </div>

              <div className="space-y-2">
                {[
                  { id: 'menabung', label: 'Menabung demi masa depan' },
                  { id: 'mencatat_tidak_jelas', label: 'Mencatat pengeluaran yang tidak jelas' },
                  { id: 'membatasi_impulsif', label: 'Membatasi belanja impulsif atau lapar mata' },
                  { id: 'dana_darurat', label: 'Membangun dana darurat yang kokoh' }
                ].map(item => (
                  <button
                    key={item.id}
                    onClick={() => setOnboardingGoal(item.id)}
                    className={`w-full text-left px-4 py-3 border-2 rounded-lg text-xs font-bold transition-all flex justify-between items-center ${
                      onboardingGoal === item.id
                        ? 'border-neutral-900 bg-yellow-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                        : 'border-neutral-200 bg-white hover:border-neutral-400 text-neutral-600'
                    }`}
                  >
                    <span>{item.label}</span>
                    {onboardingGoal === item.id && <span className="text-[10px] bg-neutral-900 text-white px-1.5 py-0.5 rounded">Dipilih</span>}
                  </button>
                ))}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setOnboardingStep(2)}
                  className="w-1/3 neo-btn bg-neutral-100 hover:bg-neutral-200 py-2.5 text-xs font-black"
                >
                  Kembali
                </button>
                <button
                  onClick={handleCompleteOnboarding}
                  className="flex-1 neo-btn bg-[var(--color-accent)] hover:bg-yellow-400 py-2.5 text-xs font-black"
                >
                  Selesaikan
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Render Loader screen (Highly-detailed homepage skeleton matching all sections exactly)
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] pb-24 text-neutral-900 flex justify-center select-none font-sans relative">
        <div className="w-full max-w-md px-4 py-4 space-y-5 animate-pulse">
          
          {/* 1. Skeleton: Header Ringkas */}
          <div className="flex justify-between items-center bg-white p-3.5 border-3 border-neutral-900 rounded-[var(--radius-md)] neo-shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full border-2 border-neutral-900 bg-neutral-200 shrink-0" />
              <div className="space-y-2">
                <div className="h-3.5 bg-neutral-200 rounded w-20" />
                <div className="h-3 bg-neutral-200 rounded w-32" />
              </div>
            </div>
            <div className="w-24 h-9 rounded-full bg-neutral-200 border-2 border-neutral-900" />
          </div>

          {/* 2. Skeleton: Kartu Saldo Utama */}
          <div className="bg-white p-6 border-3 border-neutral-900 rounded-[var(--radius-lg)] neo-shadow-lg flex flex-col justify-between relative overflow-hidden h-44">
            <div className="absolute right-4 top-4 w-9 h-9 rounded-full bg-neutral-200 border-2 border-neutral-900" />
            
            <div className="space-y-2.5">
              <div className="h-3 bg-neutral-200 rounded w-24" />
              <div className="h-8 bg-neutral-200 rounded w-44" />
            </div>

            <div className="space-y-2.5">
              <div className="flex justify-between items-center">
                <div className="h-3 bg-neutral-200 rounded w-36" />
                <div className="h-4 bg-neutral-200 rounded w-16" />
              </div>
              <div className="w-full h-4 bg-neutral-200 rounded-full border-2 border-neutral-900" />
            </div>
          </div>

          {/* 3. Skeleton: Kartu Streak (Duolingo Style with Background Flame representation) */}
          <div className="bg-white p-5 border-3 border-neutral-900 rounded-[var(--radius-md)] neo-shadow-md relative overflow-hidden min-h-[100px] flex flex-col justify-center">
            <div className="space-y-2">
              <div className="h-4 bg-neutral-200 rounded w-32" />
              <div className="h-3 bg-neutral-200 rounded w-48" />
            </div>

            <div className="grid grid-cols-7 gap-1 mt-4 pt-3 border-t border-neutral-200">
              {[1, 2, 3, 4, 5, 6, 7].map((val) => (
                <div key={val} className="flex flex-col items-center gap-1.5">
                  <div className="h-2.5 bg-neutral-200 rounded w-6" />
                  <div className="w-9 h-9 rounded-full bg-neutral-100 border-2 border-neutral-200" />
                </div>
              ))}
            </div>
          </div>

          {/* 4. Skeleton: Ringkasan Bulanan (Stacked list) */}
          <div className="space-y-3">
            {[1, 2, 3].map((val) => (
              <div key={val} className="bg-white p-4 border-3 border-neutral-900 rounded-[var(--radius-md)] neo-shadow-sm flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-neutral-100 border-2 border-neutral-900" />
                  <div className="space-y-1.5">
                    <div className="h-2.5 bg-neutral-200 rounded w-20" />
                    <div className="h-3 bg-neutral-200 rounded w-24" />
                  </div>
                </div>
                <div className="h-5 bg-neutral-200 rounded w-28" />
              </div>
            ))}
          </div>

          {/* 5. Skeleton: Quick Actions */}
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((val) => (
              <div key={val} className="bg-neutral-100 border-3 border-neutral-900 p-4 flex flex-col items-center justify-center gap-2 h-20 rounded-[var(--radius-md)]">
                <div className="w-6 h-6 rounded bg-neutral-200" />
                <div className="h-3 bg-neutral-200 rounded w-12" />
              </div>
            ))}
          </div>

          {/* 6. Skeleton: Target Impian Nabung (Touch Carousel) */}
          <div className="bg-white p-4.5 border-3 border-neutral-900 rounded-[var(--radius-md)] neo-shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="h-3.5 bg-neutral-200 rounded w-36" />
              <div className="h-2.5 bg-neutral-200 rounded w-24" />
            </div>

            <div className="bg-white p-3.5 border-2 border-neutral-900 rounded-lg flex gap-3">
              <div className="w-16 h-16 rounded-lg border-2 border-neutral-900 bg-neutral-100 shrink-0" />
              <div className="flex-1 flex flex-col justify-between">
                <div className="space-y-1.5">
                  <div className="h-4 bg-neutral-200 rounded w-28" />
                  <div className="h-3 bg-neutral-200 rounded w-36" />
                </div>
                <div className="space-y-1.5 mt-2">
                  <div className="w-full h-3.5 bg-neutral-200 rounded-full border-2 border-neutral-900" />
                  <div className="flex justify-between items-center">
                    <div className="h-2.5 bg-neutral-200 rounded w-16" />
                    <div className="h-3.5 bg-neutral-200 rounded w-20" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 7. Skeleton: Transaksi Terbaru */}
          <div className="bg-white p-4.5 border-3 border-neutral-900 rounded-[var(--radius-md)] neo-shadow-md space-y-4">
            <div className="flex justify-between items-center">
              <div className="h-4 bg-neutral-200 rounded w-28" />
              <div className="h-3.5 bg-neutral-200 rounded w-12" />
            </div>

            <div className="space-y-2">
              {[1, 2, 3].map((val) => (
                <div key={val} className="p-3 bg-white border-2 border-neutral-900 rounded-lg flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full border-2 border-neutral-900 bg-neutral-200 shrink-0" />
                    <div className="space-y-1.5">
                      <div className="h-3 bg-neutral-200 rounded w-24" />
                      <div className="h-2 bg-neutral-200 rounded w-16" />
                    </div>
                  </div>
                  <div className="h-4 bg-neutral-200 rounded w-20" />
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] pb-24 text-neutral-900 flex justify-center select-none font-sans relative">
      <div className="w-full max-w-md px-4 py-4 space-y-4">
        
        {/* PWA Install Invitation Card */}
        {installPromptEvent && (
          <div className="bg-orange-50 border-2 border-neutral-900 p-3.5 rounded-lg neo-shadow-sm flex items-center justify-between gap-3 animate-bounce-subtle">
            <div className="flex items-center gap-2.5">
              <div className="text-xl">📲</div>
              <div>
                <h4 className="text-xs font-black text-neutral-800">Pasang Daptrack!</h4>
                <p className="text-[10px] text-neutral-500 font-bold leading-tight mt-0.5">Akses instan dari layar utama HP atau Desktop.</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={async () => {
                  if (installPromptEvent) {
                    installPromptEvent.prompt();
                    const { outcome } = await installPromptEvent.userChoice;
                    console.log(`User choice outcome: ${outcome}`);
                    setInstallPromptEvent(null);
                  }
                }}
                className="px-3 py-1.5 bg-neutral-900 text-white text-[10px] font-black rounded neo-border cursor-pointer"
              >
                Pasang
              </button>
              <button
                onClick={() => setInstallPromptEvent(null)}
                className="w-6 h-6 rounded flex items-center justify-center font-bold text-neutral-400 text-xs hover:text-neutral-950 cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Render Page Tabs */}
        <main className="animate-fade-in">
          {activeTab === 'home' && (
            <Dashboard
              transactions={transactions}
              streakDays={streakDays}
              settings={settings}
              goals={goals}
              streakInfo={streakInfo}
              onOpenAddModal={handleOpenAddModal}
              onDeleteTransaction={handleDeleteTransaction}
              onAddTransaction={handleSaveTransaction}
            />
          )}

          {activeTab === 'goals' && (
            <Goals 
              transactions={transactions}
              settings={settings}
              onGoalUpdated={loadDatabaseValues} 
            />
          )}

          {activeTab === 'history' && (
            <History
              transactions={transactions}
              settings={settings}
              onDeleteTransaction={handleDeleteTransaction}
              onUpdateTransaction={loadDatabaseValues}
            />
          )}

          {activeTab === 'stats' && (
            <Statistics
              transactions={transactions}
              settings={settings}
            />
          )}

          {activeTab === 'profile' && (
            <Profile
              settings={settings}
              transactions={transactions}
              onUpdateSettings={handleUpdateSettings}
              onResetAllData={handleResetAllData}
            />
          )}
        </main>
      </div>

      {/* BOTTOM FIXED NAVIGATION BAR (Pinned Flat at Very Bottom of Screen with Extra Safe Padding) */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t-3 border-neutral-900 pt-2 pb-[calc(16px+env(safe-area-inset-bottom,0px))] z-35 flex justify-between items-center rounded-none shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
        {/* Home */}
        <button
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center justify-center py-1 flex-1 h-12 transition-colors cursor-pointer ${
            activeTab === 'home'
              ? 'text-neutral-950 font-black'
              : 'text-neutral-400 font-bold hover:text-neutral-600'
          }`}
        >
          <Home size={18} strokeWidth={activeTab === 'home' ? 3 : 2} />
          <span className="text-[9px] mt-0.5">Beranda</span>
        </button>

        {/* Goals */}
        <button
          onClick={() => setActiveTab('goals')}
          className={`flex flex-col items-center justify-center py-1 flex-1 h-12 transition-colors cursor-pointer ${
            activeTab === 'goals'
              ? 'text-neutral-950 font-black'
              : 'text-neutral-400 font-bold hover:text-neutral-600'
          }`}
        >
          <Target size={18} strokeWidth={activeTab === 'goals' ? 3 : 2} />
          <span className="text-[9px] mt-0.5">Target</span>
        </button>

        {/* History / Aktivitas */}
        <button
          onClick={() => setActiveTab('history')}
          className={`flex flex-col items-center justify-center py-1 flex-1 h-12 transition-colors cursor-pointer ${
            activeTab === 'history'
              ? 'text-neutral-950 font-black'
              : 'text-neutral-400 font-bold hover:text-neutral-600'
          }`}
        >
          <HistoryIcon size={18} strokeWidth={activeTab === 'history' ? 3 : 2} />
          <span className="text-[9px] mt-0.5">Aktivitas</span>
        </button>

        {/* Statistics */}
        <button
          onClick={() => setActiveTab('stats')}
          className={`flex flex-col items-center justify-center py-1 flex-1 h-12 transition-colors cursor-pointer ${
            activeTab === 'stats'
              ? 'text-neutral-950 font-black'
              : 'text-neutral-400 font-bold hover:text-neutral-600'
          }`}
        >
          <BarChart2 size={18} strokeWidth={activeTab === 'stats' ? 3 : 2} />
          <span className="text-[9px] mt-0.5">Analisis</span>
        </button>

        {/* Profile */}
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center justify-center py-1 flex-1 h-12 transition-colors cursor-pointer ${
            activeTab === 'profile'
              ? 'text-neutral-950 font-black'
              : 'text-neutral-400 font-bold hover:text-neutral-600'
          }`}
        >
          <User size={18} strokeWidth={activeTab === 'profile' ? 3 : 2} />
          <span className="text-[9px] mt-0.5">Profil</span>
        </button>
      </nav>

      {/* FLOATING ACTION BUTTON (With Auto-Slide Out Interaction) */}
      <div 
        className={`fixed bottom-24 right-4 z-40 transition-all duration-500 transform ${
          isFabCollapsed ? 'translate-x-[60%] opacity-70' : 'translate-x-0 opacity-100'
        }`}
        onMouseEnter={() => {
          setIsFabCollapsed(false);
          setLastActivityTime(Date.now());
        }}
        onTouchStart={() => {
          setIsFabCollapsed(false);
          setLastActivityTime(Date.now());
        }}
      >
        <button
          onClick={handleFabClick}
          className="w-13 h-13 bg-[var(--color-accent)] hover:bg-yellow-400 text-neutral-950 rounded-full flex items-center justify-center border-3 border-neutral-900 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none hover:scale-105 transition-all relative cursor-pointer"
          title="Tambah Transaksi"
        >
          <Plus size={26} strokeWidth={3} className={`transition-transform duration-300 ${isFabCollapsed ? 'rotate-45 text-neutral-600' : 'text-neutral-950'}`} />
        </button>
      </div>

      {/* TRANSITION MODAL (SLIDE UP Bottom Sheet) */}
      <TransactionModal
        type={addModalType}
        settings={settings}
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSave={handleSaveTransaction}
      />

      {/* CUSTOM DELETE CONFIRMATION MODAL */}
      {txToDelete !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white w-full max-w-xs p-5 border-3 border-neutral-900 rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-4 text-center">
            <h3 className="text-md font-black">Hapus Transaksi?</h3>
            <p className="text-xs text-neutral-500 font-bold leading-relaxed">
              Apakah kamu yakin ingin menghapus catatan transaksi ini dari penyimpanan lokal? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setTxToDelete(null)}
                className="w-1/2 neo-btn bg-neutral-100 hover:bg-neutral-200 py-2.5 text-xs font-black cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={async () => {
                  const id = txToDelete;
                  setTxToDelete(null);
                  try {
                    await deleteTransaction(id);
                    await loadDatabaseValues();
                  } catch (err) {
                    console.error('Failed to delete transaction: ', err);
                  }
                }}
                className="w-1/2 neo-btn bg-rose-500 hover:bg-rose-600 text-white py-2.5 text-xs font-black cursor-pointer"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
