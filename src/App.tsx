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
import { Home, History as HistoryIcon, BarChart2, User, Plus, Sparkles, Target, CheckCircle2 } from 'lucide-react';

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
              '📲 Duittrack Aktif di HP-mu!',
              'Duittrack siap mengirimkan pengingat harian otomatis agar kamu makin disiplin mengelola uang harian!'
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
            '🔥 Selamat Datang Kembali di Duittrack!',
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
            tag: 'duittrack-reminder-alarm',
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
  };

  const handleFabClick = () => {
    setAddModalType('expense');
    setIsAddModalOpen(true);
  };

  // Render onboarding screen
  if (showOnboarding) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text-primary)] flex items-center justify-center p-4 font-sans select-none">
        <div className="w-full max-w-sm bg-white border border-[var(--color-border)] rounded-2xl p-6 shadow-lg space-y-6 relative overflow-hidden">
          {/* Header step indicators */}
          <div className="flex items-center justify-between pb-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[var(--color-primary-light)] flex items-center justify-center text-[var(--color-primary)] font-bold text-sm">
                DT
              </div>
              <span className="text-xs font-semibold tracking-wide text-[var(--color-text-secondary)]">Duittrack</span>
            </div>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3].map((step) => (
                <div 
                  key={step} 
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    onboardingStep === step 
                      ? 'w-6 bg-[var(--color-primary)]' 
                      : onboardingStep > step 
                      ? 'w-2 bg-[var(--color-accent)]' 
                      : 'w-2 bg-neutral-200'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Onboarding Step 1: Welcome */}
          {onboardingStep === 1 && (
            <div className="space-y-6 text-center py-2 animate-fade-in">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-[var(--color-primary-light)] flex items-center justify-center text-[var(--color-primary)]">
                <Sparkles size={32} />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">Kelola Keuangan Lebih Tenang</h1>
                <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed px-1">
                  Catat pengeluaran harian, pantau kebiasaan menabung, dan capai target keuangan impianmu dengan rapi dan aman secara lokal.
                </p>
              </div>

              <button
                onClick={() => setOnboardingStep(2)}
                className="w-full py-3 px-4 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-semibold text-sm rounded-xl transition-all shadow-sm active:scale-[0.99] cursor-pointer"
              >
                Mulai Sekarang
              </button>
            </div>
          )}

          {/* Onboarding Step 2: Name Input */}
          {onboardingStep === 2 && (
            <div className="space-y-5 py-2 animate-fade-in">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold tracking-wider text-[var(--color-accent)] uppercase">Langkah 1 dari 2</span>
                <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Siapa nama panggilanmu?</h2>
                <p className="text-xs text-[var(--color-text-secondary)]">Beri tahu kami agar sapaan dan laporan terasa lebih personal.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <input
                    type="text"
                    placeholder="Contoh: Budi, Susi..."
                    value={onboardingName}
                    onChange={e => setOnboardingName(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-[var(--color-border)] rounded-xl text-sm font-semibold text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/15 transition-all"
                    maxLength={15}
                    required
                  />
                </div>

                <div className="flex gap-2.5 pt-1">
                  <button
                    onClick={() => setOnboardingStep(1)}
                    className="w-1/3 py-2.5 px-3 bg-white border border-[var(--color-border)] hover:bg-[var(--color-bg)] text-[var(--color-text-secondary)] rounded-xl text-xs font-semibold transition-all cursor-pointer"
                  >
                    Kembali
                  </button>
                  <button
                    onClick={() => onboardingName.trim() && setOnboardingStep(3)}
                    disabled={!onboardingName.trim()}
                    className={`flex-1 py-2.5 px-4 font-semibold text-xs rounded-xl transition-all cursor-pointer ${
                      onboardingName.trim() 
                        ? 'bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white shadow-sm active:scale-[0.99]' 
                        : 'bg-neutral-100 text-neutral-400 cursor-not-allowed border border-neutral-200'
                    }`}
                  >
                    Lanjut
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Onboarding Step 3: Goals Selection */}
          {onboardingStep === 3 && (
            <div className="space-y-5 py-2 animate-fade-in">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold tracking-wider text-[var(--color-accent)] uppercase">Langkah 2 dari 2</span>
                <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Fokus keuangan utamamu?</h2>
                <p className="text-xs text-[var(--color-text-secondary)]">Pilih tujuan yang paling ingin kamu prioritaskan saat ini.</p>
              </div>

              <div className="space-y-2.5">
                {[
                  { id: 'menabung', label: 'Menabung demi masa depan' },
                  { id: 'mencatat_tidak_jelas', label: 'Mencatat pengeluaran yang tidak jelas' },
                  { id: 'membatasi_impulsif', label: 'Membatasi belanja impulsif & lapar mata' },
                  { id: 'dana_darurat', label: 'Membangun dana darurat yang kokoh' }
                ].map(item => {
                  const isSelected = onboardingGoal === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setOnboardingGoal(item.id)}
                      className={`w-full text-left px-4 py-3 rounded-xl text-xs font-medium transition-all flex justify-between items-center border cursor-pointer ${
                        isSelected
                          ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)] text-[var(--color-primary)] font-semibold shadow-xs'
                          : 'border-[var(--color-border)] bg-white hover:border-[var(--color-border-hover)] text-[var(--color-text-primary)]'
                      }`}
                    >
                      <span>{item.label}</span>
                      {isSelected ? (
                        <CheckCircle2 size={16} className="text-[var(--color-primary)] shrink-0" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-[var(--color-border)] shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  onClick={() => setOnboardingStep(2)}
                  className="w-1/3 py-2.5 px-3 bg-white border border-[var(--color-border)] hover:bg-[var(--color-bg)] text-[var(--color-text-secondary)] rounded-xl text-xs font-semibold transition-all cursor-pointer"
                >
                  Kembali
                </button>
                <button
                  onClick={handleCompleteOnboarding}
                  className="flex-1 py-2.5 px-4 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-xl text-xs font-semibold shadow-sm active:scale-[0.99] transition-all cursor-pointer"
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

  // Render Loader screen (Clean Modern Skeleton)
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] pb-24 text-[var(--color-text-primary)] flex justify-center select-none font-sans relative">
        <div className="w-full max-w-md px-4 py-4 space-y-4 animate-pulse">
          
          {/* 1. Skeleton: Header Ringkas */}
          <div className="flex justify-between items-center bg-white p-4 border border-[var(--color-border)] rounded-2xl shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-neutral-100 shrink-0" />
              <div className="space-y-2">
                <div className="h-3 bg-neutral-200 rounded-md w-20" />
                <div className="h-4 bg-neutral-200 rounded-md w-32" />
              </div>
            </div>
            <div className="w-20 h-8 rounded-full bg-neutral-100" />
          </div>

          {/* 2. Skeleton: Kartu Saldo Utama */}
          <div className="bg-white p-6 border border-[var(--color-border)] rounded-2xl shadow-xs flex flex-col justify-between h-44">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <div className="h-3 bg-neutral-200 rounded-md w-24" />
                <div className="h-8 bg-neutral-200 rounded-md w-44" />
              </div>
              <div className="w-9 h-9 rounded-xl bg-neutral-100" />
            </div>

            <div className="space-y-2.5">
              <div className="flex justify-between items-center">
                <div className="h-3 bg-neutral-200 rounded-md w-36" />
                <div className="h-3 bg-neutral-200 rounded-md w-16" />
              </div>
              <div className="w-full h-2.5 bg-neutral-100 rounded-full" />
            </div>
          </div>

          {/* 3. Skeleton: Kartu Streak */}
          <div className="bg-white p-5 border border-[var(--color-border)] rounded-2xl shadow-xs space-y-4">
            <div className="space-y-2">
              <div className="h-4 bg-neutral-200 rounded-md w-32" />
              <div className="h-3 bg-neutral-200 rounded-md w-48" />
            </div>

            <div className="grid grid-cols-7 gap-2 pt-2 border-t border-[var(--color-border)]">
              {[1, 2, 3, 4, 5, 6, 7].map((val) => (
                <div key={val} className="flex flex-col items-center gap-1.5">
                  <div className="h-2.5 bg-neutral-200 rounded w-5" />
                  <div className="w-8 h-8 rounded-full bg-neutral-100" />
                </div>
              ))}
            </div>
          </div>

          {/* 4. Skeleton: Quick Actions */}
          <div className="grid grid-cols-4 gap-2.5">
            {[1, 2, 3, 4].map((val) => (
              <div key={val} className="bg-white border border-[var(--color-border)] p-3 flex flex-col items-center justify-center gap-2 h-20 rounded-xl shadow-xs">
                <div className="w-7 h-7 rounded-lg bg-neutral-100" />
                <div className="h-2.5 bg-neutral-200 rounded w-12" />
              </div>
            ))}
          </div>

          {/* 5. Skeleton: Transaksi Terbaru */}
          <div className="bg-white p-4 border border-[var(--color-border)] rounded-2xl shadow-xs space-y-3">
            <div className="flex justify-between items-center pb-1">
              <div className="h-4 bg-neutral-200 rounded-md w-28" />
              <div className="h-3 bg-neutral-200 rounded-md w-12" />
            </div>

            <div className="space-y-2">
              {[1, 2, 3].map((val) => (
                <div key={val} className="p-3 bg-[var(--color-bg)] rounded-xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-neutral-200 shrink-0" />
                    <div className="space-y-1.5">
                      <div className="h-3 bg-neutral-200 rounded w-24" />
                      <div className="h-2.5 bg-neutral-200 rounded w-16" />
                    </div>
                  </div>
                  <div className="h-3.5 bg-neutral-200 rounded w-20" />
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] pb-24 text-[var(--color-text-primary)] flex justify-center select-none font-sans relative">
      <div className="w-full max-w-md px-4 py-4 space-y-4">
        
        {/* PWA Install Invitation Card */}
        {installPromptEvent && (
          <div className="bg-white border border-[var(--color-border)] p-3.5 rounded-2xl shadow-sm flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[var(--color-primary-light)] text-[var(--color-primary)] flex items-center justify-center font-bold text-base shrink-0">
                📲
              </div>
              <div>
                <h4 className="text-xs font-bold text-[var(--color-text-primary)]">Pasang Duittrack</h4>
                <p className="text-[11px] text-[var(--color-text-secondary)] leading-tight mt-0.5">Akses instan dari layar utama HP atau komputermu.</p>
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
                className="px-3 py-1.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-[11px] font-semibold rounded-lg shadow-xs cursor-pointer transition-colors"
              >
                Pasang
              </button>
              <button
                onClick={() => setInstallPromptEvent(null)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-sm cursor-pointer transition-colors"
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

      {/* BOTTOM FIXED NAVIGATION BAR (Modern clean e-wallet dock) */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-[var(--color-border)] pt-2 pb-[calc(14px+env(safe-area-inset-bottom,0px))] z-35 flex justify-between items-center rounded-none shadow-[0_-4px_16px_rgba(26,67,78,0.05)]">
        {/* Home */}
        <button
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center justify-center py-1 flex-1 h-12 transition-colors cursor-pointer ${
            activeTab === 'home'
              ? 'text-[var(--color-primary)] font-bold'
              : 'text-[var(--color-text-muted)] font-medium hover:text-[var(--color-text-secondary)]'
          }`}
        >
          <Home size={19} strokeWidth={activeTab === 'home' ? 2.5 : 1.8} />
          <span className="text-[10px] mt-1 font-medium">Beranda</span>
        </button>

        {/* Goals */}
        <button
          onClick={() => setActiveTab('goals')}
          className={`flex flex-col items-center justify-center py-1 flex-1 h-12 transition-colors cursor-pointer ${
            activeTab === 'goals'
              ? 'text-[var(--color-primary)] font-bold'
              : 'text-[var(--color-text-muted)] font-medium hover:text-[var(--color-text-secondary)]'
          }`}
        >
          <Target size={19} strokeWidth={activeTab === 'goals' ? 2.5 : 1.8} />
          <span className="text-[10px] mt-1 font-medium">Target</span>
        </button>

        {/* History / Aktivitas */}
        <button
          onClick={() => setActiveTab('history')}
          className={`flex flex-col items-center justify-center py-1 flex-1 h-12 transition-colors cursor-pointer ${
            activeTab === 'history'
              ? 'text-[var(--color-primary)] font-bold'
              : 'text-[var(--color-text-muted)] font-medium hover:text-[var(--color-text-secondary)]'
          }`}
        >
          <HistoryIcon size={19} strokeWidth={activeTab === 'history' ? 2.5 : 1.8} />
          <span className="text-[10px] mt-1 font-medium">Aktivitas</span>
        </button>

        {/* Statistics */}
        <button
          onClick={() => setActiveTab('stats')}
          className={`flex flex-col items-center justify-center py-1 flex-1 h-12 transition-colors cursor-pointer ${
            activeTab === 'stats'
              ? 'text-[var(--color-primary)] font-bold'
              : 'text-[var(--color-text-muted)] font-medium hover:text-[var(--color-text-secondary)]'
          }`}
        >
          <BarChart2 size={19} strokeWidth={activeTab === 'stats' ? 2.5 : 1.8} />
          <span className="text-[10px] mt-1 font-medium">Analisis</span>
        </button>

        {/* Profile */}
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center justify-center py-1 flex-1 h-12 transition-colors cursor-pointer ${
            activeTab === 'profile'
              ? 'text-[var(--color-primary)] font-bold'
              : 'text-[var(--color-text-muted)] font-medium hover:text-[var(--color-text-secondary)]'
          }`}
        >
          <User size={19} strokeWidth={activeTab === 'profile' ? 2.5 : 1.8} />
          <span className="text-[10px] mt-1 font-medium">Profil</span>
        </button>
      </nav>

      {/* FLOATING ACTION BUTTON */}
      <div className="fab-fixed-container">
        <button
          type="button"
          onClick={handleFabClick}
          className="w-13 h-13 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-2xl flex items-center justify-center shadow-lg active:scale-95 transition-transform cursor-pointer"
          title="Tambah Transaksi"
          aria-label="Tambah Transaksi"
        >
          <Plus size={24} strokeWidth={2.5} />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white w-full max-w-xs p-6 border border-[var(--color-border)] rounded-2xl shadow-xl space-y-4 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-[var(--color-danger-light)] text-[var(--color-danger)] flex items-center justify-center">
              <span className="text-xl">⚠️</span>
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-[var(--color-text-primary)]">Hapus Transaksi?</h3>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                Catatan transaksi ini akan dihapus dari penyimpanan. Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>
            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => setTxToDelete(null)}
                className="w-1/2 py-2.5 px-3 bg-white border border-[var(--color-border)] hover:bg-[var(--color-bg)] text-[var(--color-text-secondary)] rounded-xl text-xs font-semibold cursor-pointer transition-colors"
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
                className="w-1/2 py-2.5 px-3 bg-[var(--color-danger)] hover:bg-rose-700 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs transition-colors"
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
