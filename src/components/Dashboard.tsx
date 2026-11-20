import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Transaction, StreakDay, AppSettings, Goal, Wallet } from '../types';
import { getWallets } from '../db/indexedDB';
import { formatRupiah, getMonthlySummary, calculateOverallBalance, predictBrokeDate, getHeatmapData, getTodayLocalDateStr, parseLocalDate, calculateWalletBalances } from '../utils/financeHelpers';
import { Flame, Snowflake, Sparkles, TrendingUp, TrendingDown, Target, Trash2, ChevronRight, ChevronLeft, Calendar, AlertTriangle, CheckCircle, User, ShoppingBag, Coins, Bookmark, Wallet as WalletIcon } from 'lucide-react';
import CategoryIcon from './CategoryIcon';
import gsap from 'gsap';

interface DashboardProps {
  transactions: Transaction[];
  streakDays: StreakDay[];
  settings: AppSettings;
  goals: Goal[];
  streakInfo: {
    currentStreak: number;
    weeklyProgress: boolean[];
    freezeCount: number;
    streakTriggeredMilestone: boolean;
    milestoneTier: string;
  };
  onOpenAddModal: (type: 'income' | 'expense' | 'saving' | 'transfer') => void;
  onDeleteTransaction: (id: number) => void;
  onAddTransaction?: (tx: Transaction) => void;
}

