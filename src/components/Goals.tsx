import React, { useState, useEffect, useMemo } from 'react';
import { Goal, GoalLog, Transaction, AppSettings, MonthlyBudget } from '../types';
import { getGoals, saveGoal, deleteGoal, getBudgets, saveBudget, deleteBudget } from '../db/indexedDB';
import { formatRupiah, getTodayLocalDateStr, parseLocalDate } from '../utils/financeHelpers';
import { 
  Plus, 
  Trash2, 
  Camera, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Target, 
  ChevronRight, 
  X, 
  Sparkles, 
  PieChart, 
  Wallet, 
  Edit2, 
  AlertCircle, 
  CheckCircle, 
  Calendar,
  AlertTriangle,
  Info
} from 'lucide-react';
import CategoryIcon from './CategoryIcon';
import gsap from 'gsap';

interface GoalsProps {
  transactions?: Transaction[];
  settings?: AppSettings;
  onGoalUpdated?: () => void;
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export default function Goals({ transactions = [], settings, onGoalUpdated }: GoalsProps) {
  // Navigation Tab State: 'goals' | 'budgeting'
  const [activePageTab, setActivePageTab] = useState<'goals' | 'budgeting'>('goals');

  // Goals State
  const [goals, setGoals] = useState<Goal[]>([]);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [isAddingGoal, setIsAddingGoal] = useState(false);

  // New Goal Form fields
  const [newTitle, setNewTitle] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [newCurrent, setNewCurrent] = useState('0');
  const [newPhoto, setNewPhoto] = useState<string>('');

  // Log Form fields for active goal
  const [logType, setLogType] = useState<'add' | 'subtract'>('add');
  const [logAmount, setLogAmount] = useState('');
  const [logNote, setLogNote] = useState('');
  const [logDate, setLogDate] = useState(getTodayLocalDateStr());

  // Budgeting State
  const [budgets, setBudgets] = useState<MonthlyBudget[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  
  // Budget Form / Modal State
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [budgetCatSelect, setBudgetCatSelect] = useState('Makan');
  const [budgetLimitInput, setBudgetLimitInput] = useState('');

  // Custom Modals State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const [noticeModal, setNoticeModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
  }>({ isOpen: false, title: '', message: '' });

  // Load Initial Data
  useEffect(() => {
    fetchGoals();
    fetchBudgetsData();
  }, []);

  // Trigger GSAP entrance animations on mount or tab change
  useEffect(() => {
    gsap.fromTo('#goals-header',
      { opacity: 0, y: -8 },
      { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' }
    );
  }, [activePageTab, selectedMonth, selectedYear]);

  const fetchGoals = async () => {
    try {
      const dbGoals = await getGoals();
      setGoals(dbGoals);
      if (selectedGoal) {
        const found = dbGoals.find(g => g.id === selectedGoal.id);
        setSelectedGoal(found || null);
      }
    } catch (err) {
      console.error('Gagal mengambil data target:', err);
    }
  };

  const fetchBudgetsData = async () => {
    try {
      const dbBudgets = await getBudgets();
      setBudgets(dbBudgets);
    } catch (err) {
      console.error('Gagal mengambil data budget:', err);
    }
  };

  const expenseCategories = useMemo(() => {
    return settings?.categories?.expense || ['Makan', 'Transport', 'Belanja', 'Hiburan', 'Tagihan', 'Kesehatan', 'Pendidikan', 'Lainnya'];
  }, [settings]);

  const savingCategories = useMemo(() => {
    return settings?.categories?.saving || ['Dana Darurat', 'Investasi', 'Tabungan', 'Liburan'];
  }, [settings]);

  const availableCategories = useMemo(() => {
    const list = Array.from(new Set([...expenseCategories, ...savingCategories]));
    return list.length > 0 ? list : ['Makan', 'Transport', 'Belanja', 'Hiburan', 'Tagihan', 'Kesehatan', 'Pendidikan', 'Lainnya'];
  }, [expenseCategories, savingCategories]);

  const categorySpentMap = useMemo(() => {
    const map: Record<string, number> = {};
    transactions.forEach(t => {
      const tDate = parseLocalDate(t.date);
      if (tDate.getFullYear() === selectedYear && tDate.getMonth() === selectedMonth) {
        if (t.type === 'expense' || t.type === 'saving') {
          map[t.category] = (map[t.category] || 0) + t.amount;
        }
      }
    });
    return map;
  }, [transactions, selectedMonth, selectedYear]);

  const budgetSummary = useMemo(() => {
    let totalTarget = 0;
    let totalSpent = 0;

    budgets.forEach(b => {
      const applies = (b.month === undefined || b.month === selectedMonth) && (b.year === undefined || b.year === selectedYear);
      if (applies) {
        totalTarget += b.targetAmount;
        totalSpent += (categorySpentMap[b.category] || 0);
      }
    });

    const percent = totalTarget > 0 ? Math.round((totalSpent / totalTarget) * 100) : 0;

    return {
      totalTarget,
      totalSpent,
      remaining: totalTarget - totalSpent,
      percent
    };
  }, [budgets, categorySpentMap, selectedMonth, selectedYear]);

  const showNotice = (title: string, message: string) => {
    setNoticeModal({ isOpen: true, title, message });
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmModal({ isOpen: true, title, message, onConfirm });
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>, callback: (base64: string) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        showNotice('Ukuran File Terlalu Besar', 'Maksimum ukuran gambar adalah 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        callback(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newTarget) {
      showNotice('Data Belum Lengkap', 'Judul target impian dan nominal target harus diisi!');
      return;
    }

    const targetVal = parseFloat(newTarget);
    const currentVal = parseFloat(newCurrent) || 0;

    if (isNaN(targetVal) || targetVal <= 0) {
      showNotice('Nominal Tidak Valid', 'Masukkan nominal target yang lebih besar dari Rp 0!');
      return;
    }

    const initialLog: GoalLog[] = [];
    if (currentVal > 0) {
      initialLog.push({
        id: crypto.randomUUID(),
        type: 'add',
        amount: currentVal,
        date: getTodayLocalDateStr(),
        note: 'Dana awal terkumpul'
      });
    }

    const goalItem: Goal = {
      id: crypto.randomUUID(),
      title: newTitle.trim(),
      targetAmount: targetVal,
      currentAmount: currentVal,
      photo: newPhoto || undefined,
      logs: initialLog,
      createdAt: Date.now()
    };

    try {
      await saveGoal(goalItem);
      setNewTitle('');
      setNewTarget('');
      setNewCurrent('0');
      setNewPhoto('');
      setIsAddingGoal(false);
      await fetchGoals();
      if (onGoalUpdated) onGoalUpdated();
    } catch (err) {
      console.error('Gagal menyimpan target baru:', err);
    }
  };

  const handleDeleteGoal = (id: string) => {
    showConfirm(
      'Hapus Target Impian?',
      'Apakah kamu yakin ingin menghapus target impian ini beserta seluruh riwayat tabungannya?',
      async () => {
        try {
          await deleteGoal(id);
          setSelectedGoal(null);
          await fetchGoals();
          if (onGoalUpdated) onGoalUpdated();
        } catch (err) {
          console.error('Gagal menghapus target:', err);
        }
      }
    );
  };

  const handleAddGoalLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGoal || !logAmount || parseFloat(logAmount) <= 0) {
      showNotice('Nominal Tidak Valid', 'Jumlah nominal penambahan / penarikan harus lebih besar dari 0!');
      return;
    }

    const amountVal = parseFloat(logAmount);
    if (isNaN(amountVal) || amountVal <= 0) return;

    let newCurrentAmount = selectedGoal.currentAmount;
    if (logType === 'add') {
      newCurrentAmount += amountVal;
    } else {
      newCurrentAmount = Math.max(0, newCurrentAmount - amountVal);
    }

    const newLog: GoalLog = {
      id: crypto.randomUUID(),
      type: logType,
      amount: amountVal,
      date: logDate,
      note: logNote.trim() || (logType === 'add' ? 'Pengisian dana target' : 'Penarikan dana target')
    };

    const updatedGoal: Goal = {
      ...selectedGoal,
      currentAmount: newCurrentAmount,
      logs: [newLog, ...selectedGoal.logs]
    };

    try {
      await saveGoal(updatedGoal);
      setLogAmount('');
      setLogNote('');
      setLogDate(getTodayLocalDateStr());
      await fetchGoals();
      if (onGoalUpdated) onGoalUpdated();
    } catch (err) {
      console.error('Gagal mencatat mutasi dana target:', err);
    }
  };

