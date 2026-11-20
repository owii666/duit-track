import React, { useState, useEffect } from 'react';
import { AppSettings, Transaction, Wallet } from '../types';
import { initDB, getTransactions, getGoals, getStreaks, getSettings, getWallets, saveWallet, deleteWallet } from '../db/indexedDB';
import { calculateWalletBalances, formatRupiah } from '../utils/financeHelpers';
import { Sun, Moon, Download, Upload, AlertTriangle, ShieldAlert, Check, Plus, Trash2, Bell, RefreshCw, User, Camera, ShoppingBag, Coins, Bookmark, FileText, Wallet as WalletIcon } from 'lucide-react';
import * as XLSX from 'xlsx';
import gsap from 'gsap';

interface ProfileProps {
  settings: AppSettings;
  transactions: Transaction[];
  onUpdateSettings: (settings: AppSettings) => void;
  onResetAllData: () => Promise<void>;
}

export default function Profile({
  settings,
  transactions,
  onUpdateSettings,
  onResetAllData
}: ProfileProps) {
  const [userName, setUserName] = useState('');
  const [profilePhoto, setProfilePhoto] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [activeCatTab, setActiveCatTab] = useState<'income' | 'expense' | 'saving'>('expense');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const [reminderTime, setReminderTime] = useState(settings.dailyReminderTime);

  // Wallets state
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [newWalletName, setNewWalletName] = useState('');
  const [newWalletBalance, setNewWalletBalance] = useState('');

  // GSAP Entrance Animations
  useEffect(() => {
    gsap.fromTo('.profile-card, .neo-card, .neo-shadow-sm',
      { opacity: 0, y: 15 },
      { opacity: 1, y: 0, duration: 0.5, stagger: 0.08, ease: 'power2.out' }
    );
    loadWallets();
  }, []);

  const loadWallets = async () => {
    try {
      const dbWallets = await getWallets();
      setWallets(dbWallets);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWalletName.trim()) return;

    const newWallet: Wallet = {
      id: 'wallet_' + Date.now(),
      name: newWalletName.trim(),
      initialBalance: Number(newWalletBalance) || 0,
      createdAt: Date.now()
    };

    await saveWallet(newWallet);
    setNewWalletName('');
    setNewWalletBalance('');
    loadWallets();
  };

  const handleDeleteWallet = async (id: string) => {
    if (!confirm('Yakin ingin menghapus wallet ini?')) return;
    await deleteWallet(id);
    loadWallets();
  };

  const walletBalances = calculateWalletBalances(wallets, transactions);

  useEffect(() => {
    const storedName = localStorage.getItem('finance_user_name') || 'Budi';
    setUserName(storedName);
    const storedPhoto = localStorage.getItem('finance_profile_photo') || '';
    setProfilePhoto(storedPhoto);
  }, []);

  // Save name changes immediately
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setUserName(name);
    localStorage.setItem('finance_user_name', name);
    // Dispatch a custom event to update dashboard greeting immediately
    window.dispatchEvent(new Event('user_name_updated'));
  };

  // Manage Category addition
  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategory.trim()) return;

    const catName = newCategory.trim();
    // Check duplication
    if (settings.categories[activeCatTab].includes(catName)) {
      alert('Kategori sudah ada!');
      return;
    }

    const updatedCategories = {
      ...settings.categories,
      [activeCatTab]: [...settings.categories[activeCatTab], catName]
    };

    onUpdateSettings({
      ...settings,
      categories: updatedCategories
    });
    setNewCategory('');
  };

  // Manage Category deletion
  const handleDeleteCategory = (catToDelete: string) => {
    const hasTransactions = transactions.some(tx => tx.category === catToDelete && tx.type === activeCatTab);
    if (hasTransactions) {
      alert(`Kategori "${catToDelete}" tidak bisa dihapus karena masih digunakan dalam beberapa transaksi!`);
      return;
    }

    const updatedList = settings.categories[activeCatTab].filter(c => c !== catToDelete);
    
    // Protect having at least one category
    if (updatedList.length === 0) {
      alert('Minimal harus ada 1 kategori tersisa!');
      return;
    }

    onUpdateSettings({
      ...settings,
      categories: {
        ...settings.categories,
        [activeCatTab]: updatedList
      }
    });
  };

  // Save Reminder configuration
  const handleReminderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = e.target.value;
    setReminderTime(time);
    onUpdateSettings({
      ...settings,
      dailyReminderTime: time
    });
  };

  // Toggle active status for local daily notifications
  const handleToggleNotifications = async () => {
    const nextVal = !settings.notificationsEnabled;
    
    if (nextVal) {
      if (!('Notification' in window)) {
        alert('Perangkat atau browser ini tidak mendukung notifikasi sistem harian.');
        return;
      }
      
      try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          alert('Akses Notifikasi Ditolak! Harap berikan izin notifikasi di pengaturan browser atau HP Anda secara manual untuk mengaktifkan pengingat harian.');
          return;
        }
        
        // Show test success notification
        if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.ready;
          registration.showNotification('📲 Alarm Daptrack Aktif!', {
            body: `Pengingat harian kamu telah berhasil dijadwalkan pada jam ${reminderTime}!`,
            icon: '/assets/logo.png',
            badge: '/assets/logo.png',
            vibrate: [200, 100, 200]
          } as any);
        } else {
          new Notification('📲 Alarm Daptrack Aktif!', {
            body: `Pengingat harian kamu telah berhasil dijadwalkan pada jam ${reminderTime}!`,
            icon: '/assets/logo.png'
          });
        }
      } catch (err) {
        console.error('Permission requesting failed:', err);
      }
    }

    onUpdateSettings({
      ...settings,
      notificationsEnabled: nextVal
    });
  };

  // System Full Backup to JSON
  const handleFullBackup = async () => {
    try {
      const dbTx = await getTransactions();
      const dbGoals = await getGoals();
      const dbStreaks = await getStreaks();
      const dbSettings = await getSettings();

      const backupData = {
        version: 1,
        source: 'neobrutalist_finance_app',
        timestamp: Date.now(),
        transactions: dbTx,
        goals: dbGoals,
        streaks: dbStreaks,
        settings: dbSettings,
        localStorage: {
          finance_user_name: localStorage.getItem('finance_user_name') || 'Budi',
          finance_profile_photo: localStorage.getItem('finance_profile_photo') || '',
          finance_user_purpose: localStorage.getItem('finance_user_purpose') || 'menabung',
          finance_onboarding_completed: localStorage.getItem('finance_onboarding_completed') || 'false'
        }
      };

      const dataStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Backup_Keuangan_Keren_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
    } catch (err) {
      alert('Gagal membuat file cadangan: ' + err);
    }
  };

  // System Full Restore from JSON
  const handleFullRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        if (!parsed || parsed.source !== 'neobrutalist_finance_app') {
          alert('File cadangan tidak valid atau tidak dikenali oleh aplikasi ini!');
          return;
        }

        if (!confirm('Peringatan: Pemulihan akan menimpa seluruh data keuangan kamu saat ini dengan data dari file cadangan. Apakah kamu yakin ingin melanjutkan?')) {
          return;
        }

        setResetMessage('Mengembalikan seluruh data cadangan...');

        // 1. Reset database & localStorage first
        await onResetAllData();

        const db = await initDB();

        // 2. Restore transactions
        if (parsed.transactions && Array.isArray(parsed.transactions)) {
          const txStore = db.transaction('transactions', 'readwrite').objectStore('transactions');
          for (const t of parsed.transactions) {
            delete t.id; // clear to avoid key constraint error
            txStore.add(t);
          }
        }

        // 3. Restore goals
        if (parsed.goals && Array.isArray(parsed.goals)) {
          const goalStore = db.transaction('goals', 'readwrite').objectStore('goals');
          for (const g of parsed.goals) {
            goalStore.put(g);
          }
        }

        // 4. Restore streaks
        if (parsed.streaks && Array.isArray(parsed.streaks)) {
          const streakStore = db.transaction('streaks', 'readwrite').objectStore('streaks');
          for (const s of parsed.streaks) {
            streakStore.put(s);
          }
        }

        // 5. Restore settings
        if (parsed.settings) {
          const settingsStore = db.transaction('settings', 'readwrite').objectStore('settings');
          settingsStore.put(parsed.settings, 'app_settings');
        }

        // 6. Restore localStorage preferences
        if (parsed.localStorage) {
          if (parsed.localStorage.finance_user_name) localStorage.setItem('finance_user_name', parsed.localStorage.finance_user_name);
          if (parsed.localStorage.finance_profile_photo) localStorage.setItem('finance_profile_photo', parsed.localStorage.finance_profile_photo);
          if (parsed.localStorage.finance_user_purpose) localStorage.setItem('finance_user_purpose', parsed.localStorage.finance_user_purpose);
          if (parsed.localStorage.finance_onboarding_completed) localStorage.setItem('finance_onboarding_completed', parsed.localStorage.finance_onboarding_completed);
        }

        alert('Selamat! Pemulihan seluruh data cadangan berhasil diselesaikan.');
        window.location.reload(); // Reload cleanly to synchronize the new environment state
      } catch (err) {
        alert('Gagal membaca atau memulihkan file cadangan: ' + err);
      } finally {
        setResetMessage('');
      }
    };
    reader.readAsText(file);
  };

  // Real Data Export to beautiful EXCEL (.xlsx) using xlsx library
  const handleExportExcel = () => {
    try {
      if (transactions.length === 0) {
        alert('Belum ada data transaksi untuk diekspor!');
        return;
      }

      // Map data to custom Indonesian formatted records
      const worksheetData = transactions.map((t, index) => ({
        'No.': index + 1,
        'ID Transaksi': t.id || '',
        'Jenis Aliran': t.type === 'income' ? 'Pemasukan' : t.type === 'expense' ? 'Belanja' : t.type === 'transfer' ? 'Transfer' : 'Nabung',
        'Nominal (Rp)': t.amount,
        'Kategori': t.category,
        'Catatan': t.note || '-',
        'Tanggal': t.date,
        'Waktu Pencatatan': new Date(t.createdAt).toLocaleString('id-ID')
      }));

      // Create Worksheet from JSON
      const worksheet = XLSX.utils.json_to_sheet(worksheetData);

      // Define column widths for absolute neatness
      const colWidths = [
        { wch: 6 },   // No
        { wch: 14 },  // ID Transaksi
        { wch: 15 },  // Jenis Aliran
        { wch: 18 },  // Nominal
        { wch: 20 },  // Kategori
        { wch: 30 },  // Catatan
        { wch: 15 },  // Tanggal
        { wch: 24 }   // Waktu Pencatatan
      ];
      worksheet['!cols'] = colWidths;

      // Create Workbook
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Laporan Daptrack');

      // Write excel file and download
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Laporan_Keuangan_Daptrack_${new Date().toISOString().split('T')[0]}.xlsx`);
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Gagal mengekspor laporan ke format Excel: ' + err);
    }
  };

  // Factory Data Reset
  const handleFactoryReset = async () => {
    try {
      setResetMessage('Sedang membersihkan database...');
      await onResetAllData();
      localStorage.removeItem('finance_user_name');
      localStorage.removeItem('finance_profile_photo');
      localStorage.removeItem('finance_user_purpose');
      localStorage.removeItem('finance_onboarding_completed');
      setUserName('Budi');
      setProfilePhoto('');
      setResetMessage('');
      setShowResetConfirm(false);
      window.dispatchEvent(new Event('user_name_updated'));
      window.dispatchEvent(new Event('profile_photo_updated'));
      alert('Seluruh data keuangan berhasil di-reset ke pengaturan awal pabrik!');
      window.location.reload();
    } catch (err) {
      alert('Gagal mereset data: ' + err);
    }
  };

  return (
    <div className="space-y-5 px-1 py-1">
      {/* 1. Pengaturan Identitas */}
      <div className="bg-[var(--color-surface)] p-4 neo-border rounded-[var(--radius-md)] neo-shadow-sm space-y-4">
        <span className="text-xs font-extrabold uppercase tracking-widest text-neutral-500">
          Profil & Identitas Pengguna
        </span>

        {/* Profile Photo Uploader */}
        <div className="flex items-center gap-4 pb-3 border-b border-neutral-150">
          <div className="relative w-16 h-16 rounded-full border-3 border-neutral-950 bg-neutral-100 flex items-center justify-center overflow-hidden shrink-0 neo-shadow-sm">
            {profilePhoto ? (
              <img src={profilePhoto} alt="Foto Profil" className="w-full h-full object-cover" />
            ) : (
              <User size={24} className="text-neutral-400" />
            )}
          </div>
          <div className="flex-1">
            <input
              type="file"
              id="profile-photo-input"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  if (file.size > 2 * 1024 * 1024) {
                    alert('Ukuran foto maksimal 2MB!');
                    return;
                  }
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    const b64 = reader.result as string;
                    setProfilePhoto(b64);
                    localStorage.setItem('finance_profile_photo', b64);
                    window.dispatchEvent(new Event('profile_photo_updated'));
                  };
                  reader.readAsDataURL(file);
                }
              }}
              className="hidden"
            />
            <label
              htmlFor="profile-photo-input"
              className="neo-btn bg-white hover:bg-neutral-50 px-2.5 py-1.5 text-[10px] font-black cursor-pointer inline-block"
            >
              Unggah Foto Profil
            </label>
            {profilePhoto && (
              <button
                type="button"
                onClick={() => {
                  setProfilePhoto('');
                  localStorage.removeItem('finance_profile_photo');
                  window.dispatchEvent(new Event('profile_photo_updated'));
                }}
                className="text-rose-500 font-bold text-[10px] ml-3 hover:underline"
              >
                Hapus
              </button>
            )}
          </div>
        </div>

        {/* Name input */}
        <div className="space-y-1">
          <label className="text-[11px] font-black text-neutral-400 uppercase">Nama Panggilan Kamu</label>
          <input
            type="text"
            value={userName}
            onChange={handleNameChange}
            className="w-full text-sm p-2.5 bg-neutral-50 neo-border rounded-md font-extrabold text-neutral-800 focus:outline-none focus:border-[var(--color-accent)]"
            placeholder="cth: Budi, Ani"
          />
        </div>
      </div>

      {/* 2. Kelola Wallet (Dompet) */}
      <div className="bg-[var(--color-surface)] p-4 neo-border rounded-[var(--radius-md)] neo-shadow-sm space-y-4">
        <span className="text-xs font-extrabold uppercase tracking-widest text-neutral-500">
          Kelola Dompet / Wallet
        </span>

        {/* Existing wallets list */}
        <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto">
          {wallets.length === 0 ? (
            <p className="text-xs text-neutral-400 italic">Belum ada wallet.</p>
          ) : (
            wallets.map(w => (
              <div key={w.id} className="p-2.5 bg-neutral-50 border border-neutral-200 rounded-md flex justify-between items-center shadow-xs">
                <div>
                  <div className="text-xs font-extrabold">{w.name}</div>
                  <div className="text-[10px] text-neutral-500 font-bold">{formatRupiah(walletBalances[w.id] || 0)}</div>
                </div>
                <button 
                  onClick={() => handleDeleteWallet(w.id)}
                  className="w-7 h-7 flex items-center justify-center bg-white border border-neutral-300 rounded text-rose-500 hover:bg-rose-50 cursor-pointer"
                  title="Hapus Wallet"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Add wallet form */}
        <form onSubmit={handleAddWallet} className="flex flex-col gap-2 pt-1">
          <input
            type="text"
            value={newWalletName}
            onChange={e => setNewWalletName(e.target.value)}
            className="w-full text-xs p-2.5 bg-neutral-50 neo-border rounded-md font-bold focus:outline-none"
            placeholder="Nama Dompet (cth: BCA, Gopay)"
          />
          <input
            type="number"
            value={newWalletBalance}
            onChange={e => setNewWalletBalance(e.target.value)}
            className="w-full text-xs p-2.5 bg-neutral-50 neo-border rounded-md font-bold focus:outline-none"
            placeholder="Saldo Awal (Opsional)"
          />
          <button 
            type="submit"
            className="neo-btn bg-[var(--color-income)] py-2 text-xs font-black flex justify-center items-center gap-2"
          >
            <Plus size={14} /> Tambah Wallet
          </button>
        </form>
      </div>

      {/* 3. Kategori Custom Manager */}
      <div className="bg-[var(--color-surface)] p-4 neo-border rounded-[var(--radius-md)] neo-shadow-sm space-y-4">
        <span className="text-xs font-extrabold uppercase tracking-widest text-neutral-500">
          Kelola Kategori Transaksi
        </span>

        {/* mini tab switcher for categories */}
        <div className="grid grid-cols-3 gap-1 p-1 bg-neutral-100 neo-border rounded-md">
          <button
            onClick={() => setActiveCatTab('expense')}
            className={`py-1 text-[10px] font-black rounded flex items-center justify-center ${
              activeCatTab === 'expense' ? 'bg-rose-100 text-rose-700 border border-rose-300 font-extrabold' : 'text-neutral-500'
            }`}
          >
            Belanja
          </button>
          <button
            onClick={() => setActiveCatTab('income')}
            className={`py-1 text-[10px] font-black rounded flex items-center justify-center ${
              activeCatTab === 'income' ? 'bg-emerald-100 text-emerald-700 border border-emerald-300 font-extrabold' : 'text-neutral-500'
            }`}
          >
            Masuk
          </button>
          <button
            onClick={() => setActiveCatTab('saving')}
            className={`py-1 text-[10px] font-black rounded flex items-center justify-center ${
              activeCatTab === 'saving' ? 'bg-blue-100 text-blue-700 border border-blue-300 font-extrabold' : 'text-neutral-500'
            }`}
          >
            Nabung
          </button>
        </div>

        {/* Existing categories list */}
        <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto p-1 border border-neutral-200 rounded-md bg-neutral-50">
          {settings.categories[activeCatTab].map(cat => {
            const hasActiveTransactions = transactions.some(tx => tx.category === cat && tx.type === activeCatTab);
            return (
              <div 
                key={cat} 
                className="px-2 py-1 bg-white text-[10px] font-bold rounded neo-border flex items-center gap-1.5 shadow-xs"
              >
                <span>{cat}</span>
                {!hasActiveTransactions && (
                  <button 
                    onClick={() => handleDeleteCategory(cat)}
                    className="text-neutral-400 hover:text-red-500 transition-colors cursor-pointer"
                    title="Hapus Kategori"
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Inline add category form */}
        <form onSubmit={handleAddCategory} className="flex gap-2 pt-1">
          <input
            type="text"
            value={newCategory}
            onChange={e => setNewCategory(e.target.value)}
            className="flex-1 text-xs p-2.5 bg-neutral-50 neo-border rounded-md font-bold focus:outline-none"
            placeholder="Tambah kategori baru..."
          />
          <button 
            type="submit"
            className="neo-btn bg-[var(--color-income)] px-4"
          >
            <Plus size={16} />
          </button>
        </form>
      </div>

      {/* 3. Daily Reminders */}
      <div className="bg-[var(--color-surface)] p-4 neo-border rounded-[var(--radius-md)] neo-shadow-sm space-y-3">
        <span className="text-xs font-extrabold uppercase tracking-widest text-neutral-500">
          Alarm Pengingat Pencatatan
        </span>

        <div className="flex items-center justify-between border-b border-neutral-100 pb-2.5">
          <div>
            <span className="text-xs font-bold block">Status Alarm Pengingat</span>
            <span className="text-[10px] text-neutral-400 font-medium">Kirim notifikasi harian otomatis</span>
          </div>
          <button
            onClick={handleToggleNotifications}
            className={`px-3 py-1.5 text-[10px] font-black rounded-md neo-border cursor-pointer transition-colors ${
              settings.notificationsEnabled 
                ? 'bg-emerald-100 text-emerald-800 border-emerald-400 font-black' 
                : 'bg-neutral-100 text-neutral-500 border-neutral-300'
            }`}
          >
            {settings.notificationsEnabled ? 'AKTIF' : 'NONAKTIF'}
          </button>
        </div>

        <div className="flex items-center justify-between pt-1">
          <div>
            <span className="text-xs font-bold block">Waktu Pengingat</span>
            <span className="text-[10px] text-neutral-400 font-medium">Jam alarm berdering setiap hari</span>
          </div>
          <input
            type="time"
            value={reminderTime}
            onChange={handleReminderChange}
            disabled={!settings.notificationsEnabled}
            className={`p-1.5 text-xs font-bold font-mono neo-border rounded-md focus:outline-none transition-all ${
              settings.notificationsEnabled 
                ? 'bg-white cursor-pointer opacity-100' 
                : 'bg-neutral-100 opacity-40 cursor-not-allowed'
            }`}
          />
        </div>
      </div>

      {/* 4. Data Export and Reset */}
      <div className="bg-[var(--color-surface)] p-4 neo-border rounded-[var(--radius-md)] neo-shadow-sm space-y-4">
        <span className="text-xs font-extrabold uppercase tracking-widest text-neutral-500">Pencadangan & Pemulihan Sistem</span>

        <p className="text-[10px] text-neutral-400 font-bold leading-relaxed">
          Amankan catatan keuanganmu dengan membuat file cadangan JSON penuh, atau ekspor data ke file spreadsheet Excel (.xlsx) yang rapi.
        </p>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={handleFullBackup}
            className="neo-btn py-2.5 text-xs font-black bg-amber-50 hover:bg-amber-100 flex items-center justify-center"
            title="Backup seluruh database"
          >
            Cadangkan Data
          </button>
          
          <div className="relative">
            <input
              type="file"
              id="restore-file-input"
              accept=".json"
              onChange={handleFullRestore}
              className="hidden"
            />
            <label
              htmlFor="restore-file-input"
              className="neo-btn py-2.5 text-xs font-black bg-emerald-50 hover:bg-emerald-100 flex items-center justify-center cursor-pointer w-full"
              title="Restore database dari JSON"
            >
              Pulihkan Data
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 pt-1">
          <button
            onClick={handleExportExcel}
            className="neo-btn py-2 text-xs font-black bg-neutral-50 hover:bg-neutral-100 flex items-center justify-center"
          >
            Ekspor Laporan Excel (.xlsx)
          </button>
        </div>

        <div className="pt-3 border-t border-neutral-150">
          <button
            onClick={() => setShowResetConfirm(true)}
            className="w-full neo-btn py-2.5 text-xs font-black bg-rose-100 text-rose-700 border-rose-400 hover:bg-rose-200 flex items-center justify-center"
          >
            Reset Seluruh Data (Factory Reset)
          </button>
        </div>
      </div>

      {/* NEOMODAL DESTRUCTIVE FACTORY RESET */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm p-5 neo-border rounded-[var(--radius-lg)] neo-shadow-lg space-y-4">
            <div className="text-center space-y-2">
              <div className="inline-flex p-3 bg-rose-100 rounded-full neo-border">
                <AlertTriangle size={32} className="text-rose-600 animate-bounce" />
              </div>
              <h3 className="text-md font-black text-rose-600">Apakah Anda Yakin?</h3>
              <p className="text-xs text-neutral-500 font-bold px-3">
                Tindakan ini permanen. Semua data transaksi keuangan, status harian, dan streak yang dicatat akan dihapus selamanya dari IndexedDB browser.
              </p>
            </div>

            {resetMessage ? (
              <div className="text-center font-mono font-bold text-xs text-rose-500 animate-pulse flex items-center justify-center gap-2">
                <RefreshCw size={12} className="animate-spin" /> {resetMessage}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3.5 pt-2">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="neo-btn py-2 text-xs font-black bg-neutral-100 hover:bg-neutral-200 text-neutral-800"
                >
                  Batal
                </button>
                <button
                  onClick={handleFactoryReset}
                  className="neo-btn py-2 text-xs font-black bg-rose-600 hover:bg-rose-700 text-white border-rose-700"
                >
                  Ya, Hapus Semua!
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
