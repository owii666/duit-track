import React, { useState, useEffect } from 'react';
import { AppSettings, Transaction, Wallet } from '../types';
import { initDB, getTransactions, getGoals, getStreaks, getSettings, getWallets, saveWallet, deleteWallet } from '../db/indexedDB';
import { calculateWalletBalances, formatRupiah } from '../utils/financeHelpers';
import { Download, Upload, AlertTriangle, Check, Plus, Trash2, Bell, RefreshCw, User, Camera, FileSpreadsheet, Wallet as WalletIcon } from 'lucide-react';
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

  useEffect(() => {
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
    if (!confirm('Yakin ingin menghapus dompet ini?')) return;
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

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setUserName(name);
    localStorage.setItem('finance_user_name', name);
    window.dispatchEvent(new Event('user_name_updated'));
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategory.trim()) return;

    const catName = newCategory.trim();
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

  const handleDeleteCategory = (catToDelete: string) => {
    const hasTransactions = transactions.some(tx => tx.category === catToDelete && tx.type === activeCatTab);
    if (hasTransactions) {
      alert(`Kategori "${catToDelete}" tidak bisa dihapus karena masih digunakan dalam beberapa transaksi!`);
      return;
    }

    const updatedList = settings.categories[activeCatTab].filter(c => c !== catToDelete);
    
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

  const handleReminderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = e.target.value;
    setReminderTime(time);
    onUpdateSettings({
      ...settings,
      dailyReminderTime: time
    });
  };

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
        
        if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.ready;
          registration.showNotification('📲 Alarm Duit Track Aktif!', {
            body: `Pengingat harian kamu telah berhasil dijadwalkan pada jam ${reminderTime}!`,
            icon: '/assets/logo.png',
            badge: '/assets/logo.png',
            vibrate: [200, 100, 200]
          } as any);
        } else {
          new Notification('📲 Alarm Duit Track Aktif!', {
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
      link.download = `Backup_Keuangan_DuitTrack_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
    } catch (err) {
      alert('Gagal membuat file cadangan: ' + err);
    }
  };

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

        await onResetAllData();

        const db = await initDB();

        if (parsed.transactions && Array.isArray(parsed.transactions)) {
          const txStore = db.transaction('transactions', 'readwrite').objectStore('transactions');
          for (const t of parsed.transactions) {
            delete t.id;
            txStore.add(t);
          }
        }

        if (parsed.goals && Array.isArray(parsed.goals)) {
          const goalStore = db.transaction('goals', 'readwrite').objectStore('goals');
          for (const g of parsed.goals) {
            goalStore.put(g);
          }
        }

        if (parsed.streaks && Array.isArray(parsed.streaks)) {
          const streakStore = db.transaction('streaks', 'readwrite').objectStore('streaks');
          for (const s of parsed.streaks) {
            streakStore.put(s);
          }
        }

        if (parsed.settings) {
          const settingsStore = db.transaction('settings', 'readwrite').objectStore('settings');
          settingsStore.put(parsed.settings, 'app_settings');
        }

        if (parsed.localStorage) {
          if (parsed.localStorage.finance_user_name) localStorage.setItem('finance_user_name', parsed.localStorage.finance_user_name);
          if (parsed.localStorage.finance_profile_photo) localStorage.setItem('finance_profile_photo', parsed.localStorage.finance_profile_photo);
          if (parsed.localStorage.finance_user_purpose) localStorage.setItem('finance_user_purpose', parsed.localStorage.finance_user_purpose);
          if (parsed.localStorage.finance_onboarding_completed) localStorage.setItem('finance_onboarding_completed', parsed.localStorage.finance_onboarding_completed);
        }

        alert('Selamat! Pemulihan seluruh data cadangan berhasil diselesaikan.');
        window.location.reload();
      } catch (err) {
        alert('Gagal membaca atau memulihkan file cadangan: ' + err);
      } finally {
        setResetMessage('');
      }
    };
    reader.readAsText(file);
  };

  const handleExportExcel = () => {
    try {
      if (transactions.length === 0) {
        alert('Belum ada data transaksi untuk diekspor!');
        return;
      }

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

      const worksheet = XLSX.utils.json_to_sheet(worksheetData);

      const colWidths = [
        { wch: 6 },
        { wch: 14 },
        { wch: 15 },
        { wch: 18 },
        { wch: 20 },
        { wch: 30 },
        { wch: 15 },
        { wch: 24 }
      ];
      worksheet['!cols'] = colWidths;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Laporan Keuangan');

      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Laporan_Keuangan_DuitTrack_${new Date().toISOString().split('T')[0]}.xlsx`);
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Gagal mengekspor laporan ke format Excel: ' + err);
    }
  };

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
      alert('Seluruh data keuangan berhasil di-reset ke pengaturan awal!');
      window.location.reload();
    } catch (err) {
      alert('Gagal mereset data: ' + err);
    }
  };

  return (
    <div className="space-y-4 px-1 py-1">
      {/* 1. Pengaturan Identitas */}
      <div className="bg-white p-4.5 border border-[var(--color-border)] rounded-2xl shadow-xs space-y-4">
        <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
          Profil & Identitas Pengguna
        </span>

        {/* Profile Photo Uploader */}
        <div className="flex items-center gap-4 pb-3 border-b border-[var(--color-border)]">
          <div className="relative w-16 h-16 rounded-full bg-[var(--color-primary-light)] border border-[var(--color-border)] flex items-center justify-center overflow-hidden shrink-0">
            {profilePhoto ? (
              <img src={profilePhoto} alt="Foto Profil" className="w-full h-full object-cover" />
            ) : (
              <User size={24} className="text-[var(--color-primary)]" />
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
              className="px-3 py-1.5 bg-white hover:bg-neutral-50 border border-[var(--color-border)] rounded-lg text-xs font-semibold text-[var(--color-text-primary)] cursor-pointer inline-block transition-colors"
            >
              Pilih Foto Profil
            </label>
            {profilePhoto && (
              <button
                type="button"
                onClick={() => {
                  setProfilePhoto('');
                  localStorage.removeItem('finance_profile_photo');
                  window.dispatchEvent(new Event('profile_photo_updated'));
                }}
                className="text-[var(--color-danger)] font-medium text-xs ml-3 hover:underline cursor-pointer"
              >
                Hapus
              </button>
            )}
          </div>
        </div>

        {/* Name input */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Nama Panggilan</label>
          <input
            type="text"
            value={userName}
            onChange={handleNameChange}
            className="w-full text-xs p-2.5 bg-white border border-[var(--color-border)] rounded-xl font-bold text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
            placeholder="cth: Budi, Ani"
          />
        </div>
      </div>

      {/* 2. Kelola Dompet (Wallet) */}
      <div className="bg-white p-4.5 border border-[var(--color-border)] rounded-2xl shadow-xs space-y-3.5">
        <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
          Kelola Dompet / Akun Bank
        </span>

        {/* Existing wallets list */}
        <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto">
          {wallets.length === 0 ? (
            <p className="text-xs text-[var(--color-text-muted)] italic py-2">Belum ada akun dompet tersimpan.</p>
          ) : (
            wallets.map(w => (
              <div key={w.id} className="p-3 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-white border border-[var(--color-border)] flex items-center justify-center text-[var(--color-primary)]">
                    <WalletIcon size={14} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[var(--color-text-primary)]">{w.name}</div>
                    <div className="text-[11px] font-mono text-[var(--color-text-secondary)] font-medium">{formatRupiah(walletBalances[w.id] || 0)}</div>
                  </div>
                </div>
                <button 
                  onClick={() => handleDeleteWallet(w.id)}
                  className="w-7 h-7 flex items-center justify-center bg-white border border-[var(--color-border)] rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-light)] cursor-pointer transition-colors"
                  title="Hapus Dompet"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Add wallet form */}
        <form onSubmit={handleAddWallet} className="flex flex-col gap-2 pt-1 border-t border-[var(--color-border)]">
          <input
            type="text"
            value={newWalletName}
            onChange={e => setNewWalletName(e.target.value)}
            className="w-full text-xs p-2.5 bg-white border border-[var(--color-border)] rounded-xl font-medium text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
            placeholder="Nama Dompet (cth: BCA, GoPay, Tunai)"
          />
          <input
            type="number"
            value={newWalletBalance}
            onChange={e => setNewWalletBalance(e.target.value)}
            className="w-full text-xs p-2.5 bg-white border border-[var(--color-border)] rounded-xl font-mono text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
            placeholder="Saldo Awal (Opsional)"
          />
          <button 
            type="submit"
            className="w-full py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-xl text-xs font-bold flex justify-center items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
          >
            <Plus size={14} /> Tambah Dompet
          </button>
        </form>
      </div>

      {/* 3. Kategori Custom Manager */}
      <div className="bg-white p-4.5 border border-[var(--color-border)] rounded-2xl shadow-xs space-y-3.5">
        <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
          Kelola Kategori Transaksi
        </span>

        {/* Mini tab switcher */}
        <div className="grid grid-cols-3 gap-1 p-1 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl">
          <button
            onClick={() => setActiveCatTab('expense')}
            className={`py-1.5 text-xs font-bold rounded-lg flex items-center justify-center cursor-pointer transition-all ${
              activeCatTab === 'expense' ? 'bg-[var(--color-danger)] text-white shadow-xs' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            Belanja
          </button>
          <button
            onClick={() => setActiveCatTab('income')}
            className={`py-1.5 text-xs font-bold rounded-lg flex items-center justify-center cursor-pointer transition-all ${
              activeCatTab === 'income' ? 'bg-[var(--color-income)] text-white shadow-xs' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            Masuk
          </button>
          <button
            onClick={() => setActiveCatTab('saving')}
            className={`py-1.5 text-xs font-bold rounded-lg flex items-center justify-center cursor-pointer transition-all ${
              activeCatTab === 'saving' ? 'bg-[var(--color-secondary)] text-white shadow-xs' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            Nabung
          </button>
        </div>

        {/* Existing categories list */}
        <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto p-2 border border-[var(--color-border)] rounded-xl bg-[var(--color-bg)]">
          {settings.categories[activeCatTab].map(cat => {
            const hasActiveTransactions = transactions.some(tx => tx.category === cat && tx.type === activeCatTab);
            return (
              <div 
                key={cat} 
                className="px-2.5 py-1 bg-white text-xs font-semibold text-[var(--color-text-primary)] rounded-lg border border-[var(--color-border)] flex items-center gap-1.5 shadow-xs"
              >
                <span>{cat}</span>
                {!hasActiveTransactions && (
                  <button 
                    onClick={() => handleDeleteCategory(cat)}
                    className="text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-colors cursor-pointer text-xs"
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
            className="flex-1 text-xs p-2.5 bg-white border border-[var(--color-border)] rounded-xl font-medium text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
            placeholder="Tambah kategori baru..."
          />
          <button 
            type="submit"
            className="px-4 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-xl cursor-pointer shadow-xs transition-colors"
          >
            <Plus size={16} />
          </button>
        </form>
      </div>

      {/* 4. Daily Reminders */}
      <div className="bg-white p-4.5 border border-[var(--color-border)] rounded-2xl shadow-xs space-y-3">
        <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
          Pengingat Harian Otomatis
        </span>

        <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
          <div>
            <span className="text-xs font-bold text-[var(--color-text-primary)] block">Status Alarm</span>
            <span className="text-[11px] text-[var(--color-text-secondary)] font-medium">Kirim notifikasi pengingat harian</span>
          </div>
          <button
            onClick={handleToggleNotifications}
            className={`px-3 py-1.5 text-[11px] font-bold rounded-lg border cursor-pointer transition-colors ${
              settings.notificationsEnabled 
                ? 'bg-[var(--color-income-light)] text-[var(--color-income)] border-[var(--color-income-border)]' 
                : 'bg-neutral-100 text-neutral-500 border-neutral-300'
            }`}
          >
            {settings.notificationsEnabled ? 'AKTIF' : 'NONAKTIF'}
          </button>
        </div>

        <div className="flex items-center justify-between pt-1">
          <div>
            <span className="text-xs font-bold text-[var(--color-text-primary)] block">Waktu Pengingat</span>
            <span className="text-[11px] text-[var(--color-text-secondary)] font-medium">Jam alarm dikirimkan setiap hari</span>
          </div>
          <input
            type="time"
            value={reminderTime}
            onChange={handleReminderChange}
            disabled={!settings.notificationsEnabled}
            className={`p-1.5 text-xs font-bold font-mono border border-[var(--color-border)] rounded-xl focus:outline-none transition-all ${
              settings.notificationsEnabled 
                ? 'bg-white cursor-pointer opacity-100' 
                : 'bg-neutral-100 opacity-40 cursor-not-allowed'
            }`}
          />
        </div>
      </div>

      {/* 5. Data Backup and Restore */}
      <div className="bg-white p-4.5 border border-[var(--color-border)] rounded-2xl shadow-xs space-y-3.5">
        <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">Cadangan & Pemulihan Data</span>

        <p className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
          Semua catatan keuangan tersimpan aman secara lokal di perangkatmu. Amankan dengan backup JSON atau ekspor ke file spreadsheet Excel.
        </p>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={handleFullBackup}
            className="py-2.5 px-3 text-xs font-bold bg-white hover:bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors"
            title="Backup seluruh database"
          >
            <Download size={14} /> Cadangkan (JSON)
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
              className="py-2.5 px-3 text-xs font-bold bg-white hover:bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-xl flex items-center justify-center gap-1.5 cursor-pointer w-full shadow-xs transition-colors"
              title="Restore database dari JSON"
            >
              <Upload size={14} /> Pulihkan (JSON)
            </label>
          </div>
        </div>

        <div>
          <button
            onClick={handleExportExcel}
            className="w-full py-2.5 text-xs font-bold bg-[var(--color-income-light)] hover:bg-emerald-100 text-[var(--color-income)] border border-[var(--color-income-border)] rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          >
            <FileSpreadsheet size={15} /> Ekspor Laporan Excel (.xlsx)
          </button>
        </div>

        <div className="pt-3 border-t border-[var(--color-border)]">
          <button
            onClick={() => setShowResetConfirm(true)}
            className="w-full py-2.5 text-xs font-bold bg-[var(--color-danger-light)] hover:bg-red-100 text-[var(--color-danger)] border border-[var(--color-danger-border)] rounded-xl flex items-center justify-center cursor-pointer transition-colors"
          >
            Reset Seluruh Data (Factory Reset)
          </button>
        </div>
      </div>

      {/* MODAL DESTRUCTIVE FACTORY RESET */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white w-full max-w-sm p-6 border border-[var(--color-border)] rounded-2xl shadow-xl space-y-4">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 mx-auto rounded-full bg-[var(--color-danger-light)] text-[var(--color-danger)] flex items-center justify-center">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-base font-bold text-[var(--color-danger)]">Konfirmasi Reset Pabrik</h3>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed px-2">
                Tindakan ini bersifat permanen. Seluruh riwayat transaksi keuangan, target impian, dan data streak akan dibersihkan dari penyimpanan lokal perangkat.
              </p>
            </div>

            {resetMessage ? (
              <div className="text-center font-mono font-bold text-xs text-[var(--color-danger)] animate-pulse flex items-center justify-center gap-2">
                <RefreshCw size={14} className="animate-spin" /> {resetMessage}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="py-2.5 bg-white hover:bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-secondary)] text-xs font-bold rounded-xl cursor-pointer transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleFactoryReset}
                  className="py-2.5 bg-[var(--color-danger)] hover:bg-rose-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs transition-colors"
                >
                  Ya, Hapus Semua
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