  const handleOpenBudgetModal = (budgetToEdit?: MonthlyBudget) => {
    if (availableCategories.length === 0) {
      showNotice('Tidak Ada Kategori', 'Silakan buat kategori pengeluaran terlebih dahulu di halaman Profil!');
      return;
    }

    if (budgetToEdit) {
      setEditingBudgetId(budgetToEdit.id);
      setBudgetCatSelect(availableCategories.includes(budgetToEdit.category) ? budgetToEdit.category : availableCategories[0]);
      setBudgetLimitInput(budgetToEdit.targetAmount.toString());
    } else {
      setEditingBudgetId(null);
      const unbudgeted = availableCategories.find(cat => !budgets.some(b => b.category === cat));
      setBudgetCatSelect(unbudgeted || availableCategories[0]);
      setBudgetLimitInput('');
    }
    setIsBudgetModalOpen(true);
  };

  const handleAddPresetBudget = (catName: string) => {
    const existing = budgets.find(b => b.category.toLowerCase() === catName.toLowerCase());
    if (existing) {
      handleOpenBudgetModal(existing);
    } else {
      setEditingBudgetId(null);
      setBudgetCatSelect(catName);
      setBudgetLimitInput('1000000');
      setIsBudgetModalOpen(true);
    }
  };

  const handleSaveBudgetForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalCategory = budgetCatSelect;
    const limitVal = parseFloat(budgetLimitInput);

