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

  // Custom Neobrutalist Modals State
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
      { opacity: 0, y: -10 },
      { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }
    );
    gsap.fromTo('.neo-card, .goal-card, .budget-card',
      { opacity: 0, y: 15 },
      { opacity: 1, y: 0, duration: 0.5, stagger: 0.07, ease: 'power2.out', delay: 0.05 }
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

  // Strictly pull expense and saving categories from settings (managed in Profile page)
  const expenseCategories = useMemo(() => {
    return settings?.categories?.expense || ['Makan', 'Transport', 'Belanja', 'Hiburan', 'Tagihan', 'Kesehatan', 'Pendidikan', 'Lainnya'];
  }, [settings]);

  const savingCategories = useMemo(() => {
    return settings?.categories?.saving || ['Dana Darurat', 'Investasi', 'Tabungan', 'Liburan'];
  }, [settings]);

  // Combined available categories (strictly integrated with Profile page categories)
  const availableCategories = useMemo(() => {
    const list = Array.from(new Set([...expenseCategories, ...savingCategories]));
    return list.length > 0 ? list : ['Makan', 'Transport', 'Belanja', 'Hiburan', 'Tagihan', 'Kesehatan', 'Pendidikan', 'Lainnya'];
  }, [expenseCategories, savingCategories]);

  // Dynamically calculate actual spending per category for selected month/year from transactions
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

  // Compute total monthly budget summary
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

  // Helper notice popup launcher
  const showNotice = (title: string, message: string) => {
    setNoticeModal({ isOpen: true, title, message });
  };

  // Helper confirm popup launcher
  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmModal({ isOpen: true, title, message, onConfirm });
  };

  // Handle Photo Upload
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

  // Create Goal
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

  // Open Budget Modal for adding or editing
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
      // Select first available category not already budgeted, or default to first
      const unbudgeted = availableCategories.find(cat => !budgets.some(b => b.category === cat));
      setBudgetCatSelect(unbudgeted || availableCategories[0]);
      setBudgetLimitInput('');
    }
    setIsBudgetModalOpen(true);
  };

  // Quick Preset Add Helper
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

  // Save / Update Budget
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

  // Delete Budget
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
    <div className="space-y-5 px-1 py-1">
      {/* 1. Top Navigation Tab Switcher */}
      <div id="goals-header" className="bg-white p-2.5 neo-border rounded-[var(--radius-md)] neo-shadow-sm">
        <div className="grid grid-cols-2 gap-2 bg-neutral-100 p-1.5 neo-border rounded-lg">
          <button
            onClick={() => {
              setActivePageTab('goals');
              setSelectedGoal(null);
            }}
            className={`py-2.5 text-xs font-black rounded-md flex items-center justify-center gap-2 cursor-pointer transition-all ${
              activePageTab === 'goals'
                ? 'bg-[var(--color-accent)] text-neutral-950 neo-border neo-shadow-xs'
                : 'text-neutral-500 hover:text-neutral-900 font-bold'
            }`}
          >
            <Target size={16} />
            <span>Target Impian</span>
          </button>
          
          <button
            onClick={() => setActivePageTab('budgeting')}
            className={`py-2.5 text-xs font-black rounded-md flex items-center justify-center gap-2 cursor-pointer transition-all ${
              activePageTab === 'budgeting'
                ? 'bg-[var(--color-accent)] text-neutral-950 neo-border neo-shadow-xs'
                : 'text-neutral-500 hover:text-neutral-900 font-bold'
            }`}
          >
            <PieChart size={16} />
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
              <div className="bg-white p-4.5 neo-border rounded-[var(--radius-md)] neo-shadow-sm flex flex-col gap-3 neo-card">
                <div>
                  <h2 className="text-md font-black tracking-tight">Rencana Target Impian</h2>
                  <p className="text-xs font-mono text-neutral-400 font-bold mt-0.5">Atur & kumpulkan budget impianmu</p>
                </div>
                <button
                  onClick={() => setIsAddingGoal(true)}
                  className="w-full neo-btn bg-[var(--color-accent)] hover:bg-yellow-400 px-3 py-2 text-xs font-black flex justify-center items-center gap-1.5 cursor-pointer"
                >
                  <Plus size={15} /> Tambah Target
                </button>
              </div>
            )}

          {/* Adding Form */}
          {isAddingGoal && (
            <div className="bg-white p-5 neo-border rounded-[var(--radius-md)] neo-shadow-md space-y-4 animate-fade-in neo-card">
              <div className="flex justify-between items-center border-b border-neutral-200 pb-3">
                <span className="text-xs font-extrabold uppercase text-neutral-500 flex items-center gap-1.5">
                  <Target size={15} className="text-amber-500" /> Buat Target Impian Baru
                </span>
                <button
                  onClick={() => setIsAddingGoal(false)}
                  className="p-1 text-neutral-400 hover:text-neutral-900 rounded cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateGoal} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block">Foto Target (Opsional)</label>
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 rounded-lg neo-border bg-neutral-50 flex items-center justify-center overflow-hidden shrink-0">
                      {newPhoto ? (
                        <img src={newPhoto} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <Camera size={22} className="text-neutral-400" />
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
                        className="neo-btn bg-neutral-100 hover:bg-neutral-200 py-1.5 px-3 text-xs font-bold cursor-pointer inline-block"
                      >
                        Unggah Gambar
                      </label>
                      {newPhoto && (
                        <button
                          type="button"
                          onClick={() => setNewPhoto('')}
                          className="text-rose-500 font-bold text-xs ml-3 hover:underline cursor-pointer"
                        >
                          Hapus
                        </button>
                      )}
                      <p className="text-[9px] text-neutral-400 font-bold mt-1">Gunakan foto impianmu</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-neutral-400 uppercase">Nama Target / Impian</label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    className="w-full text-xs p-3 bg-neutral-50 neo-border rounded-lg font-bold focus:outline-none focus:bg-white"
                    placeholder="cth: Beli Laptop Asus, Liburan Bali"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-neutral-400 uppercase">Nominal Target (Rp)</label>
                    <input
                      type="number"
                      value={newTarget}
                      onChange={e => setNewTarget(e.target.value)}
                      className="w-full text-xs p-3 bg-neutral-50 neo-border rounded-lg font-mono font-bold focus:outline-none focus:bg-white"
                      placeholder="cth: 15000000"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-neutral-400 uppercase">Dana Terkumpul Awal</label>
                    <input
                      type="number"
                      value={newCurrent}
                      onChange={e => setNewCurrent(e.target.value)}
                      className="w-full text-xs p-3 bg-neutral-50 neo-border rounded-lg font-mono font-bold focus:outline-none focus:bg-white"
                      placeholder="cth: 1000000"
                    />
                  </div>
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingGoal(false)}
                    className="flex-1 neo-btn bg-neutral-100 hover:bg-neutral-200 py-2.5 text-xs font-black text-neutral-800 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="flex-1 neo-btn bg-[var(--color-income)] hover:bg-emerald-400 py-2.5 text-xs font-black text-neutral-900 cursor-pointer"
                  >
                    Simpan Target Impian
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Selected Goal Details */}
          {selectedGoal && (
            <div className="space-y-4 animate-fade-in neo-card">
              <button
                onClick={() => setSelectedGoal(null)}
                className="neo-btn bg-neutral-100 hover:bg-neutral-200 py-1.5 px-3 text-xs font-black flex items-center gap-1 cursor-pointer"
              >
                ← Kembali ke Daftar Target
              </button>

              <div className="bg-white p-5 neo-border rounded-[var(--radius-md)] neo-shadow-sm space-y-4 relative">
                {selectedGoal.photo && (
                  <div className="w-full h-40 rounded-lg neo-border overflow-hidden mb-2">
                    <img src={selectedGoal.photo} alt={selectedGoal.title} className="w-full h-full object-cover" />
                  </div>
                )}

                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-black tracking-tight">{selectedGoal.title}</h3>
                    <p className="text-xs font-mono font-bold text-neutral-400 mt-0.5">
                      Target Total: {formatRupiah(selectedGoal.targetAmount)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteGoal(selectedGoal.id)}
                    className="p-2 text-neutral-400 hover:text-rose-500 hover:bg-rose-50 rounded neo-border border-transparent hover:border-rose-500 transition-colors cursor-pointer"
                    title="Hapus Target"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {(() => {
                  const percent = Math.min(Math.round((selectedGoal.currentAmount / selectedGoal.targetAmount) * 100), 100);
                  return (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs font-bold font-mono">
                        <span className="text-neutral-600">Terkumpul: {formatRupiah(selectedGoal.currentAmount)}</span>
                        <span className="bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded text-[10px] font-black">
                          {percent}% Selesai
                        </span>
                      </div>
                      <div className="w-full h-4 bg-neutral-100 neo-border rounded-lg overflow-hidden relative">
                        <div
                          className="h-full bg-emerald-400 relative transition-all duration-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Add / Subtract Dana Transaction Form */}
              <div className="bg-white p-5 neo-border rounded-[var(--radius-md)] neo-shadow-sm space-y-3">
                <span className="text-xs font-extrabold uppercase text-neutral-500 block">
                  Mutasi Dana Keuangan Target
                </span>

                <form onSubmit={handleAddGoalLog} className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 p-1 bg-neutral-100 neo-border rounded-lg">
                    <button
                      type="button"
                      onClick={() => setLogType('add')}
                      className={`py-2 text-xs font-extrabold rounded-md border cursor-pointer transition-all ${
                        logType === 'add'
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300 neo-shadow-xs'
                          : 'border-transparent text-neutral-500'
                      }`}
                    >
                      <ArrowUpRight size={13} className="inline mr-1" /> Tambah Simpanan
                    </button>
                    <button
                      type="button"
                      onClick={() => setLogType('subtract')}
                      className={`py-2 text-xs font-extrabold rounded-md border cursor-pointer transition-all ${
                        logType === 'subtract'
                          ? 'bg-rose-100 text-rose-800 border-rose-300 neo-shadow-xs'
                          : 'border-transparent text-neutral-500'
                      }`}
                    >
                      <ArrowDownLeft size={13} className="inline mr-1" /> Tarik Dana
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-neutral-400 uppercase">Jumlah Nominal</label>
                      <input
                        type="number"
                        value={logAmount}
                        onChange={e => setLogAmount(e.target.value)}
                        className="w-full text-xs p-2.5 bg-neutral-50 neo-border rounded-lg font-mono font-bold focus:outline-none"
                        placeholder="cth: 500000"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-neutral-400 uppercase">Tanggal Mutasi</label>
                      <input
                        type="date"
                        value={logDate}
                        onChange={e => setLogDate(e.target.value)}
                        className="w-full text-xs p-2.5 bg-neutral-50 neo-border rounded-lg font-mono font-bold focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-neutral-400 uppercase">Catatan Mutasi</label>
                    <input
                      type="text"
                      value={logNote}
                      onChange={e => setLogNote(e.target.value)}
                      className="w-full text-xs p-2.5 bg-neutral-50 neo-border rounded-lg font-bold focus:outline-none"
                      placeholder="cth: Tabungan sisa bulanan"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full neo-btn bg-[var(--color-accent)] hover:bg-yellow-400 py-2.5 text-xs font-black flex items-center justify-center gap-2 cursor-pointer"
                  >
                    Catat Mutasi Target
                  </button>
                </form>
              </div>

              {/* Goal Logs */}
              <div className="space-y-2.5">
                <span className="text-xs font-extrabold uppercase text-neutral-500 block">
                  Aktivitas Riwayat Dana Target
                </span>

                {selectedGoal.logs.length === 0 ? (
                  <div className="bg-white p-6 text-center neo-border rounded-[var(--radius-md)] neo-shadow-sm">
                    <p className="text-xs font-bold text-neutral-400">Belum ada mutasi keuangan pada target ini.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedGoal.logs.map(log => {
                      const isAdd = log.type === 'add';
                      return (
                        <div
                          key={log.id}
                          className="bg-white p-3.5 neo-border rounded-[var(--radius-md)] neo-shadow-sm flex justify-between items-center"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded border-2 flex items-center justify-center ${
                              isAdd ? 'bg-emerald-50 border-emerald-300 text-emerald-600' : 'bg-rose-50 border-rose-300 text-rose-600'
                            }`}>
                              {isAdd ? <ArrowUpRight size={16} /> : <ArrowDownLeft size={16} />}
                            </div>
                            <div>
                              <h4 className="text-xs font-extrabold">{log.note}</h4>
                              <p className="text-[9px] font-mono text-neutral-400 font-bold">
                                {parseLocalDate(log.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </p>
                            </div>
                          </div>
                          <span className={`text-xs font-black font-mono ${isAdd ? 'text-emerald-600' : 'text-rose-500'}`}>
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
            <div className="space-y-3 neo-card">
              {goals.length === 0 ? (
                <div className="bg-white p-10 text-center neo-border rounded-[var(--radius-md)] neo-shadow-sm space-y-2">
                  <p className="text-xs font-bold text-neutral-400">Belum ada target impian yang dibuat.</p>
                  <p className="text-[10px] text-neutral-400 font-bold">Rencanakan target pertamamu seperti beli hp baru, laptop, atau liburan!</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {goals.map(goal => {
                    const percent = Math.min(Math.round((goal.currentAmount / goal.targetAmount) * 100), 100);
                    return (
                      <div
                        key={goal.id}
                        onClick={() => setSelectedGoal(goal)}
                        className="bg-white p-4 neo-border rounded-[var(--radius-md)] neo-shadow-sm flex items-center justify-between gap-3 cursor-pointer hover:border-[var(--color-accent)] active:translate-x-[1px] active:translate-y-[1px] transition-transform"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {goal.photo ? (
                            <div className="w-12 h-12 rounded-lg border-2 border-neutral-900 overflow-hidden shrink-0">
                              <img src={goal.photo} alt={goal.title} className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className="w-12 h-12 rounded-lg neo-border bg-amber-50 flex items-center justify-center shrink-0">
                              <Target size={20} className="text-amber-500" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="text-xs font-extrabold truncate">{goal.title}</h4>
                            <div className="w-full h-2.5 bg-neutral-100 border border-neutral-900 rounded-full overflow-hidden mt-1.5 relative">
                              <div
                                className="h-full bg-emerald-400"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                            <p className="text-[9px] font-mono text-neutral-400 font-bold mt-1.5">
                              {formatRupiah(goal.currentAmount)} / {formatRupiah(goal.targetAmount)} ({percent}%)
                            </p>
                          </div>
                        </div>
                        <ChevronRight size={18} className="text-neutral-400 shrink-0" />
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
          <div className="space-y-5 animate-fade-in">
            {/* Card 1: Header Periode Budget */}
            <div className="bg-white p-4.5 neo-border rounded-[var(--radius-md)] neo-shadow-sm flex flex-col gap-3 neo-card">
              <div>
                <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block">Periode Budget</span>
                <div className="flex items-center gap-2 mt-1">
                  <select
                    value={selectedMonth}
                    onChange={e => setSelectedMonth(Number(e.target.value))}
                    className="flex-1 neo-border rounded-lg px-3 py-2 text-xs font-black bg-white cursor-pointer focus:bg-yellow-50"
                  >
                    {MONTH_NAMES.map((m, idx) => (
                      <option key={idx} value={idx}>{m}</option>
                    ))}
                  </select>
                  <select
                    value={selectedYear}
                    onChange={e => setSelectedYear(Number(e.target.value))}
                    className="flex-1 neo-border rounded-lg px-3 py-2 text-xs font-black bg-white cursor-pointer focus:bg-yellow-50"
                  >
                    {yearsList.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={() => handleOpenBudgetModal()}
                className="w-full neo-btn bg-[var(--color-accent)] hover:bg-yellow-400 px-3.5 py-2.5 text-xs font-black flex justify-center items-center gap-1.5 cursor-pointer"
              >
                <Plus size={15} /> Atur Budget
              </button>
            </div>

          {/* Card 2: Quick Presets (Strictly from available expense categories) */}
          <div className="bg-white p-4.5 neo-border rounded-[var(--radius-md)] neo-shadow-sm space-y-2.5 neo-card">
            <span className="text-[10px] font-black uppercase text-neutral-400 tracking-wider block">
              Atur Cepat Kategori Pengeluaran
            </span>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {expenseCategories.slice(0, 6).map(catName => (
                <button
                  key={catName}
                  onClick={() => handleAddPresetBudget(catName)}
                  className="neo-btn bg-amber-50 hover:bg-amber-100 px-3 py-1.5 text-[11px] font-black flex items-center gap-1.5 shrink-0 cursor-pointer text-neutral-900"
                >
                  <Plus size={12} /> {catName}
                </button>
              ))}
            </div>
          </div>

          {/* Card 3: Overall Monthly Budget Summary */}
          <div className="bg-white p-5 neo-border rounded-[var(--radius-md)] neo-shadow-sm space-y-4 neo-card">
            <div className="flex justify-between items-center">
              <span className="text-xs font-extrabold uppercase tracking-widest text-neutral-500 flex items-center gap-1.5">
                <Wallet size={15} className="text-amber-500" /> Ringkasan Budget {MONTH_NAMES[selectedMonth]} {selectedYear}
              </span>
              <span className={`text-[10px] font-black px-2.5 py-0.5 rounded neo-border ${
                budgetSummary.percent > 100 ? 'bg-rose-100 text-rose-800 border-rose-300' :
                budgetSummary.percent >= 75 ? 'bg-amber-100 text-amber-800 border-amber-300' :
                'bg-emerald-100 text-emerald-800 border-emerald-300'
              }`}>
                {budgetSummary.percent}% Terpakai
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center py-2.5 bg-neutral-50 neo-border rounded-lg">
              <div>
                <span className="text-[9px] font-black text-neutral-400 uppercase block">Total Target</span>
                <span className="text-xs font-black font-mono text-neutral-900">
                  {formatRupiah(budgetSummary.totalTarget)}
                </span>
              </div>
              <div className="border-x border-neutral-200">
                <span className="text-[9px] font-black text-neutral-400 uppercase block">Terpakai</span>
                <span className="text-xs font-black font-mono text-rose-600">
                  {formatRupiah(budgetSummary.totalSpent)}
                </span>
              </div>
              <div>
                <span className="text-[9px] font-black text-neutral-400 uppercase block">Sisa Budget</span>
                <span className={`text-xs font-black font-mono ${budgetSummary.remaining < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {formatRupiah(budgetSummary.remaining)}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="w-full h-3.5 bg-neutral-100 neo-border rounded-full overflow-hidden relative">
                <div
                  className={`h-full transition-all duration-500 ${
                    budgetSummary.percent > 100 ? 'bg-rose-500' :
                    budgetSummary.percent >= 75 ? 'bg-amber-400' :
                    'bg-emerald-400'
                  }`}
                  style={{ width: `${Math.min(budgetSummary.percent, 100)}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[9px] font-bold text-neutral-400">
                <span>0%</span>
                <span>{budgetSummary.percent > 100 ? 'Overbudget!' : `${budgetSummary.percent}% Terpakai`}</span>
                <span>100%</span>
              </div>
            </div>
          </div>

          {/* Card 4: List of Category Budgets */}
          <div className="bg-white p-5 neo-border rounded-[var(--radius-md)] neo-shadow-sm space-y-4 neo-card">
            <span className="text-xs font-extrabold uppercase tracking-widest text-neutral-500 block">
              Daftar Kategori Budget Bulanan
            </span>

            {budgets.length === 0 ? (
              <div className="bg-neutral-50 p-8 text-center neo-border rounded-lg space-y-2">
                <p className="text-xs font-bold text-neutral-400">Belum ada alokasi budget untuk bulan ini.</p>
                <p className="text-[10px] text-neutral-400 font-bold">Klik "Atur Budget" di atas untuk membatasi pengeluaran bulananmu!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {budgets.map(b => {
                  const spent = categorySpentMap[b.category] || 0;
                  const percent = b.targetAmount > 0 ? Math.round((spent / b.targetAmount) * 100) : 0;
                  const remaining = b.targetAmount - spent;

                  let badgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-300';
                  let badgeText = 'Aman';
                  let barColor = 'bg-emerald-400';

                  if (percent > 100) {
                    badgeColor = 'bg-rose-100 text-rose-800 border-rose-300';
                    badgeText = 'Overbudget!';
                    barColor = 'bg-rose-500';
                  } else if (percent >= 75) {
                    badgeColor = 'bg-amber-100 text-amber-800 border-amber-300';
                    badgeText = 'Waspada';
                    barColor = 'bg-amber-400';
                  }

                  return (
                    <div
                      key={b.id}
                      className="bg-white p-4 neo-border rounded-lg neo-shadow-xs space-y-3 border-l-4 border-l-neutral-900"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-amber-50 neo-border flex items-center justify-center text-neutral-800 shrink-0">
                            <CategoryIcon category={b.category} size={18} />
                          </div>
                          <div>
                            <h4 className="text-xs font-black text-neutral-900">{b.category}</h4>
                            <p className="text-[10px] font-mono font-bold text-neutral-400 mt-0.5">
                              Batas: {formatRupiah(b.targetAmount)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded border ${badgeColor}`}>
                            {badgeText}
                          </span>
                          <button
                            onClick={() => handleOpenBudgetModal(b)}
                            className="p-1.5 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded border border-transparent hover:border-neutral-300 cursor-pointer"
                            title="Edit Budget"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteBudget(b.id)}
                            className="p-1.5 text-neutral-400 hover:text-rose-500 hover:bg-rose-50 rounded border border-transparent hover:border-rose-300 cursor-pointer"
                            title="Hapus Budget"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Progress Bar & Real-time Integration */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-[10px] font-bold font-mono">
                          <span className="text-neutral-500">Terpakai: {formatRupiah(spent)}</span>
                          <span className={remaining < 0 ? 'text-rose-600 font-black' : 'text-emerald-600 font-black'}>
                            {remaining < 0 ? `Lebih ${formatRupiah(Math.abs(remaining))}` : `Sisa ${formatRupiah(remaining)}`}
                          </span>
                        </div>
                        <div className="w-full h-3 bg-neutral-100 neo-border rounded-md overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 ${barColor}`}
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
      {/* MODAL EDIT / TAMBAH BUDGET (Strictly integrated with Profile categories) */}
      {/* ======================================================== */}
      {isBudgetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white w-full max-w-xs p-5 neo-border rounded-xl neo-shadow-lg space-y-4 relative">
            <div className="flex justify-between items-center border-b border-neutral-200 pb-2.5">
              <h3 className="text-sm font-black text-neutral-900">
                {editingBudgetId ? 'Edit Budget Kategori' : 'Tambah Budget Kategori'}
              </h3>
              <button
                onClick={() => setIsBudgetModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-900 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveBudgetForm} className="space-y-3.5">
              {/* Category Select strictly from Profile categories */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-neutral-400 uppercase">Pilih Kategori Pengeluaran</label>
                <select
                  value={budgetCatSelect}
                  onChange={e => setBudgetCatSelect(e.target.value)}
                  className="w-full text-xs p-3 bg-neutral-50 neo-border rounded-lg font-bold focus:outline-none focus:bg-white cursor-pointer"
                >
                  {availableCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <p className="text-[9px] text-neutral-400 font-bold mt-1">
                  * Kategori diambil dari halaman Profil. Tambah kategori baru di Profil jika diperlukan.
                </p>
              </div>

              {/* Limit Input */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-neutral-400 uppercase">Batas Budget Bulanan (Rp)</label>
                <input
                  type="number"
                  value={budgetLimitInput}
                  onChange={e => setBudgetLimitInput(e.target.value)}
                  className="w-full text-xs p-3 bg-neutral-50 neo-border rounded-lg font-mono font-bold focus:outline-none focus:bg-white"
                  placeholder="cth: 1500000"
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsBudgetModalOpen(false)}
                  className="w-1/2 neo-btn bg-neutral-100 hover:bg-neutral-200 py-2.5 text-xs font-black cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="w-1/2 neo-btn bg-[var(--color-accent)] hover:bg-yellow-400 py-2.5 text-xs font-black cursor-pointer"
                >
                  Simpan Budget
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* CUSTOM CONFIRMATION MODAL (Replaces window.confirm) */}
      {/* ======================================================== */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white w-full max-w-xs p-5 neo-border rounded-xl neo-shadow-lg space-y-4 text-center">
            <div className="inline-flex p-3 bg-rose-100 rounded-full neo-border">
              <AlertTriangle size={28} className="text-rose-600 animate-bounce" />
            </div>
            <div className="space-y-1">
              <h3 className="text-md font-black text-neutral-900">{confirmModal.title}</h3>
              <p className="text-xs text-neutral-500 font-bold leading-relaxed">
                {confirmModal.message}
              </p>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                className="w-1/2 neo-btn bg-neutral-100 hover:bg-neutral-200 py-2.5 text-xs font-black cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  confirmModal.onConfirm();
                  setConfirmModal({ ...confirmModal, isOpen: false });
                }}
                className="w-1/2 neo-btn bg-rose-500 hover:bg-rose-600 text-white py-2.5 text-xs font-black cursor-pointer"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* CUSTOM NOTICE MODAL (Replaces window.alert) */}
      {/* ======================================================== */}
      {noticeModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white w-full max-w-xs p-5 neo-border rounded-xl neo-shadow-lg space-y-4 text-center">
            <div className="inline-flex p-3 bg-amber-100 rounded-full neo-border">
              <Info size={28} className="text-amber-600" />
            </div>
            <div className="space-y-1">
              <h3 className="text-md font-black text-neutral-900">{noticeModal.title}</h3>
              <p className="text-xs text-neutral-500 font-bold leading-relaxed">
                {noticeModal.message}
              </p>
            </div>
            <button
              onClick={() => setNoticeModal({ ...noticeModal, isOpen: false })}
              className="w-full neo-btn bg-[var(--color-accent)] hover:bg-yellow-400 py-2.5 text-xs font-black cursor-pointer"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
