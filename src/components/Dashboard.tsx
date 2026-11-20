import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Transaction, StreakDay, AppSettings, Goal, Wallet } from '../types';
import { getWallets } from '../db/indexedDB';
import { formatRupiah, getMonthlySummary, calculateOverallBalance, predictBrokeDate, getHeatmapData, getTodayLocalDateStr, parseLocalDate, calculateWalletBalances } from '../utils/financeHelpers';
import { Flame, Snowflake, Sparkles, TrendingUp, TrendingDown, Target, Trash2, ChevronRight, ChevronLeft, Calendar, AlertTriangle, CheckCircle, User, ShoppingBag, Coins, Bookmark, Wallet as WalletIcon, ArrowDownLeft, ArrowUpRight, PiggyBank } from 'lucide-react';
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
  }, [transactions]);

  // Memoized high-performance calculations
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
      { opacity: 0, y: -8 },
      { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' }
    );
    gsap.fromTo('#balance-card, #streak-card, #metrics-grid, #quick-actions, #activity-heatmap, #savings-goals, #recent-transactions',
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, duration: 0.45, stagger: 0.06, ease: 'power2.out', delay: 0.05 }
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

  const hasPreviousMonthData = useMemo(() => {
    const selectedFirstDay = new Date(streakYear, streakMonth, 1);
    const earliestFirstDay = new Date(earliestDataDate.getFullYear(), earliestDataDate.getMonth(), 1);
    return selectedFirstDay > earliestFirstDay;
  }, [streakYear, streakMonth, earliestDataDate]);

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

  const getDayStatus = useCallback((d: Date | null) => {
    if (!d) return { status: 'empty' };
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const dayVal = String(d.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${dayVal}`;
    
    const hasTx = transactions.some(t => t.date === dateStr);
    const rec = streakDays.find(s => s.date === dateStr);
    
    if (hasTx) {
      return { status: 'active' };
    } else if (rec && !rec.hasActivity && rec.streakCount > 0) {
      return { status: 'frozen' };
    }
    
    return { status: 'none' };
  }, [transactions, streakDays]);

  const getHealthColor = useCallback(() => {
    if (brokePrediction.status === 'danger') return 'bg-[#C0504D]';
    if (brokePrediction.status === 'warning') return 'bg-[#C98A2B]';
    return 'bg-[#2E7D5B]';
  }, [brokePrediction.status]);

  return (
    <div className="space-y-4 px-1 py-1 pb-6">
      {/* 1. Header Ringkas */}
      <div id="dashboard-header" className="flex justify-between items-center bg-white p-3.5 border border-[var(--color-border)] rounded-2xl shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-[var(--color-primary-light)] border border-[var(--color-border)] flex items-center justify-center overflow-hidden shrink-0">
            {profilePhoto ? (
              <img src={profilePhoto} alt="Profil" className="w-full h-full object-cover" />
            ) : (
              <User size={20} className="text-[var(--color-primary)]" />
            )}
          </div>
          <div>
            <h2 className="text-sm font-bold text-[var(--color-text-primary)] tracking-tight">Halo, {userName}</h2>
            <p className="text-[11px] text-[var(--color-text-secondary)] font-medium">
              {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {streakInfo.currentStreak > 0 ? (
            <div 
              onClick={() => setShowStreakModal(true)}
              className="flex items-center gap-1.5 bg-[var(--color-income-light)] text-[var(--color-income)] border border-[var(--color-income-border)] font-semibold text-xs px-3 py-1.5 rounded-full cursor-pointer select-none hover:bg-emerald-100 transition-colors"
            >
              <Flame size={14} className="animate-flame fill-orange-500 text-orange-500" />
              <span>{streakInfo.currentStreak} Hari</span>
            </div>
          ) : (
            <div 
              onClick={() => setShowStreakModal(true)}
              className="flex items-center gap-1.5 bg-[var(--color-bg)] text-[var(--color-text-secondary)] border border-[var(--color-border)] font-medium text-xs px-3 py-1.5 rounded-full cursor-pointer select-none hover:bg-neutral-100 transition-colors"
            >
              <Flame size={14} className="text-neutral-400" />
              <span>Mulai Streak</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Kartu Saldo Utama (Hero Card - Premium Solid Deep Teal) */}
      <div id="balance-card" className="bg-[#1A434E] text-white p-5 rounded-2xl shadow-md flex flex-col justify-between relative overflow-hidden">
        <div className="flex justify-between items-start">
          <div>
            <span className="text-[11px] font-medium text-teal-100/80 uppercase tracking-wider block">Sisa Saldo Tersedia</span>
            <h1 className="text-3xl font-extrabold font-mono tracking-tight mt-1 text-white">
              {formatRupiah(overallBalance)}
            </h1>
          </div>
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 border border-white/15">
            <TrendingUp className="text-teal-200" size={20} />
          </div>
        </div>

        {/* Health bar indicator */}
        <div className="mt-5 pt-3 border-t border-white/15 space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-teal-100/90 font-medium">
              Estimasi Tanggal Bokek:
            </span>
            <span className={`px-2 py-0.5 rounded-md font-mono text-xs font-semibold ${
              brokePrediction.status === 'danger' ? 'bg-[#C0504D] text-white' : 
              brokePrediction.status === 'warning' ? 'bg-[#C98A2B] text-white' : 'bg-[#2E7D5B] text-white'
            }`}>
              {brokePrediction.dateStr}
            </span>
          </div>

          <div className="w-full h-2.5 bg-black/25 rounded-full overflow-hidden">
            <div 
              className={`h-full ${getHealthColor()} transition-all duration-500 rounded-full`}
              style={{ 
                width: brokePrediction.daysRemaining === Infinity ? '100%' : `${Math.min(Math.max((brokePrediction.daysRemaining / 30) * 100, 8), 100)}%`
              }}
            />
          </div>
          {brokePrediction.daysRemaining !== Infinity && (
            <p className="text-[10px] font-mono text-teal-200/80 text-right">
              {brokePrediction.daysRemaining <= 0 ? 'Saldo diprediksi habis hari ini!' : `Bertahan ± ${brokePrediction.daysRemaining} hari lagi`}
            </p>
          )}
        </div>
      </div>

      {/* 2.5 Kartu Daftar Dompet (Wallet Carousel) */}
      {wallets.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-bold uppercase text-[var(--color-text-secondary)] tracking-wider">Dompet & Rekening</span>
            <span className="text-[11px] text-[var(--color-text-muted)] font-medium">{wallets.length} Akun</span>
          </div>
          <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none">
            {wallets.map(w => (
              <div key={w.id} className="min-w-[145px] bg-white p-3.5 border border-[var(--color-border)] rounded-xl shadow-xs flex flex-col gap-1.5 flex-shrink-0 hover:border-[var(--color-border-hover)] transition-colors">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[var(--color-primary-light)] flex items-center justify-center">
                    <WalletIcon size={14} className="text-[var(--color-primary)]" />
                  </div>
                  <span className="text-xs font-bold text-[var(--color-text-primary)] truncate">{w.name}</span>
                </div>
                <span className="text-sm font-bold font-mono text-[var(--color-text-primary)] mt-0.5">
                  {formatRupiah(walletBalances[w.id] || 0)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Kartu Streak (Clean Modern Tracker) */}
      <div 
        id="streak-card" 
        onClick={() => setShowStreakModal(true)}
        className={`bg-white p-4.5 border border-[var(--color-border)] rounded-2xl shadow-xs cursor-pointer select-none hover:border-[var(--color-border-hover)] hover:shadow-sm relative overflow-hidden transition-all ${
          tutorialStep !== null ? 'ring-2 ring-[var(--color-warning)]' : ''
        }`}
      >
        <div className="flex justify-between items-start">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <Flame size={18} className="text-orange-500 fill-orange-500 animate-flame" />
              <h3 className="font-bold text-sm text-[var(--color-text-primary)]">
                {streakInfo.currentStreak} Hari Beruntun
              </h3>
            </div>
            <p className="text-xs text-[var(--color-text-secondary)]">
              {streakInfo.currentStreak > 0 
                ? 'Konsisten terus mencatat transaksi harianmu.' 
                : 'Mulai streak disiplin keuanganmu hari ini!'}
            </p>
          </div>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              setTutorialStep(1);
            }}
            className="px-2.5 py-1 bg-[var(--color-bg)] hover:bg-neutral-200/70 text-[var(--color-text-primary)] text-[11px] font-semibold rounded-lg border border-[var(--color-border)] shrink-0 cursor-pointer transition-colors"
          >
            Panduan
          </button>
        </div>

        {/* 7 hari checkpoints (Mon-Sun) */}
        <div className="grid grid-cols-7 gap-1.5 mt-3 pt-3 border-t border-[var(--color-border)]">
          {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((day, idx) => {
            const isActive = streakInfo.weeklyProgress[idx];
            return (
              <div key={day} className="flex flex-col items-center gap-1">
                <span className="text-[10px] font-medium text-[var(--color-text-muted)]">{day}</span>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                  isActive 
                    ? 'bg-[var(--color-income)] text-white shadow-xs' 
                    : 'bg-[var(--color-bg)] text-[var(--color-text-muted)] border border-[var(--color-border)]'
                }`}>
                  {isActive ? '✓' : '•'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Interactive Onboarding Tutorial Bubble for Streak System */}
      {tutorialStep !== null && (
        <div className="bg-[#FEF8EE] border border-[#F8E5BF] p-4 rounded-xl shadow-xs space-y-3 animate-fade-in text-[var(--color-text-primary)]">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-warning)] bg-amber-100/70 px-2 py-0.5 rounded">
              Panduan Streak • Langkah {tutorialStep} dari 4
            </span>
            <button 
              onClick={() => setTutorialStep(null)}
              className="text-xs font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-pointer"
            >
              ✕ Lewati
            </button>
          </div>

          {tutorialStep === 1 && (
            <div className="space-y-1">
              <h4 className="font-bold text-sm flex items-center gap-1.5 text-[var(--color-text-primary)]">
                <Flame size={16} className="text-orange-500 fill-orange-500" /> 
                1. Catat Keuangan Setiap Hari
              </h4>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                Minimal satu transaksi harian (Belanja, Masuk, atau Nabung) sebelum 23:59 akan menjaga api streak tetap menyala.
              </p>
            </div>
          )}

          {tutorialStep === 2 && (
            <div className="space-y-1">
              <h4 className="font-bold text-sm flex items-center gap-1.5 text-[var(--color-text-primary)]">
                <CheckCircle size={16} className="text-[#2E7D5B]" /> 
                2. Checkpoint Mingguan
              </h4>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                Tanda centang hijau menunjukkan hari aktif pencatatan. Isi seluruh hari dalam seminggu untuk rekor kedisiplinan penuh!
              </p>
            </div>
          )}

          {tutorialStep === 3 && (
            <div className="space-y-1">
              <h4 className="font-bold text-sm flex items-center gap-1.5 text-[var(--color-text-primary)]">
                <Snowflake size={16} className="text-[#285B63]" /> 
                3. Perlindungan Streak Freeze
              </h4>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                Streak Freeze otomatis melindungi rentetan harianmu agar tidak hangus bila suatu hari kamu berhalangan mencatat.
              </p>
            </div>
          )}

          {tutorialStep === 4 && (
            <div className="space-y-1">
              <h4 className="font-bold text-sm flex items-center gap-1.5 text-[var(--color-text-primary)]">
                <Sparkles size={16} className="text-[var(--color-warning)]" /> 
                4. Naikkan Gelar Finansial
              </h4>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                Tingkatkan terus rekor streak dari Pemula hingga menjadi Master Finansial sejati!
              </p>
            </div>
          )}

          <div className="flex justify-between items-center pt-1 border-t border-amber-200/60">
            <div className="flex gap-1">
              {[1, 2, 3, 4].map(s => (
                <div 
                  key={s} 
                  className={`h-1.5 rounded-full transition-all ${
                    tutorialStep === s ? 'bg-[var(--color-primary)] w-4' : 'bg-neutral-300 w-1.5'
                  }`}
                />
              ))}
            </div>

            <div className="flex gap-2">
              {tutorialStep > 1 && (
                <button
                  onClick={() => setTutorialStep(prev => prev ? prev - 1 : null)}
                  className="px-2.5 py-1 text-[11px] font-semibold bg-white hover:bg-neutral-100 rounded-lg border border-[var(--color-border)] cursor-pointer"
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
                className="px-3 py-1 text-[11px] font-semibold bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-lg cursor-pointer"
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
          <div className={`p-3.5 border rounded-2xl flex items-center justify-between gap-3 transition-all ${
            todayHasActivity 
              ? 'bg-[var(--color-income-light)] border-[var(--color-income-border)]' 
              : 'bg-[var(--color-warning-light)] border-[var(--color-warning-border)]'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                todayHasActivity ? 'bg-white text-[var(--color-income)]' : 'bg-white text-[var(--color-warning)]'
              }`}>
                {todayHasActivity ? <CheckCircle size={18} /> : <Flame size={18} />}
              </div>
              <div>
                <h4 className="text-xs font-bold text-[var(--color-text-primary)]">
                  {todayHasActivity ? 'Aktivitas Hari Ini Tercatat' : 'Belum Ada Catatan Hari Ini'}
                </h4>
                <p className="text-[11px] text-[var(--color-text-secondary)] leading-tight mt-0.5">
                  {todayHasActivity 
                    ? 'Streak aman! Terus pertahankan kedisiplinan keuanganmu.'
                    : 'Catat transaksi sekarang atau tap check-in Rp 0 agar streak aman.'
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
                className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-[11px] font-semibold px-3 py-1.5 rounded-lg shrink-0 cursor-pointer shadow-xs transition-colors"
              >
                Absen Hari Ini
              </button>
            )}
          </div>
        );
      })()}

      {/* 4. Quick Actions (Modern 3-Column E-Wallet Action Row) */}
      <div id="quick-actions" className="grid grid-cols-3 gap-2.5">
        <button 
          onClick={() => onOpenAddModal('expense')} 
          className="bg-white border border-[var(--color-border)] hover:border-[var(--color-border-hover)] p-3 rounded-2xl shadow-xs flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all hover:shadow-sm active:scale-[0.98]"
        >
          <div className="w-10 h-10 rounded-xl bg-[var(--color-danger-light)] text-[var(--color-danger)] flex items-center justify-center">
            <ArrowUpRight size={19} strokeWidth={2.5} />
          </div>
          <span className="text-xs font-bold text-[var(--color-text-primary)]">Belanja</span>
        </button>
        <button 
          onClick={() => onOpenAddModal('income')} 
          className="bg-white border border-[var(--color-border)] hover:border-[var(--color-border-hover)] p-3 rounded-2xl shadow-xs flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all hover:shadow-sm active:scale-[0.98]"
        >
          <div className="w-10 h-10 rounded-xl bg-[var(--color-income-light)] text-[var(--color-income)] flex items-center justify-center">
            <ArrowDownLeft size={19} strokeWidth={2.5} />
          </div>
          <span className="text-xs font-bold text-[var(--color-text-primary)]">Pemasukan</span>
        </button>
        <button 
          onClick={() => onOpenAddModal('saving')} 
          className="bg-white border border-[var(--color-border)] hover:border-[var(--color-border-hover)] p-3 rounded-2xl shadow-xs flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all hover:shadow-sm active:scale-[0.98]"
        >
          <div className="w-10 h-10 rounded-xl bg-[var(--color-saving-light)] text-[var(--color-secondary)] flex items-center justify-center">
            <PiggyBank size={19} strokeWidth={2.5} />
          </div>
          <span className="text-xs font-bold text-[var(--color-text-primary)]">Nabung</span>
        </button>
      </div>

      {/* 5. Ringkasan Bulanan (Clean Metric Cards) */}
      <div id="metrics-grid" className="grid grid-cols-3 gap-2">
        {/* Pemasukan */}
        <div className="bg-white p-3 border border-[var(--color-border)] rounded-xl shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--color-text-secondary)] uppercase">
            <span className="w-2 h-2 rounded-full bg-[var(--color-income)]" />
            <span>Masuk</span>
          </div>
          <span className="text-xs font-bold font-mono text-[var(--color-income)] mt-1 truncate">
            {formatRupiah(income)}
          </span>
        </div>

        {/* Belanja */}
        <div className="bg-white p-3 border border-[var(--color-border)] rounded-xl shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--color-text-secondary)] uppercase">
            <span className="w-2 h-2 rounded-full bg-[var(--color-expense)]" />
            <span>Keluar</span>
          </div>
          <span className="text-xs font-bold font-mono text-[var(--color-expense)] mt-1 truncate">
            {formatRupiah(expense)}
          </span>
        </div>

        {/* Nabung */}
        <div className="bg-white p-3 border border-[var(--color-border)] rounded-xl shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--color-text-secondary)] uppercase">
            <span className="w-2 h-2 rounded-full bg-[var(--color-secondary)]" />
            <span>Nabung</span>
          </div>
          <span className="text-xs font-bold font-mono text-[var(--color-secondary)] mt-1 truncate">
            {formatRupiah(saving)}
          </span>
        </div>
      </div>

      {/* 6. Heatmap Aktivitas Transaksi */}
      <div id="activity-heatmap" className="bg-white p-4 border border-[var(--color-border)] rounded-2xl shadow-xs">
        <div className="flex justify-between items-center mb-2.5">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">Aktivitas 35 Hari Terakhir</span>
          <span className="text-[10px] font-mono text-[var(--color-text-muted)]">frekuensi</span>
        </div>
        
        {/* Contribution Graph */}
        <div className="flex items-center justify-between gap-1 overflow-x-auto pb-1">
          <div className="grid grid-cols-7 gap-1.5 mx-auto">
            {heatmapCells.map((cell, idx) => {
              let colorClass = 'bg-[var(--color-bg)] border border-[var(--color-border)]';
              if (cell.intensity === 1) colorClass = 'bg-[#C0D8D5] text-[var(--color-primary)]';
              else if (cell.intensity === 2) colorClass = 'bg-[#6B9A91] text-white';
              else if (cell.intensity === 3) colorClass = 'bg-[#285B63] text-white';
              else if (cell.intensity === 4) colorClass = 'bg-[#1A434E] text-white';

              return (
                <div 
                  key={idx}
                  className={`w-6 h-6 rounded-md flex items-center justify-center cursor-pointer select-none transition-transform hover:scale-115 ${colorClass}`}
                  title={`${cell.date}: ${cell.count} transaksi (${formatRupiah(cell.amount)})`}
                >
                  <span className="text-[8px] font-bold font-mono">
                    {cell.count > 0 ? cell.count : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex justify-between items-center mt-2.5 text-[10px] font-medium text-[var(--color-text-muted)] px-1">
          <span>← 35 hari lalu</span>
          <div className="flex items-center gap-1">
            <span>Kurang</span>
            <div className="w-2.5 h-2.5 rounded bg-[var(--color-bg)] border border-[var(--color-border)]"></div>
            <div className="w-2.5 h-2.5 rounded bg-[#C0D8D5]"></div>
            <div className="w-2.5 h-2.5 rounded bg-[#6B9A91]"></div>
            <div className="w-2.5 h-2.5 rounded bg-[#285B63]"></div>
            <div className="w-2.5 h-2.5 rounded bg-[#1A434E]"></div>
            <span>Lebih</span>
          </div>
          <span>Hari ini</span>
        </div>
      </div>

      {/* 7. Target/Goal Nabung Carousel */}
      <div id="savings-goals" className="bg-white p-4 border border-[var(--color-border)] rounded-2xl shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] flex items-center gap-1.5">
            <Target size={14} className="text-[var(--color-secondary)]" /> Target Impian Nabung
          </span>
          <span className="text-[10px] text-[var(--color-text-muted)] font-medium">geser untuk lainnya</span>
        </div>

        {goals.length === 0 ? (
          <p className="text-xs text-[var(--color-text-muted)] text-center py-3 font-medium">Belum ada target impian yang dibuat.</p>
        ) : (
          <div className="space-y-2">
            <div className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth gap-3 pb-1 scrollbar-none">
              {goals.map(goal => {
                const percent = Math.min(Math.round((goal.currentAmount / goal.targetAmount) * 100), 100);
                return (
                  <div 
                    key={goal.id} 
                    className="w-full flex-shrink-0 snap-center bg-[var(--color-bg)] p-3.5 border border-[var(--color-border)] rounded-xl flex gap-3 relative"
                  >
                    {goal.photo && (
                      <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-white border border-[var(--color-border)]">
                        <img src={goal.photo} alt={goal.title} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="flex-1 flex flex-col justify-between min-w-0">
                      <div>
                        <h4 className="font-bold text-xs text-[var(--color-text-primary)] truncate">{goal.title}</h4>
                        <p className="text-[11px] font-mono font-medium text-[var(--color-text-secondary)] mt-0.5">
                          {formatRupiah(goal.currentAmount)} / {formatRupiah(goal.targetAmount)}
                        </p>
                      </div>

                      <div className="space-y-1 mt-2">
                        <div className="w-full h-2 bg-neutral-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full rounded-full transition-all duration-500 bg-[var(--color-secondary)]"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-[var(--color-text-muted)] font-medium">Progress</span>
                          <span className="font-bold text-[var(--color-secondary)]">
                            {percent}% Terpenuhi
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {goals.length > 1 && (
              <div className="flex justify-center gap-1 pt-0.5">
                {goals.map((_, idx) => (
                  <span 
                    key={idx} 
                    className="w-1.5 h-1.5 rounded-full bg-neutral-300"
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 8. List Transaksi Terbaru */}
      <div id="recent-transactions" className="space-y-2.5">
        <div className="flex justify-between items-center px-1">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">Transaksi Terbaru</span>
          <span className="text-[11px] text-[var(--color-text-muted)] font-medium">3 transaksi terakhir</span>
        </div>

        {transactions.length === 0 ? (
          <div className="bg-white p-6 text-center border border-[var(--color-border)] rounded-2xl shadow-xs">
            <p className="text-xs font-medium text-[var(--color-text-muted)]">Belum ada transaksi diinput. Mulai catat yuk!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.slice(0, 3).map(tx => {
              const isExpense = tx.type === 'expense';
              const isSaving = tx.type === 'saving';

              return (
                <div 
                  key={tx.id} 
                  className="bg-white p-3 border border-[var(--color-border)] rounded-xl shadow-xs flex justify-between items-center hover:border-[var(--color-border-hover)] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-primary)] overflow-hidden shrink-0">
                      {tx.photo ? (
                        <img src={tx.photo} alt={tx.category} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <CategoryIcon category={tx.category} size={18} />
                      )}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[var(--color-text-primary)] leading-snug">{tx.note || tx.category}</h4>
                      <p className="text-[11px] text-[var(--color-text-muted)] font-medium">
                        {tx.category} • {parseLocalDate(tx.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold font-mono ${
                      isExpense ? 'text-[var(--color-danger)]' :
                      isSaving ? 'text-[var(--color-secondary)]' :
                      'text-[var(--color-income)]'
                    }`}>
                      {isExpense ? '-' : ''}{formatRupiah(tx.amount)}
                    </span>
                    <button 
                      onClick={() => tx.id !== undefined && onDeleteTransaction(tx.id)}
                      className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-light)] rounded-lg transition-colors cursor-pointer"
                      title="Hapus Transaksi"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white w-full max-w-sm p-5 border border-[var(--color-border)] rounded-2xl shadow-xl space-y-4 relative">
            <button 
              onClick={() => setShowStreakModal(false)}
              className="absolute right-4 top-4 w-7 h-7 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] flex items-center justify-center font-bold text-sm cursor-pointer"
            >
              ✕
            </button>
            
            <div className="text-center space-y-1.5 pt-1">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center">
                <Flame size={28} className="animate-flame fill-orange-500" />
              </div>
              <h3 className="text-base font-bold text-[var(--color-text-primary)]">{streakInfo.currentStreak} Hari Beruntun!</h3>
              <p className="text-xs text-[var(--color-text-secondary)] px-2">
                Pertahankan catatan harianmu agar kedisiplinan keuangan terus terjaga.
              </p>
            </div>

            {/* Streak Level and stats */}
            <div className="grid grid-cols-2 gap-2 bg-[var(--color-bg)] p-3 border border-[var(--color-border)] rounded-xl">
              <div className="text-center border-r border-[var(--color-border)]">
                <span className="text-[10px] font-bold text-[var(--color-text-muted)] block uppercase">Level Streak</span>
                <span className="font-bold text-xs text-[var(--color-text-primary)]">{streakInfo.milestoneTier}</span>
              </div>
              <div className="text-center">
                <span className="text-[10px] font-bold text-[var(--color-text-muted)] block uppercase">Streak Freeze</span>
                <span className="font-bold text-xs text-[var(--color-text-primary)] flex items-center justify-center gap-1">
                  <Snowflake size={12} className="text-[var(--color-secondary)]" /> {streakInfo.freezeCount} Sisa
                </span>
              </div>
            </div>

            {/* Monthly Calendar View */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs font-semibold mb-1">
                <div className="flex items-center gap-1">
                  {hasPreviousMonthData && (
                    <button
                      onClick={handlePrevStreakMonth}
                      className="p-1 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-bg)] cursor-pointer text-[var(--color-text-primary)]"
                      title="Bulan Sebelumnya"
                    >
                      <ChevronLeft size={13} />
                    </button>
                  )}
                  <span className="text-xs font-bold text-[var(--color-text-primary)]">Riwayat Kalender</span>
                </div>

                <div className="flex items-center gap-1">
                  <span className="font-mono text-[11px] text-[var(--color-primary)] font-bold bg-[var(--color-primary-light)] px-2 py-0.5 rounded-md">
                    {new Date(streakYear, streakMonth, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                  </span>
                  {hasNextMonthData && (
                    <button
                      onClick={handleNextStreakMonth}
                      className="p-1 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-bg)] cursor-pointer text-[var(--color-text-primary)]"
                      title="Bulan Berikutnya"
                    >
                      <ChevronRight size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 text-center text-[10px] font-bold text-[var(--color-text-muted)] mb-1">
                <span>Sn</span><span>Sl</span><span>Rb</span><span>Km</span><span>Jm</span><span>Sb</span><span>Mg</span>
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {streakCalendarDays.map((day, idx) => {
                  if (!day) return <div key={`empty-${idx}`} className="h-7 w-7"></div>;
                  
                  const { status } = getDayStatus(day);
                  const isToday = day.toDateString() === new Date().toDateString();

                  let cellStyle = 'bg-[var(--color-bg)] text-[var(--color-text-muted)]';
                  if (status === 'active') {
                    cellStyle = 'bg-[var(--color-income)] text-white font-bold';
                  } else if (status === 'frozen') {
                    cellStyle = 'bg-[var(--color-secondary-light)] text-[var(--color-secondary)] font-bold';
                  } else if (isToday) {
                    cellStyle = 'border border-dashed border-[var(--color-accent)] text-[var(--color-text-primary)] font-bold';
                  }

                  return (
                    <div 
                      key={day.getDate()} 
                      className={`h-7 w-7 rounded-lg flex flex-col items-center justify-center text-xs font-mono relative cursor-help ${cellStyle}`}
                      title={`${day.toLocaleDateString('id-ID')} ${status === 'active' ? '(Aktif)' : status === 'frozen' ? '(Streak Freeze digunakan)' : '(Tanpa Transaksi)'}`}
                    >
                      <span>{day.getDate()}</span>
                      {status === 'active' && <span className="absolute w-1 h-1 rounded-full bg-white bottom-0.5"></span>}
                      {status === 'frozen' && <span className="absolute w-1 h-1 rounded-full bg-[var(--color-secondary)] bottom-0.5"></span>}
                    </div>
                  );
                })}
              </div>
            </div>

            <button 
              onClick={() => setShowStreakModal(false)}
              className="w-full py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-xs"
            >
              Lanjutkan Berjuang
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