    if (!finalCategory) {
      showNotice('Kategori Belum Dipilih', 'Pilih salah satu kategori pengeluaran!');
      return;
    }
    if (isNaN(limitVal) || limitVal <= 0) {
      showNotice('Batas Nominal Tidak Valid', 'Masukkan batas budget bulanan yang lebih besar dari Rp 0!');
      return;
    }

    const budgetItem: MonthlyBudget = {
      id: editingBudgetId || crypto.randomUUID(),
      category: finalCategory,
      targetAmount: limitVal,
      month: selectedMonth,
      year: selectedYear,
      createdAt: Date.now()
    };

    try {
      await saveBudget(budgetItem);
      setIsBudgetModalOpen(false);
      await fetchBudgetsData();
    } catch (err) {
      console.error('Gagal menyimpan budget:', err);
    }
  };

  const handleDeleteBudget = (id: string) => {
    showConfirm(
      'Hapus Alokasi Budget?',
      'Apakah kamu yakin ingin menghapus alokasi budget untuk kategori ini?',
      async () => {
        try {
          await deleteBudget(id);
          await fetchBudgetsData();
        } catch (err) {
          console.error('Gagal menghapus budget:', err);
        }
      }
    );
  };

  const yearsList = useMemo(() => {
    const cur = new Date().getFullYear();
    return [cur - 1, cur, cur + 1];
  }, []);

  return (
    <div className="space-y-4 px-1 py-1">
      {/* 1. Top Navigation Tab Switcher */}
      <div id="goals-header" className="bg-white p-1.5 border border-[var(--color-border)] rounded-2xl shadow-xs">
        <div className="grid grid-cols-2 gap-1.5 bg-[var(--color-bg)] p-1 rounded-xl">
          <button
            onClick={() => {
              setActivePageTab('goals');
              setSelectedGoal(null);
            }}
            className={`py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
              activePageTab === 'goals'
                ? 'bg-[var(--color-primary)] text-white shadow-xs'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            <Target size={15} />
            <span>Target Impian</span>
          </button>
          
          <button
            onClick={() => setActivePageTab('budgeting')}
            className={`py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
              activePageTab === 'budgeting'
                ? 'bg-[var(--color-primary)] text-white shadow-xs'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            <PieChart size={15} />
            <span>Budgeting Bulanan</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* TAB A: TARGET IMPIAN */}
      {/* ======================================================== */}
      {activePageTab === 'goals' && (
        <>
          {!selectedGoal && !isAddingGoal && (
            <div className="bg-white p-4.5 border border-[var(--color-border)] rounded-2xl shadow-xs flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-sm font-bold text-[var(--color-text-primary)] tracking-tight">Rencana Target Impian</h2>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Kumpulkan dana untuk mencapai tujuan finansialmu</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddingGoal(true)}
                className="w-full py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-bold rounded-xl flex justify-center items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
              >
                <Plus size={15} /> Tambah Target Baru
              </button>
            </div>
          )}

          {/* Adding Form */}
          {isAddingGoal && (
            <div className="bg-white p-5 border border-[var(--color-border)] rounded-2xl shadow-sm space-y-4 animate-fade-in">
              <div className="flex justify-between items-center border-b border-[var(--color-border)] pb-3">
                <span className="text-xs font-bold uppercase text-[var(--color-text-primary)] flex items-center gap-1.5">
                  <Target size={15} className="text-[var(--color-secondary)]" /> Buat Target Impian Baru
                </span>
                <button
                  onClick={() => setIsAddingGoal(false)}
                  className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] rounded-lg cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateGoal} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider block">Foto Target (Opsional)</label>
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] flex items-center justify-center overflow-hidden shrink-0">
                      {newPhoto ? (
                        <img src={newPhoto} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <Camera size={22} className="text-[var(--color-text-muted)]" />
                      )}
                    </div>
                    <div className="flex-1">
                      <input
                        type="file"
                        id="goal-photo-input"
                        accept="image/*"
                        onChange={(e) => handlePhotoUpload(e, setNewPhoto)}
                        className="hidden"
                      />
                      <label
                        htmlFor="goal-photo-input"
                        className="px-3 py-1.5 bg-white hover:bg-neutral-50 border border-[var(--color-border)] rounded-lg text-xs font-semibold text-[var(--color-text-primary)] cursor-pointer inline-block transition-colors"
                      >
                        Unggah Gambar
                      </label>
                      {newPhoto && (
                        <button
                          type="button"
                          onClick={() => setNewPhoto('')}
                          className="text-[var(--color-danger)] font-medium text-xs ml-3 hover:underline cursor-pointer"
                        >
                          Hapus
                        </button>
                      )}
                      <p className="text-[11px] text-[var(--color-text-muted)] mt-1">Gunakan foto impianmu agar makin termotivasi</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Nama Target / Impian</label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    className="w-full text-xs p-2.5 bg-white border border-[var(--color-border)] rounded-xl font-medium text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
                    placeholder="cth: Beli Laptop Baru, Liburan ke Bali"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Nominal Target (Rp)</label>
                    <input
                      type="number"
                      value={newTarget}
                      onChange={e => setNewTarget(e.target.value)}
                      className="w-full text-xs p-2.5 bg-white border border-[var(--color-border)] rounded-xl font-mono font-medium text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
                      placeholder="cth: 15000000"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Dana Terkumpul Awal</label>
                    <input
                      type="number"
                      value={newCurrent}
                      onChange={e => setNewCurrent(e.target.value)}
                      className="w-full text-xs p-2.5 bg-white border border-[var(--color-border)] rounded-xl font-mono font-medium text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
                      placeholder="cth: 1000000"
                    />
                  </div>
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingGoal(false)}
                    className="flex-1 py-2.5 bg-white hover:bg-[var(--color-bg)] border border-[var(--color-border)] text-xs font-semibold text-[var(--color-text-secondary)] rounded-xl cursor-pointer transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs transition-colors"
                  >
                    Simpan Target
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Selected Goal Details */}
          {selectedGoal && (
            <div className="space-y-4 animate-fade-in">
              <button
                onClick={() => setSelectedGoal(null)}
                className="py-1.5 px-3 bg-white hover:bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl text-xs font-bold text-[var(--color-text-secondary)] flex items-center gap-1 cursor-pointer transition-colors"
              >
                ← Kembali ke Daftar Target
              </button>

              <div className="bg-white p-5 border border-[var(--color-border)] rounded-2xl shadow-xs space-y-4 relative">
                {selectedGoal.photo && (
                  <div className="w-full h-44 rounded-xl border border-[var(--color-border)] overflow-hidden mb-2 bg-[var(--color-bg)]">
                    <img src={selectedGoal.photo} alt={selectedGoal.title} className="w-full h-full object-cover" />
                  </div>
                )}

                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-base font-bold text-[var(--color-text-primary)] tracking-tight">{selectedGoal.title}</h3>
                    <p className="text-xs font-mono font-semibold text-[var(--color-text-secondary)] mt-0.5">
                      Target Total: {formatRupiah(selectedGoal.targetAmount)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteGoal(selectedGoal.id)}
                    className="p-2 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-light)] rounded-lg transition-colors cursor-pointer"
                    title="Hapus Target"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {(() => {
                  const percent = Math.min(Math.round((selectedGoal.currentAmount / selectedGoal.targetAmount) * 100), 100);
                  return (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs font-semibold font-mono">
                        <span className="text-[var(--color-text-secondary)]">Terkumpul: {formatRupiah(selectedGoal.currentAmount)}</span>
                        <span className="bg-[var(--color-income-light)] text-[var(--color-income)] border border-[var(--color-income-border)] px-2 py-0.5 rounded-md text-[10px] font-bold">
                          {percent}% Terpenuhi
                        </span>
                      </div>
                      <div className="w-full h-3 bg-[var(--color-bg)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[var(--color-secondary)] rounded-full transition-all duration-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Add / Subtract Dana Transaction Form */}
              <div className="bg-white p-4.5 border border-[var(--color-border)] rounded-2xl shadow-xs space-y-3">
                <span className="text-xs font-bold uppercase text-[var(--color-text-secondary)] tracking-wider block">
                  Mutasi Dana Target
                </span>

                <form onSubmit={handleAddGoalLog} className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 p-1 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl">
                    <button
                      type="button"
                      onClick={() => setLogType('add')}
                      className={`py-2 text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1 ${
                        logType === 'add'
                          ? 'bg-[var(--color-income)] text-white shadow-xs'
                          : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                      }`}
                    >
                      <ArrowUpRight size={14} /> Tambah Simpanan
                    </button>
                    <button
                      type="button"
                      onClick={() => setLogType('subtract')}
                      className={`py-2 text-xs font-bold rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1 ${
                        logType === 'subtract'
                          ? 'bg-[var(--color-danger)] text-white shadow-xs'
                          : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                      }`}
                    >
                      <ArrowDownLeft size={14} /> Tarik Dana
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Jumlah Nominal</label>
                      <input
                        type="number"
                        value={logAmount}
                        onChange={e => setLogAmount(e.target.value)}
                        className="w-full text-xs p-2.5 bg-white border border-[var(--color-border)] rounded-xl font-mono font-medium text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
                        placeholder="cth: 500000"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Tanggal Mutasi</label>
                      <input
                        type="date"
                        value={logDate}
                        onChange={e => setLogDate(e.target.value)}
                        className="w-full text-xs p-2.5 bg-white border border-[var(--color-border)] rounded-xl font-mono font-medium text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Catatan Mutasi</label>
                    <input
                      type="text"
                      value={logNote}
                      onChange={e => setLogNote(e.target.value)}
                      className="w-full text-xs p-2.5 bg-white border border-[var(--color-border)] rounded-xl font-medium text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
                      placeholder="cth: Tabungan sisa bulanan"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  >
                    Catat Mutasi Target
                  </button>
                </form>
              </div>

              {/* Goal Logs */}
              <div className="space-y-2.5">
                <span className="text-xs font-bold uppercase text-[var(--color-text-secondary)] tracking-wider block px-1">
                  Riwayat Mutasi Dana
                </span>

                {selectedGoal.logs.length === 0 ? (
                  <div className="bg-white p-6 text-center border border-[var(--color-border)] rounded-2xl shadow-xs">
                    <p className="text-xs font-medium text-[var(--color-text-muted)]">Belum ada mutasi keuangan pada target ini.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedGoal.logs.map(log => {
                      const isAdd = log.type === 'add';
                      return (
                        <div
                          key={log.id}
                          className="bg-white p-3 border border-[var(--color-border)] rounded-xl shadow-xs flex justify-between items-center"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              isAdd ? 'bg-[var(--color-income-light)] text-[var(--color-income)]' : 'bg-[var(--color-danger-light)] text-[var(--color-danger)]'
                            }`}>
                              {isAdd ? <ArrowUpRight size={16} /> : <ArrowDownLeft size={16} />}
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-[var(--color-text-primary)]">{log.note}</h4>
                              <p className="text-[10px] text-[var(--color-text-muted)] font-medium">
                                {parseLocalDate(log.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </p>
                            </div>
                          </div>
                          <span className={`text-xs font-bold font-mono ${isAdd ? 'text-[var(--color-income)]' : 'text-[var(--color-danger)]'}`}>
                            {isAdd ? '+' : '-'}{formatRupiah(log.amount)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Goals List */}
          {!selectedGoal && !isAddingGoal && (
            <div className="space-y-3">
              {goals.length === 0 ? (
                <div className="bg-white p-8 text-center border border-[var(--color-border)] rounded-2xl shadow-xs space-y-1.5">
                  <p className="text-xs font-semibold text-[var(--color-text-primary)]">Belum ada target impian.</p>
                  <p className="text-[11px] text-[var(--color-text-secondary)]">Rencanakan target pertamamu seperti beli gadget, dana darurat, atau liburan!</p>
                </div>
              ) : (
                <div className="grid gap-2.5">
                  {goals.map(goal => {
                    const percent = Math.min(Math.round((goal.currentAmount / goal.targetAmount) * 100), 100);
                    return (
                      <div
                        key={goal.id}
                        onClick={() => setSelectedGoal(goal)}
                        className="bg-white p-4 border border-[var(--color-border)] rounded-2xl shadow-xs flex items-center justify-between gap-3 cursor-pointer hover:border-[var(--color-border-hover)] hover:shadow-sm transition-all"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {goal.photo ? (
                            <div className="w-12 h-12 rounded-xl border border-[var(--color-border)] overflow-hidden shrink-0 bg-[var(--color-bg)]">
                              <img src={goal.photo} alt={goal.title} className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-[var(--color-secondary-light)] text-[var(--color-secondary)] flex items-center justify-center shrink-0">
                              <Target size={20} />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="text-xs font-bold text-[var(--color-text-primary)] truncate">{goal.title}</h4>
                            <div className="w-full h-2 bg-[var(--color-bg)] rounded-full overflow-hidden mt-2">
                              <div
                                className="h-full bg-[var(--color-secondary)] rounded-full transition-all duration-500"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                            <p className="text-[10px] font-mono text-[var(--color-text-secondary)] font-medium mt-1">
                              {formatRupiah(goal.currentAmount)} / {formatRupiah(goal.targetAmount)} ({percent}%)
                            </p>
                          </div>
                        </div>
                        <ChevronRight size={18} className="text-[var(--color-text-muted)] shrink-0" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ======================================================== */}
      {/* TAB B: BUDGETING BULANAN DINAMIS */}
      {/* ======================================================== */}
      {activePageTab === 'budgeting' && (
        <div className="space-y-4 animate-fade-in">
          {/* Card 1: Header Periode Budget */}
          <div className="bg-white p-4.5 border border-[var(--color-border)] rounded-2xl shadow-xs flex flex-col gap-3">
            <div>
              <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider block">Periode Budget</span>
              <div className="flex items-center gap-2 mt-1.5">
                <select
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(Number(e.target.value))}
                  className="flex-1 border border-[var(--color-border)] rounded-xl px-3 py-2 text-xs font-bold text-[var(--color-text-primary)] bg-white cursor-pointer focus:outline-none focus:border-[var(--color-accent)]"
                >
                  {MONTH_NAMES.map((m, idx) => (
                    <option key={idx} value={idx}>{m}</option>
                  ))}
                </select>
                <select
                  value={selectedYear}
                  onChange={e => setSelectedYear(Number(e.target.value))}
                  className="flex-1 border border-[var(--color-border)] rounded-xl px-3 py-2 text-xs font-bold text-[var(--color-text-primary)] bg-white cursor-pointer focus:outline-none focus:border-[var(--color-accent)]"
                >
                  {yearsList.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={() => handleOpenBudgetModal()}
              className="w-full py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-bold rounded-xl flex justify-center items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
            >
              <Plus size={15} /> Atur Budget Baru
            </button>
          </div>

          {/* Card 2: Quick Presets */}
          <div className="bg-white p-4 border border-[var(--color-border)] rounded-2xl shadow-xs space-y-2">
            <span className="text-[10px] font-bold uppercase text-[var(--color-text-secondary)] tracking-wider block">
              Atur Cepat Kategori Pengeluaran
            </span>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {expenseCategories.slice(0, 6).map(catName => (
                <button
                  key={catName}
                  onClick={() => handleAddPresetBudget(catName)}
                  className="bg-[var(--color-bg)] hover:bg-neutral-200/80 border border-[var(--color-border)] px-3 py-1.5 rounded-lg text-xs font-semibold text-[var(--color-text-primary)] flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
                >
                  <Plus size={12} /> {catName}
                </button>
              ))}
            </div>
          </div>

          {/* Card 3: Overall Monthly Budget Summary */}
          <div className="bg-white p-5 border border-[var(--color-border)] rounded-2xl shadow-xs space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] flex items-center gap-1.5">
                <Wallet size={15} className="text-[var(--color-secondary)]" /> Ringkasan {MONTH_NAMES[selectedMonth]} {selectedYear}
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                budgetSummary.percent > 100 ? 'badge-expense' :
                budgetSummary.percent >= 75 ? 'badge-warning' :
                'badge-income'
              }`}>
                {budgetSummary.percent}% Terpakai
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center py-2.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl">
              <div>
                <span className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase block">Total Target</span>
                <span className="text-xs font-bold font-mono text-[var(--color-text-primary)]">
                  {formatRupiah(budgetSummary.totalTarget)}
                </span>
              </div>
              <div className="border-x border-[var(--color-border)]">
                <span className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase block">Terpakai</span>
                <span className="text-xs font-bold font-mono text-[var(--color-danger)]">
                  {formatRupiah(budgetSummary.totalSpent)}
                </span>
              </div>
              <div>
                <span className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase block">Sisa Budget</span>
                <span className={`text-xs font-bold font-mono ${budgetSummary.remaining < 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-income)]'}`}>
                  {formatRupiah(budgetSummary.remaining)}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="w-full h-2.5 bg-[var(--color-bg)] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    budgetSummary.percent > 100 ? 'bg-[var(--color-danger)]' :
                    budgetSummary.percent >= 75 ? 'bg-[var(--color-warning)]' :
                    'bg-[var(--color-income)]'
                  }`}
                  style={{ width: `${Math.min(budgetSummary.percent, 100)}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[10px] font-medium text-[var(--color-text-muted)]">
                <span>0%</span>
                <span>{budgetSummary.percent > 100 ? 'Overbudget!' : `${budgetSummary.percent}% Terpakai`}</span>
                <span>100%</span>
              </div>
            </div>
          </div>

          {/* Card 4: List of Category Budgets */}
          <div className="bg-white p-5 border border-[var(--color-border)] rounded-2xl shadow-xs space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] block">
              Daftar Kategori Budget
            </span>

            {budgets.length === 0 ? (
              <div className="bg-[var(--color-bg)] p-6 text-center border border-[var(--color-border)] rounded-xl space-y-1.5">
                <p className="text-xs font-semibold text-[var(--color-text-primary)]">Belum ada alokasi budget untuk bulan ini.</p>
                <p className="text-[11px] text-[var(--color-text-secondary)]">Klik "Atur Budget Baru" di atas untuk membatasi pengeluaranmu!</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {budgets.map(b => {
                  const spent = categorySpentMap[b.category] || 0;
                  const percent = b.targetAmount > 0 ? Math.round((spent / b.targetAmount) * 100) : 0;
                  const remaining = b.targetAmount - spent;

                  let badgeColor = 'badge-income';
                  let badgeText = 'Aman';
                  let barColor = 'bg-[var(--color-income)]';

                  if (percent > 100) {
                    badgeColor = 'badge-expense';
                    badgeText = 'Overbudget!';
                    barColor = 'bg-[var(--color-danger)]';
                  } else if (percent >= 75) {
                    badgeColor = 'badge-warning';
                    badgeText = 'Waspada';
                    barColor = 'bg-[var(--color-warning)]';
                  }

                  return (
                    <div
                      key={b.id}
                      className="bg-white p-3.5 border border-[var(--color-border)] rounded-xl shadow-xs space-y-2.5"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-primary)] shrink-0">
                            <CategoryIcon category={b.category} size={16} />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-[var(--color-text-primary)]">{b.category}</h4>
                            <p className="text-[10px] font-mono text-[var(--color-text-muted)] font-medium mt-0.5">
                              Batas: {formatRupiah(b.targetAmount)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${badgeColor}`}>
                            {badgeText}
                          </span>
                          <button
                            onClick={() => handleOpenBudgetModal(b)}
                            className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg)] rounded-lg transition-colors cursor-pointer"
                            title="Edit Budget"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteBudget(b.id)}
                            className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-light)] rounded-lg transition-colors cursor-pointer"
                            title="Hapus Budget"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Progress Bar & Real-time Integration */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[10px] font-medium font-mono">
                          <span className="text-[var(--color-text-secondary)]">Terpakai: {formatRupiah(spent)}</span>
                          <span className={remaining < 0 ? 'text-[var(--color-danger)] font-bold' : 'text-[var(--color-income)] font-bold'}>
                            {remaining < 0 ? `Lebih ${formatRupiah(Math.abs(remaining))}` : `Sisa ${formatRupiah(remaining)}`}
                          </span>
                        </div>
                        <div className="w-full h-2 bg-[var(--color-bg)] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                            style={{ width: `${Math.min(percent, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL EDIT / TAMBAH BUDGET */}
      {/* ======================================================== */}
      {isBudgetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white w-full max-w-xs p-5 border border-[var(--color-border)] rounded-2xl shadow-xl space-y-4 relative">
            <div className="flex justify-between items-center border-b border-[var(--color-border)] pb-2.5">
              <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                {editingBudgetId ? 'Edit Budget Kategori' : 'Tambah Budget Kategori'}
              </h3>
              <button
                onClick={() => setIsBudgetModalOpen(false)}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveBudgetForm} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Kategori Pengeluaran</label>
                <select
                  value={budgetCatSelect}
                  onChange={e => setBudgetCatSelect(e.target.value)}
                  className="w-full text-xs p-2.5 bg-white border border-[var(--color-border)] rounded-xl font-medium text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] cursor-pointer"
                >
                  {availableCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                  * Kategori dapat dikelola di halaman Profil.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Batas Budget Bulanan (Rp)</label>
                <input
                  type="number"
                  value={budgetLimitInput}
                  onChange={e => setBudgetLimitInput(e.target.value)}
                  className="w-full text-xs p-2.5 bg-white border border-[var(--color-border)] rounded-xl font-mono text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
                  placeholder="cth: 1500000"
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsBudgetModalOpen(false)}
                  className="w-1/2 py-2.5 bg-white hover:bg-[var(--color-bg)] border border-[var(--color-border)] text-xs font-semibold text-[var(--color-text-secondary)] rounded-xl cursor-pointer transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs transition-colors"
                >
                  Simpan Budget
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* CUSTOM CONFIRMATION MODAL */}
      {/* ======================================================== */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white w-full max-w-xs p-5 border border-[var(--color-border)] rounded-2xl shadow-xl space-y-3.5 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-[var(--color-danger-light)] text-[var(--color-danger)] flex items-center justify-center">
              <AlertTriangle size={24} />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-[var(--color-text-primary)]">{confirmModal.title}</h3>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                {confirmModal.message}
              </p>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                className="w-1/2 py-2.5 bg-white hover:bg-[var(--color-bg)] border border-[var(--color-border)] text-xs font-semibold text-[var(--color-text-secondary)] rounded-xl cursor-pointer transition-colors"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  confirmModal.onConfirm();
                  setConfirmModal({ ...confirmModal, isOpen: false });
                }}
                className="w-1/2 py-2.5 bg-[var(--color-danger)] hover:bg-rose-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs transition-colors"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* CUSTOM NOTICE MODAL */}
      {/* ======================================================== */}
      {noticeModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white w-full max-w-xs p-5 border border-[var(--color-border)] rounded-2xl shadow-xl space-y-3.5 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary)] flex items-center justify-center">
              <Info size={24} />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-[var(--color-text-primary)]">{noticeModal.title}</h3>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                {noticeModal.message}
              </p>
            </div>
            <button
              onClick={() => setNoticeModal({ ...noticeModal, isOpen: false })}
              className="w-full py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs transition-colors"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