export default function Dashboard({
  transactions,
  streakDays,
  settings,
  goals,
  streakInfo,
  onOpenAddModal,
  onDeleteTransaction,
  onAddTransaction
}: DashboardProps) {
  const [showStreakModal, setShowStreakModal] = useState(false);
  const [tutorialStep, setTutorialStep] = useState<number | null>(null);
  const [wallets, setWallets] = useState<Wallet[]>([]);

  useEffect(() => {
    getWallets().then(setWallets).catch(console.error);
  }, [transactions]); // reload wallets if transactions change (though wallets themselves won't change often, their balances do, but we just need initialBalance)

  // Memoized high-performance calculations to avoid unnecessary recalculations when data state is identical
  const monthlySummary = useMemo(() => getMonthlySummary(transactions), [transactions]);
  const { income, expense, saving, balance } = monthlySummary;

  const overallBalance = useMemo(() => calculateOverallBalance(transactions, wallets), [transactions, wallets]);
  const walletBalances = useMemo(() => calculateWalletBalances(wallets, transactions), [wallets, transactions]);

  const brokePrediction = useMemo(() => predictBrokeDate(transactions, overallBalance), [transactions, overallBalance]);

  const heatmapCells = useMemo(() => getHeatmapData(transactions), [transactions]);

  const [userName, setUserName] = useState(() => localStorage.getItem('finance_user_name') || 'Budi');
  const [profilePhoto, setProfilePhoto] = useState(() => localStorage.getItem('finance_profile_photo') || '');

  // GSAP Entrance Animations
  useEffect(() => {
    gsap.fromTo('#dashboard-header',
      { opacity: 0, y: -10 },
      { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }
    );
    gsap.fromTo('#balance-card, #streak-card, #metrics-grid, #quick-actions, #activity-heatmap, #savings-goals, #recent-transactions',
      { opacity: 0, y: 15 },
      { opacity: 1, y: 0, duration: 0.5, stagger: 0.07, ease: 'power2.out', delay: 0.05 }
    );
  }, []);

  useEffect(() => {
    const handleNameUpdate = () => {
      setUserName(localStorage.getItem('finance_user_name') || 'Budi');
    };
    const handlePhotoUpdate = () => {
      setProfilePhoto(localStorage.getItem('finance_profile_photo') || '');
    };
    window.addEventListener('user_name_updated', handleNameUpdate);
    window.addEventListener('profile_photo_updated', handlePhotoUpdate);
    return () => {
      window.removeEventListener('user_name_updated', handleNameUpdate);
      window.removeEventListener('profile_photo_updated', handlePhotoUpdate);
    };
  }, []);

  // Streak Calendar Month Navigation State
  const [streakMonth, setStreakMonth] = useState(() => new Date().getMonth());
  const [streakYear, setStreakYear] = useState(() => new Date().getFullYear());

  // Find the earliest date with recorded transactions or streak days
  const earliestDataDate = useMemo(() => {
    let minDateStr: string | null = null;

    transactions.forEach(t => {
      if (!minDateStr || t.date < minDateStr) {
        minDateStr = t.date;
      }
    });

    streakDays.forEach(s => {
      if (!minDateStr || s.date < minDateStr) {
        minDateStr = s.date;
      }
    });

    if (minDateStr) {
      return parseLocalDate(minDateStr);
    }
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }, [transactions, streakDays]);

  // Check if data exists in months prior to currently selected (streakYear, streakMonth)
  const hasPreviousMonthData = useMemo(() => {
    const selectedFirstDay = new Date(streakYear, streakMonth, 1);
    const earliestFirstDay = new Date(earliestDataDate.getFullYear(), earliestDataDate.getMonth(), 1);
    return selectedFirstDay > earliestFirstDay;
  }, [streakYear, streakMonth, earliestDataDate]);

  // Check if we can navigate to next month (up to real current month)
  const hasNextMonthData = useMemo(() => {
    const now = new Date();
    const currentRealFirstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const selectedFirstDay = new Date(streakYear, streakMonth, 1);
    return selectedFirstDay < currentRealFirstDay;
  }, [streakYear, streakMonth]);

  const handlePrevStreakMonth = () => {
    if (!hasPreviousMonthData) return;
    if (streakMonth === 0) {
      setStreakMonth(11);
      setStreakYear(prev => prev - 1);
    } else {
      setStreakMonth(prev => prev - 1);
    }
  };

  const handleNextStreakMonth = () => {
    if (!hasNextMonthData) return;
    if (streakMonth === 11) {
      setStreakMonth(0);
      setStreakYear(prev => prev + 1);
    } else {
      setStreakMonth(prev => prev + 1);
    }
  };

  // Dates for the selected streak calendar month
  const streakCalendarDays = useMemo(() => {
    const firstDay = new Date(streakYear, streakMonth, 1).getDay();
    const totalDays = new Date(streakYear, streakMonth + 1, 0).getDate();

    const days = [];
    const padding = firstDay === 0 ? 6 : firstDay - 1;
    for (let i = 0; i < padding; i++) {
      days.push(null);
    }
    for (let d = 1; d <= totalDays; d++) {
      days.push(new Date(streakYear, streakMonth, d));
    }
    return days;
  }, [streakYear, streakMonth]);

  // Helper to check what happened on a specific calendar day - memoized via useCallback
  const getDayStatus = useCallback((d: Date | null) => {
    if (!d) return { status: 'empty' };
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const dayVal = String(d.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${dayVal}`;
    
    // Check if had transaction
    const hasTx = transactions.some(t => t.date === dateStr);
    
    // Check if recorded as frozen or has streak day
    const rec = streakDays.find(s => s.date === dateStr);
    
    if (hasTx) {
      return { status: 'active' };
    } else if (rec && !rec.hasActivity && rec.streakCount > 0) {
      return { status: 'frozen' };
    }
    
    return { status: 'none' };
  }, [transactions, streakDays]);

  // Handle health color - memoized via useCallback
  const getHealthColor = useCallback(() => {
    if (brokePrediction.status === 'danger') return 'bg-rose-500';
    if (brokePrediction.status === 'warning') return 'bg-yellow-400';
    return 'bg-emerald-400';
  }, [brokePrediction.status]);

  return (
    <div className="space-y-6 px-1 py-1.5 pb-6">
      {/* 1. Header Ringkas */}
      <div id="dashboard-header" className="flex justify-between items-center bg-[var(--color-surface)] p-3.5 neo-border rounded-[var(--radius-md)] neo-shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full border-2 border-neutral-950 bg-neutral-100 flex items-center justify-center overflow-hidden shrink-0 neo-shadow-sm">
            {profilePhoto ? (
              <img src={profilePhoto} alt="Profil" className="w-full h-full object-cover" />
            ) : (
              <User size={20} className="text-neutral-400" />
            )}
          </div>
          <div>
            <h2 className="text-sm font-black tracking-tight">Halo, {userName}</h2>
            <p className="text-[10px] font-mono text-neutral-500 font-bold">
              {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {streakInfo.currentStreak > 0 ? (
            <div 
              onClick={() => setShowStreakModal(true)}
              className="flex items-center gap-1 bg-[var(--color-accent)] text-neutral-900 font-bold text-xs px-3 py-2 rounded-full neo-border neo-shadow-sm cursor-pointer select-none active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
            >
              <Flame size={15} className="animate-flame fill-red-500 text-red-500" />
              <span>{streakInfo.currentStreak} Hari</span>
            </div>
          ) : (
            <div 
              onClick={() => setShowStreakModal(true)}
              className="flex items-center gap-1 bg-neutral-200 text-neutral-600 font-bold text-xs px-3 py-2 rounded-full border border-neutral-400 cursor-pointer select-none"
            >
              <Flame size={15} className="text-neutral-400" />
              <span>Mulai Streak</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Kartu Saldo Utama */}
      <div id="balance-card" className="bg-[var(--color-surface)] p-6 neo-border rounded-[var(--radius-lg)] neo-shadow-lg flex flex-col justify-between relative overflow-hidden">
        <div className="absolute right-4 top-4 bg-[var(--color-accent)] p-2.5 rounded-full neo-border neo-shadow-sm">
          <TrendingUp className="text-neutral-900" size={18} />
        </div>
        
        <div>
          <span className="text-xs font-bold text-neutral-500 uppercase tracking-widest font-sans">Sisa Saldo Belanja</span>
          <h1 className="text-3xl font-black font-mono tracking-tight mt-1 mb-2 text-neutral-900">
            {formatRupiah(overallBalance)}
          </h1>
        </div>

        {/* Health bar indicator */}
        <div className="mt-4 space-y-2.5">
          <div className="flex justify-between items-center text-xs font-bold">
            <span className="flex items-center gap-1">
              Estimasi Tanggal Bokek:
            </span>
            <span className={`px-2 py-0.5 rounded font-mono text-neutral-900 ${
              brokePrediction.status === 'danger' ? 'bg-rose-300' : 
              brokePrediction.status === 'warning' ? 'bg-yellow-300' : 'bg-emerald-300'
            }`}>
              {brokePrediction.dateStr}
            </span>
          </div>

          <div className="w-full h-4 bg-neutral-200 rounded-full overflow-hidden neo-border relative">
            <div 
              className={`h-full ${getHealthColor()} transition-all duration-500`}
              style={{ 
                width: brokePrediction.daysRemaining === Infinity ? '100%' : `${Math.min(Math.max((brokePrediction.daysRemaining / 30) * 100, 8), 100)}%`
              }}
            />
          </div>
          {brokePrediction.daysRemaining !== Infinity && (
            <p className="text-[10px] font-mono text-neutral-500 text-right">
              {brokePrediction.daysRemaining <= 0 ? 'Saldo habis hari ini!' : `Bertahan ± ${brokePrediction.daysRemaining} hari lagi`}
            </p>
          )}
        </div>
        </div>

        {/* 2.5 Kartu Daftar Dompet (Wallet Carousel) */}
        {wallets.length > 0 && (
          <div className="space-y-2 animate-fade-in">
            <span className="text-[10px] font-black uppercase text-neutral-400 tracking-widest pl-1">Dompet Kamu</span>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none px-1">
              {wallets.map(w => (
                <div key={w.id} className="min-w-[140px] bg-white p-3.5 neo-border rounded-[var(--radius-md)] neo-shadow-sm flex flex-col gap-1.5 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-yellow-100 flex items-center justify-center border border-yellow-300">
                      <WalletIcon size={12} className="text-yellow-700" />
                    </div>
                    <span className="text-xs font-black truncate">{w.name}</span>
                  </div>
                  <span className="text-sm font-black font-mono text-neutral-900 mt-1">
                    {formatRupiah(walletBalances[w.id] || 0)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. Kartu Streak (Duolingo Style - Large Touch Targets with Large Background Flame) */}
      <div 
        id="streak-card" 
        onClick={() => setShowStreakModal(true)}
        className={`bg-[var(--color-surface)] p-5 neo-border rounded-[var(--radius-md)] neo-shadow-md cursor-pointer select-none hover:translate-x-[-1px] hover:translate-y-[-1px] relative overflow-hidden min-h-[100px] flex flex-col justify-center transition-all ${
          tutorialStep !== null ? 'border-amber-400 ring-2 ring-amber-300' : ''
        }`}
      >
        {/* Large stylized background flame icon - borderless and lowered opacity */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-15">
          <Flame size={80} className="text-orange-500 fill-orange-500 animate-flame" />
        </div>

        <div className="relative z-10 flex justify-between items-start">
          <div>
            <h3 className="font-extrabold text-md text-neutral-800 tracking-tight">
              {streakInfo.currentStreak} Hari Beruntun
            </h3>
            <p className="text-xs text-neutral-500 font-bold mt-1 max-w-[75%]">
              {streakInfo.currentStreak > 0 
                ? 'Keren! Catat terus keuangan harianmu.' 
                : 'Mulai streak pertamamu hari ini!'}
            </p>
          </div>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              setTutorialStep(1);
            }}
            className="neo-btn bg-amber-100 hover:bg-amber-200 text-neutral-900 text-[10px] font-black px-2.5 py-1.5 flex items-center gap-1 shrink-0 z-20 cursor-pointer"
          >
            Panduan
          </button>
        </div>

        {/* 7 hari checkpoints (Mon-Sun) - Larger Circle Touch-Targets */}
        <div className="grid grid-cols-7 gap-1 mt-4 pt-3 border-t border-neutral-200 relative z-10">
          {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((day, idx) => {
            const isActive = streakInfo.weeklyProgress[idx];
            return (
              <div key={day} className="flex flex-col items-center gap-1.5">
                <span className="text-[10px] font-bold text-neutral-400">{day}</span>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-all neo-border ${
                  isActive 
                    ? 'bg-[var(--color-income)] text-neutral-950 neo-shadow-sm scale-105' 
                    : 'bg-neutral-100 text-neutral-400 hover:bg-neutral-200'
                }`}>
                  {isActive ? '●' : '○'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Interactive Onboarding Tutorial Bubble for Streak System */}
      {tutorialStep !== null && (
        <div className="bg-yellow-50 border-3 border-neutral-950 p-4 rounded-[var(--radius-md)] neo-shadow-sm relative space-y-3 animate-fade-in">
          <div className="absolute -top-2.5 left-10 w-4 h-4 bg-yellow-50 border-t-3 border-l-3 border-neutral-950 rotate-45" />
          
          <div className="flex justify-between items-center relative z-10">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500 bg-yellow-200/60 px-2 py-0.5 rounded border border-yellow-300 font-mono">
              Panduan Streak • Langkah {tutorialStep} dari 4
            </span>
            <button 
              onClick={() => setTutorialStep(null)}
              className="text-xs font-black text-neutral-400 hover:text-neutral-900 cursor-pointer"
            >
              ✕ Lewati
            </button>
          </div>

          {tutorialStep === 1 && (
            <div className="space-y-1.5 relative z-10">
              <h4 className="font-black text-sm flex items-center gap-1 text-neutral-900">
                <Flame size={16} className="text-orange-500 fill-orange-500 animate-flame" /> 
                1. Catat Keuangan Setiap Hari
              </h4>
              <p className="text-xs font-bold text-neutral-700 leading-relaxed">
                Tercatatnya minimal <span className="underline decoration-orange-500 decoration-2">satu transaksi harian</span> (Belanja, Masuk, atau Nabung) sebelum jam 23:59 akan membuat api streak kamu terus menyala dan rekor bertambah!
              </p>
            </div>
          )}

          {tutorialStep === 2 && (
            <div className="space-y-1.5 relative z-10">
              <h4 className="font-black text-sm flex items-center gap-1 text-neutral-900">
                <CheckCircle size={16} className="text-emerald-500" /> 
                2. Checkpoint Mingguan
              </h4>
              <p className="text-xs font-bold text-neutral-700 leading-relaxed">
                Lihat bulatan di bawah! Bulatan hijau (<span className="text-emerald-600 font-extrabold">●</span>) menandakan hari sukses pencatatan. Warnai ketujuh bulatan dalam seminggu untuk kedisiplinan keuangan yang sempurna!
              </p>
            </div>
          )}

          {tutorialStep === 3 && (
            <div className="space-y-1.5 relative z-10">
              <h4 className="font-black text-sm flex items-center gap-1 text-neutral-900">
                <Snowflake size={16} className="text-sky-500" /> 
                3. Perlindungan Streak Freeze
              </h4>
              <p className="text-xs font-bold text-neutral-700 leading-relaxed">
                Sibuk atau lupa mencatat? Jangan khawatir! Jika diaktifkan di profil, <span className="text-sky-600 font-black">Streak Freeze</span> otomatis melindungi rentetan harianmu agar tidak hangus meski kamu libur mencatat 1 hari.
              </p>
            </div>
          )}

          {tutorialStep === 4 && (
            <div className="space-y-1.5 relative z-10">
              <h4 className="font-black text-sm flex items-center gap-1 text-neutral-900">
                <Sparkles size={16} className="text-yellow-500" /> 
                4. Naikkan Gelar Finansial
              </h4>
              <p className="text-xs font-bold text-neutral-700 leading-relaxed">
                Pertahankan rekor harianmu untuk meng-upgrade lencana gelarmu! Naikkan tingkatan dari <strong className="font-extrabold text-neutral-950">Pemula</strong>, <strong className="font-extrabold text-orange-600">Pejuang</strong>, hingga level tertinggi <strong className="font-black text-yellow-600">Master Finansial</strong>!
              </p>
            </div>
          )}

          {/* Stepper controls */}
          <div className="flex justify-between items-center pt-1.5 border-t border-yellow-200/60 relative z-10">
            {/* Dots */}
            <div className="flex gap-1">
              {[1, 2, 3, 4].map(s => (
                <div 
                  key={s} 
                  className={`w-1.5 h-1.5 rounded-full transition-all ${
                    tutorialStep === s ? 'bg-neutral-900 w-3' : 'bg-neutral-300'
                  }`}
                />
              ))}
            </div>

            {/* Buttons */}
            <div className="flex gap-2">
              {tutorialStep > 1 && (
                <button
                  onClick={() => setTutorialStep(prev => prev ? prev - 1 : null)}
                  className="px-2.5 py-1 text-[10px] font-black bg-white hover:bg-neutral-100 rounded border border-neutral-300 cursor-pointer"
                >
                  Kembali
                </button>
              )}
              <button
                onClick={() => {
                  if (tutorialStep < 4) {
                    setTutorialStep(prev => prev ? prev + 1 : null);
                  } else {
                    setTutorialStep(null);
                  }
                }}
                className="px-3 py-1.5 text-[10px] font-black bg-neutral-900 hover:bg-neutral-850 text-white rounded cursor-pointer neo-shadow-xs"
              >
                {tutorialStep === 4 ? 'Selesai' : 'Lanjut'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3.5. Daily Confirmation Status Card */}
      {(() => {
        const todayStr = getTodayLocalDateStr();
        const todayHasActivity = transactions.some(t => t.date === todayStr);

        return (
          <div className={`p-4 neo-border rounded-[var(--radius-md)] neo-shadow-sm flex items-center justify-between gap-3 transition-all ${
            todayHasActivity ? 'bg-emerald-50 border-emerald-300' : 'bg-amber-50 border-amber-300'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-full neo-border flex items-center justify-center ${
                todayHasActivity ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-500 animate-pulse'
              }`}>
                {todayHasActivity ? <CheckCircle size={20} /> : <Flame size={20} />}
              </div>
              <div className="flex-1">
                <h4 className="text-xs font-black text-neutral-800">
                  {todayHasActivity ? 'Aktivitas Hari Ini Tercatat!' : 'Belum Ada Catatan Hari Ini'}
                </h4>
                <p className="text-[10px] text-neutral-500 font-bold leading-tight mt-0.5">
                  {todayHasActivity 
                    ? 'Luar biasa! Rekor streak kamu aman untuk hari ini.'
                    : 'Catat belanjaan/pemasukan, atau klik tombol untuk absen Rp 0 agar streak aman.'
                  }
                </p>
              </div>
            </div>
            {!todayHasActivity && onAddTransaction && (
              <button
                onClick={async () => {
                  try {
                    await onAddTransaction({
                      type: 'income',
                      amount: 0,
                      category: 'Aktivitas Harian',
                      note: 'Check-in Harian (Rp 0)',
                      date: todayStr,
                      createdAt: Date.now()
                    });
                  } catch (err) {
                    console.error(err);
                  }
                }}
                className="neo-btn bg-amber-400 hover:bg-amber-500 text-[10px] font-black px-3 py-2 shrink-0 cursor-pointer text-neutral-900"
              >
                Tandai Sudah Dicatat
              </button>
            )}
          </div>
        );
      })()}

      {/* 4. Ringkasan Bulanan (Stacked List for Elegant Mobile Display) */}
      <div id="metrics-grid" className="space-y-3">
        {/* Pemasukan */}
        <div className="bg-[var(--color-surface)] p-4 neo-border rounded-[var(--radius-md)] neo-shadow-sm flex justify-between items-center hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 border-2 border-neutral-900 flex items-center justify-center">
              <span className="w-3 h-3 rounded-full bg-[var(--color-income)] animate-pulse" />
            </div>
            <div>
              <span className="text-[9px] font-extrabold text-neutral-400 uppercase tracking-wider block">Pemasukan Bulan Ini</span>
              <span className="text-xs font-extrabold text-neutral-700">Total Uang Masuk</span>
            </div>
          </div>
          <span className="text-md font-black font-mono text-emerald-600">
            {formatRupiah(income)}
          </span>
        </div>

        {/* Belanja */}
        <div className="bg-[var(--color-surface)] p-4 neo-border rounded-[var(--radius-md)] neo-shadow-sm flex justify-between items-center hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-rose-50 border-2 border-neutral-900 flex items-center justify-center">
              <span className="w-3 h-3 rounded-full bg-[var(--color-expense)]" />
            </div>
            <div>
              <span className="text-[9px] font-extrabold text-neutral-400 uppercase tracking-wider block">Pengeluaran Belanja</span>
              <span className="text-xs font-extrabold text-neutral-700">Total Belanjaan</span>
            </div>
          </div>
          <span className="text-md font-black font-mono text-rose-500">
            {formatRupiah(expense)}
          </span>
        </div>

        {/* Nabung */}
        <div className="bg-[var(--color-surface)] p-4 neo-border rounded-[var(--radius-md)] neo-shadow-sm flex justify-between items-center hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 border-2 border-neutral-900 flex items-center justify-center">
              <span className="w-3 h-3 rounded-full bg-[var(--color-saving)]" />
            </div>
            <div>
              <span className="text-[9px] font-extrabold text-neutral-400 uppercase tracking-wider block">Tabungan</span>
              <span className="text-xs font-extrabold text-neutral-700">Total Nabung</span>
            </div>
          </div>
          <span className="text-md font-black font-mono text-blue-500">
            {formatRupiah(saving)}
          </span>
        </div>
      </div>

      {/* 5. Quick Actions (Enlarged with high-contrast vertical layouts for easy tapping) */}
      <div id="quick-actions" className="grid grid-cols-3 gap-3">
        <button 
          onClick={() => onOpenAddModal('expense')} 
          className="neo-btn bg-rose-100 hover:bg-rose-200 py-4 px-2 flex flex-col items-center justify-center gap-2 h-20 text-center"
        >
          <ShoppingBag size={20} className="text-rose-500" />
          <span className="text-xs font-black tracking-tight">Belanja</span>
        </button>
        <button 
          onClick={() => onOpenAddModal('income')} 
          className="neo-btn bg-emerald-100 hover:bg-emerald-200 py-4 px-2 flex flex-col items-center justify-center gap-2 h-20 text-center"
        >
          <Coins size={20} className="text-emerald-500" />
          <span className="text-xs font-black tracking-tight">Masuk</span>
        </button>
        <button 
          onClick={() => onOpenAddModal('saving')} 
          className="neo-btn bg-blue-100 hover:bg-blue-200 py-4 px-2 flex flex-col items-center justify-center gap-2 h-20 text-center"
        >
          <Bookmark size={20} className="text-blue-500" />
          <span className="text-xs font-black tracking-tight">Nabung</span>
        </button>
      </div>

      {/* 6. Heatmap Aktivitas Transaksi */}
      <div id="activity-heatmap" className="bg-[var(--color-surface)] p-3.5 neo-border rounded-[var(--radius-md)] neo-shadow-sm">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-extrabold uppercase tracking-widest text-neutral-500">Heatmap Transaksi (35 Hari Terakhir)</span>
          <span className="text-[10px] font-mono text-neutral-400">skala aktivitas</span>
        </div>
        
        {/* Contribution Graph */}
        <div className="flex items-center justify-between gap-1 overflow-x-auto pb-1">
          <div className="grid grid-cols-7 gap-1.5 mx-auto">
            {heatmapCells.map((cell, idx) => {
              let colorClass = 'bg-neutral-100';
              if (cell.intensity === 1) colorClass = 'bg-orange-100 border-orange-250';
              else if (cell.intensity === 2) colorClass = 'bg-orange-200 border-orange-300';
              else if (cell.intensity === 3) colorClass = 'bg-orange-450 border-orange-500';
              else if (cell.intensity === 4) colorClass = 'bg-orange-600 border-orange-700';

              return (
                <div 
                  key={idx}
                  className={`w-6 h-6 rounded-md border heatmap-cell flex items-center justify-center cursor-pointer select-none ${colorClass}`}
                  title={`${cell.date}: ${cell.count} transaksi (${formatRupiah(cell.amount)})`}
                >
                  <span className="text-[8px] font-bold text-neutral-800 font-mono">
                    {cell.count > 0 ? cell.count : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex justify-between items-center mt-2.5 text-[9px] font-bold text-neutral-400 px-1">
          <span>← 35 hari lalu</span>
          <div className="flex items-center gap-1">
            <span>Kurang</span>
            <div className="w-2.5 h-2.5 rounded bg-neutral-100 border"></div>
            <div className="w-2.5 h-2.5 rounded bg-orange-100 border"></div>
            <div className="w-2.5 h-2.5 rounded bg-orange-200 border"></div>
            <div className="w-2.5 h-2.5 rounded bg-orange-450 border"></div>
            <div className="w-2.5 h-2.5 rounded bg-orange-600 border"></div>
            <span>Lebih</span>
          </div>
          <span>Hari ini</span>
        </div>
      </div>

      {/* 7. Target/Goal Nabung (Refactored to Touch Carousel with Bottom-Right Percentage & Large Image Previews) */}
      <div id="savings-goals" className="bg-[var(--color-surface)] p-4.5 neo-border rounded-[var(--radius-md)] neo-shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-extrabold uppercase tracking-widest text-neutral-500 flex items-center gap-1">
            <Target size={14} className="text-blue-500" /> Target Impian Nabung
          </span>
          <span className="text-[10px] font-mono text-neutral-400">geser kartu target</span>
        </div>

        {goals.length === 0 ? (
          <p className="text-xs text-neutral-400 text-center py-2 font-bold">Belum ada target impian yang dibuat.</p>
        ) : (
          <div className="space-y-3">
            {/* Horizontal touch slide/carousel container */}
            <div className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth gap-4 pb-2 scrollbar-none">
              {goals.map(goal => {
                const percent = Math.min(Math.round((goal.currentAmount / goal.targetAmount) * 100), 100);
                return (
                  <div 
                    key={goal.id} 
                    className="w-full flex-shrink-0 snap-center bg-white p-3.5 border-2 border-neutral-900 rounded-lg neo-shadow-sm flex gap-3 relative"
                  >
                    {goal.photo && (
                      <div className="w-16 h-16 rounded-lg border-2 border-neutral-900 overflow-hidden shrink-0 neo-shadow-sm bg-neutral-100">
                        <img src={goal.photo} alt={goal.title} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="flex-1 flex flex-col justify-between min-w-0">
                      <div>
                        <h4 className="font-extrabold text-sm text-neutral-800 truncate">{goal.title}</h4>
                        <p className="text-[10px] font-mono font-bold text-neutral-500 mt-0.5">
                          {formatRupiah(goal.currentAmount)} / {formatRupiah(goal.targetAmount)}
                        </p>
                      </div>

                      <div className="space-y-1.5 mt-2">
                        {/* Progress Bar Container */}
                        <div className="w-full h-3.5 bg-neutral-200 neo-border rounded-full overflow-hidden relative">
                          <div 
                            className="h-full relative transition-all duration-500 bg-[var(--color-saving)]"
                            style={{ 
                              width: `${percent}%`,
                              backgroundImage: percent === 100 ? 'repeating-linear-gradient(45deg, rgba(255,255,255,0.15) 0px, rgba(255,255,255,0.15) 10px, transparent 10px, transparent 20px)' : undefined
                            }}
                          />
                        </div>
                        {/* Percentage and category cleanly on the bottom right/left */}
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] font-bold text-neutral-400">Target Impian</span>
                          <span className="font-black text-xs text-neutral-800">
                            {percent}% Terpenuhi
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Dynamic indicator dots underneath the carousel */}
            {goals.length > 1 && (
              <div className="flex justify-center gap-1.5 pt-0.5">
                {goals.map((_, idx) => (
                  <span 
                    key={idx} 
                    className="w-2 h-2 rounded-full bg-neutral-300 border border-neutral-400"
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 8. List Transaksi Terbaru */}
      <div id="recent-transactions" className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-xs font-extrabold uppercase tracking-widest text-neutral-500">Transaksi Terbaru</span>
          <span className="text-[10px] text-neutral-400 font-bold">klik sampah untuk hapus</span>
        </div>

        {transactions.length === 0 ? (
          <div className="bg-[var(--color-surface)] p-8 text-center neo-border rounded-[var(--radius-md)] neo-shadow-sm">
            <p className="text-sm font-bold text-neutral-400">Belum ada transaksi diinput. Mulai catat yuk!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.slice(0, 3).map(tx => {
              const isExpense = tx.type === 'expense';
              const isSaving = tx.type === 'saving';

              return (
                <div 
                  key={tx.id} 
                  className="bg-[var(--color-surface)] p-3 neo-border rounded-[var(--radius-md)] neo-shadow-sm flex justify-between items-center group hover:border-[var(--color-accent)]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-md bg-neutral-100 neo-border flex items-center justify-center shadow-sm text-neutral-700 overflow-hidden shrink-0">
                      {tx.photo ? (
                        <img src={tx.photo} alt={tx.category} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <CategoryIcon category={tx.category} size={16} />
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold leading-snug">{tx.note || tx.category}</h4>
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] font-mono text-neutral-400 font-bold">
                          {tx.category} • {parseLocalDate(tx.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-black font-mono ${
                      isExpense ? 'text-rose-500' :
                      isSaving ? 'text-blue-500' :
                      'text-emerald-500'
                    }`}>
                      {isExpense ? '-' : ''}{formatRupiah(tx.amount)}
                    </span>
                    <button 
                      onClick={() => tx.id !== undefined && onDeleteTransaction(tx.id)}
                      className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors neo-border border-transparent hover:border-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* STREAK CALENDAR MODAL DETAIL */}
      {showStreakModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-[var(--color-surface)] w-full max-w-sm p-5 neo-border rounded-[var(--radius-lg)] neo-shadow-lg space-y-4 relative">
            <button 
              onClick={() => setShowStreakModal(false)}
              className="absolute right-4 top-4 w-7 h-7 neo-border bg-neutral-100 rounded-full flex items-center justify-center font-bold text-xs hover:bg-[var(--color-accent)] active:translate-x-[1px]"
            >
              ✕
            </button>
            
            <div className="text-center space-y-2">
              <div className="inline-flex p-3 bg-orange-100 rounded-full neo-border">
                <Flame size={32} className="text-orange-500 fill-orange-500 animate-flame" />
              </div>
              <h3 className="text-lg font-black">{streakInfo.currentStreak} Hari Beruntun!</h3>
              <p className="text-xs text-neutral-500 font-medium px-4">
                Pertahankan rentetan pencatatan transaksi agar kamu semakin disiplin mengatur anggaran.
              </p>
            </div>

            {/* Streak Level and stats */}
            <div className="grid grid-cols-2 gap-2 bg-neutral-50 p-2.5 neo-border rounded-md">
              <div className="text-center border-r border-neutral-300">
                <span className="text-[10px] font-extrabold text-neutral-400 block uppercase">Level Streak</span>
                <span className="font-extrabold text-sm">{streakInfo.milestoneTier}</span>
              </div>
              <div className="text-center">
                <span className="text-[10px] font-extrabold text-neutral-400 block uppercase">Streak Freeze</span>
                <span className="font-extrabold text-sm flex items-center justify-center gap-1">
                  <Snowflake size={12} className="text-sky-500" /> {streakInfo.freezeCount} Sisa
                </span>
              </div>
            </div>

            {/* Monthly Calendar View */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-xs font-bold mb-1.5">
                <div className="flex items-center gap-1">
                  {hasPreviousMonthData && (
                    <button
                      onClick={handlePrevStreakMonth}
                      className="p-1 neo-border bg-white hover:bg-yellow-50 rounded cursor-pointer text-neutral-900"
                      title="Bulan Sebelumnya"
                    >
                      <ChevronLeft size={13} />
                    </button>
                  )}
                  <span>Catatan Streak</span>
                </div>

                <div className="flex items-center gap-1">
                  <span className="font-mono text-[10px] text-neutral-900 font-black bg-yellow-100 px-2 py-0.5 rounded neo-border">
                    {new Date(streakYear, streakMonth, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                  </span>
                  {hasNextMonthData && (
                    <button
                      onClick={handleNextStreakMonth}
                      className="p-1 neo-border bg-white hover:bg-yellow-50 rounded cursor-pointer text-neutral-900"
                      title="Bulan Berikutnya"
                    >
                      <ChevronRight size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 text-center text-[10px] font-black text-neutral-400 mb-1">
                <span>Sn</span><span>Sl</span><span>Rb</span><span>Km</span><span>Jm</span><span>Sb</span><span>Mg</span>
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {streakCalendarDays.map((day, idx) => {
                  if (!day) return <div key={`empty-${idx}`} className="h-7 w-7"></div>;
                  
                  const { status } = getDayStatus(day);
                  const isToday = day.toDateString() === new Date().toDateString();

                  let cellStyle = 'bg-neutral-100 text-neutral-400';
                  if (status === 'active') {
                    cellStyle = 'bg-[var(--color-income)] text-neutral-900 neo-border neo-shadow-sm font-bold scale-105';
                  } else if (status === 'frozen') {
                    cellStyle = 'bg-sky-200 text-sky-800 neo-border neo-shadow-sm scale-105';
                  } else if (isToday) {
                    cellStyle = 'border-2 border-dashed border-[var(--color-accent)] text-neutral-900 font-bold';
                  }

                  return (
                    <div 
                      key={day.getDate()} 
                      className={`h-7 w-7 rounded flex flex-col items-center justify-center text-xs font-mono relative cursor-help ${cellStyle}`}
                      title={`${day.toLocaleDateString('id-ID')} ${status === 'active' ? '(Aktif)' : status === 'frozen' ? '(Streak Freeze digunakan)' : '(Tanpa Transaksi)'}`}
                    >
                      <span>{day.getDate()}</span>
                      {status === 'active' && <span className="absolute w-1 h-1 rounded-full bg-orange-500 bottom-0.5"></span>}
                      {status === 'frozen' && <span className="absolute w-1 h-1 rounded-full bg-sky-500 bottom-0.5"></span>}
                    </div>
                  );
                })}
              </div>
            </div>

            <button 
              onClick={() => setShowStreakModal(false)}
              className="neo-btn neo-btn-accent w-full py-2"
            >
              Lanjutkan Berjuang!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
