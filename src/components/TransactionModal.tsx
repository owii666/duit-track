import React, { useState, useEffect, useRef } from 'react';
import { AppSettings, Transaction, Wallet } from '../types';
import { getWallets } from '../db/indexedDB';
import { formatRupiah, getTodayLocalDateStr } from '../utils/financeHelpers';
import { Check, X, Calendar, Plus, BookOpen, Camera, ShoppingBag, Coins, Bookmark, ArrowRightLeft, Wallet as WalletIcon } from 'lucide-react';
import CategoryIcon from './CategoryIcon';

interface TransactionModalProps {
  type: 'income' | 'expense' | 'saving';
  settings: AppSettings;
  isOpen: boolean;
  onClose: () => void;
  onSave: (tx: Transaction) => void;
}

export default function TransactionModal({
  type: initialType,
  settings,
  isOpen,
  onClose,
  onSave
}: TransactionModalProps) {
  const [activeTab, setActiveTab] = useState<'income' | 'expense' | 'saving' | 'transfer'>(initialType);
  const [amountStr, setAmountStr] = useState('0');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(getTodayLocalDateStr());
  const [photo, setPhoto] = useState<string>('');
  
  // Wallet states
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [walletId, setWalletId] = useState('');
  const [toWalletId, setToWalletId] = useState('');

  const [sparkles, setSparkles] = useState<{ id: number; x: number; y: number; color: string; tx: string; ty: string }[]>([]);
  const submitBtnRef = useRef<HTMLButtonElement>(null);

  // Synced state on open
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialType);
      setAmountStr('0');
      setNote('');
      setSelectedCategory('');
      setDate(getTodayLocalDateStr());
      setPhoto('');
      loadWallets();
    }
  }, [isOpen, initialType]);

  const loadWallets = async () => {
    const dbWallets = await getWallets();
    setWallets(dbWallets);
    if (dbWallets.length > 0) {
      setWalletId(dbWallets[0].id);
      if (dbWallets.length > 1) {
        setToWalletId(dbWallets[1].id);
      } else {
        setToWalletId(dbWallets[0].id);
      }
    }
  };

  // Lock background scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Set default category when tab changes
  useEffect(() => {
    if (activeTab === 'transfer') {
      setSelectedCategory('Transfer');
    } else {
      const cats = settings.categories[activeTab];
      if (cats && cats.length > 0) {
        setSelectedCategory(cats[0]);
      }
    }
  }, [activeTab, settings]);

  if (!isOpen) return null;

  // Custom keypress handlers for neobrutalist keypad
  const handleKeyPress = (val: string) => {
    if (val === 'C') {
      setAmountStr('0');
    } else if (val === 'back') {
      setAmountStr(prev => {
        if (prev.length <= 1) return '0';
        return prev.slice(0, -1);
      });
    } else if (val === '000') {
      setAmountStr(prev => {
        if (prev === '0') return '0';
        if (prev.length >= 10) return prev; // Limit to 10 digits
        return prev + '000';
      });
    } else {
      setAmountStr(prev => {
        if (prev === '0') return val;
        if (prev.length >= 10) return prev; // Limit length
        return prev + val;
      });
    }
  };

  const triggerSparkles = () => {
    if (!submitBtnRef.current) return;
    const rect = submitBtnRef.current.getBoundingClientRect();
    const list = [];
    const colors = ['#FACC15', '#4ADE80', '#60A5FA', '#FB7185', '#C084FC'];

    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 40 + Math.random() * 80;
      const tx = `${Math.cos(angle) * distance}px`;
      const ty = `${Math.sin(angle) * distance - 30}px`;

      list.push({
        id: Date.now() + i,
        x: rect.width / 2 + (Math.random() * 20 - 10),
        y: rect.height / 2 + (Math.random() * 10 - 5),
        color: colors[Math.floor(Math.random() * colors.length)],
        tx,
        ty
      });
    }
    setSparkles(list);

    // Remove sparkles after animation finishes
    setTimeout(() => {
      setSparkles([]);
    }, 850);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseInt(amountStr, 10);
    if (isNaN(amountNum) || amountNum < 0) {
      alert('Masukan nominal jumlah yang valid!');
      return;
    }

    triggerSparkles();

    // Small delay to let user see sparkles then trigger save
    setTimeout(() => {
      onSave({
        type: activeTab,
        amount: amountNum,
        category: selectedCategory || 'Lainnya',
        note: note.trim(),
        date,
        createdAt: Date.now(),
        photo: photo || undefined,
        walletId: (activeTab === 'expense' || activeTab === 'saving' || activeTab === 'transfer' || activeTab === 'income') ? walletId : undefined,
        toWalletId: (activeTab === 'transfer') ? toWalletId : undefined,
      });
    }, 300);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-neutral-900/60 backdrop-blur-xs animate-fade-in">
      {/* Click outside to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Springy slide-up sheet */}
      <div className="bg-[var(--color-surface)] w-full max-w-md p-5 neo-border rounded-t-[var(--radius-lg)] shadow-[0_-8px_30px_rgb(0,0,0,0.12)] z-10 max-h-[92vh] overflow-y-auto relative animate-slide-up select-none">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-extrabold tracking-tight">Catat Transaksi Keuangan</h3>
          <button 
            onClick={onClose}
            className="w-7 h-7 neo-border bg-neutral-100 rounded-full flex items-center justify-center hover:bg-[var(--color-accent)] cursor-pointer text-xs"
          >
            ✕
          </button>
        </div>

        {/* Tab switch */}
        <div className="grid grid-cols-4 gap-1.5 p-1 bg-neutral-100 neo-border rounded-md mb-4">
          <button
            type="button"
            onClick={() => setActiveTab('expense')}
            className={`py-2 text-[10px] font-black rounded-md border-2 transition-all flex flex-col items-center justify-center gap-1 ${
              activeTab === 'expense'
                ? 'bg-[var(--color-expense)] text-neutral-900 border-neutral-900 neo-shadow-sm scale-[1.02]'
                : 'border-transparent text-neutral-500'
            }`}
          >
            <ShoppingBag size={14} /> Belanja
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('income')}
            className={`py-2 text-[10px] font-black rounded-md border-2 transition-all flex flex-col items-center justify-center gap-1 ${
              activeTab === 'income'
                ? 'bg-[var(--color-income)] text-neutral-900 border-neutral-900 neo-shadow-sm scale-[1.02]'
                : 'border-transparent text-neutral-500'
            }`}
          >
            <Coins size={14} /> Masuk
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('saving')}
            className={`py-2 text-[10px] font-black rounded-md border-2 transition-all flex flex-col items-center justify-center gap-1 ${
              activeTab === 'saving'
                ? 'bg-[var(--color-saving)] text-neutral-900 border-neutral-900 neo-shadow-sm scale-[1.02]'
                : 'border-transparent text-neutral-500'
            }`}
          >
            <Bookmark size={14} /> Nabung
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('transfer')}
            className={`py-2 text-[10px] font-black rounded-md border-2 transition-all flex flex-col items-center justify-center gap-1 ${
              activeTab === 'transfer'
                ? 'bg-blue-300 text-neutral-900 border-neutral-900 neo-shadow-sm scale-[1.02]'
                : 'border-transparent text-neutral-500'
            }`}
          >
            <ArrowRightLeft size={14} /> Transfer
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Big Nominal Input Display */}
          <div className="bg-neutral-50 p-4 neo-border rounded-[var(--radius-md)] text-center relative overflow-hidden">
            <span className="text-[10px] font-black tracking-widest text-neutral-400 uppercase">Jumlah Nominal</span>
            <div className="text-3xl font-black font-mono mt-1 text-neutral-900 truncate">
              {formatRupiah(parseInt(amountStr, 10))}
            </div>
          </div>

          {/* Keypad numpad */}
          <div className="grid grid-cols-3 gap-2 p-1 bg-neutral-100 neo-border rounded-lg">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', 'back'].map(k => (
              <button
                key={k}
                type="button"
                onClick={() => handleKeyPress(k)}
                className={`neo-btn h-11 text-lg font-black font-mono ${
                  k === 'back' ? 'bg-orange-100 hover:bg-orange-200 text-orange-700' : 'bg-white text-neutral-900'
                }`}
              >
                {k === 'back' ? '⌫' : k}
              </button>
            ))}
            <button
              type="button"
              onClick={() => handleKeyPress('C')}
              className="neo-btn h-11 text-xs col-span-3 font-black bg-rose-100 text-rose-700 hover:bg-rose-200"
            >
              HAPUS INPUT (CLEAR)
            </button>
          </div>

          {/* Categories Grid */}
          {activeTab !== 'transfer' && (
            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-neutral-400 uppercase tracking-widest">Pilih Kategori</label>
              <div className="border-2 border-neutral-900 rounded-xl p-2.5 bg-neutral-50 shadow-xs">
                <div className="grid grid-cols-3 gap-2 max-h-[140px] overflow-y-auto pr-0.5">
                  {settings.categories[activeTab].map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`py-2 px-1 rounded-md border-2 text-[11px] font-black tracking-tight transition-all text-center truncate ${
                        selectedCategory === cat
                          ? 'bg-[var(--color-accent)] border-neutral-900 text-neutral-900 neo-shadow-sm'
                          : 'bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Wallet Selection */}
          {wallets.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {(activeTab === 'expense' || activeTab === 'saving' || activeTab === 'transfer') && (
                <div className="space-y-1">
                  <label className="text-xs font-extrabold text-neutral-400 uppercase tracking-widest flex items-center gap-1">
                    <WalletIcon size={11} /> Dari Dompet
                  </label>
                  <select
                    value={walletId}
                    onChange={e => setWalletId(e.target.value)}
                    className="w-full text-xs p-2.5 bg-neutral-50 neo-border rounded-md font-bold focus:outline-none focus:border-[var(--color-accent)]"
                  >
                    {wallets.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {(activeTab === 'income' || activeTab === 'transfer') && (
                <div className="space-y-1">
                  <label className="text-xs font-extrabold text-neutral-400 uppercase tracking-widest flex items-center gap-1">
                    <WalletIcon size={11} /> Ke Dompet
                  </label>
                  <select
                    value={activeTab === 'transfer' ? toWalletId : walletId}
                    onChange={e => activeTab === 'transfer' ? setToWalletId(e.target.value) : setWalletId(e.target.value)}
                    className="w-full text-xs p-2.5 bg-neutral-50 neo-border rounded-md font-bold focus:outline-none focus:border-[var(--color-accent)]"
                  >
                    {wallets.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Photo attachment input */}
          <div className="space-y-1">
            <label className="text-xs font-extrabold text-neutral-400 uppercase tracking-widest flex items-center gap-1">
              <Camera size={11} /> Lampiran Foto (Opsional)
            </label>
            <div className="flex items-center gap-3 bg-neutral-50 p-2.5 neo-border rounded-md">
              <div className="w-12 h-12 rounded border-2 border-neutral-950 bg-white flex items-center justify-center overflow-hidden shrink-0">
                {photo ? (
                  <img src={photo} alt="Lampiran" className="w-full h-full object-cover" />
                ) : (
                  <Camera size={18} className="text-neutral-300" />
                )}
              </div>
              <div className="flex-1">
                <input
                  type="file"
                  id="tx-photo-input"
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
                        setPhoto(reader.result as string);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="hidden"
                />
                <label
                  htmlFor="tx-photo-input"
                  className="neo-btn bg-white hover:bg-neutral-50 px-2.5 py-1.5 text-[10px] font-black cursor-pointer"
                >
                  Pilih Foto
                </label>
                {photo && (
                  <button
                    type="button"
                    onClick={() => setPhoto('')}
                    className="text-rose-500 font-bold text-[10px] ml-3 hover:underline"
                  >
                    Hapus
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Note and Date Input */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-extrabold text-neutral-400 uppercase tracking-widest flex items-center gap-1">
                <BookOpen size={11} /> Catatan
              </label>
              <input
                type="text"
                placeholder="cth: Nasi goreng, bonus"
                value={note}
                onChange={e => setNote(e.target.value)}
                className="w-full text-xs p-2.5 bg-neutral-50 neo-border rounded-md font-medium text-neutral-800 focus:outline-none focus:border-[var(--color-accent)]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-extrabold text-neutral-400 uppercase tracking-widest flex items-center gap-1">
                <Calendar size={11} /> Tanggal
              </label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full text-xs p-2.5 bg-neutral-50 neo-border rounded-md font-mono text-neutral-800 focus:outline-none focus:border-[var(--color-accent)]"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            ref={submitBtnRef}
            type="submit"
            className="neo-btn neo-btn-accent w-full py-3 mt-4 text-sm font-black flex items-center justify-center gap-2 relative overflow-hidden"
          >
            <Check size={18} />
            <span>Simpan Transaksi</span>

            {/* Sparkles celebration animation overlay */}
            {sparkles.map(sp => (
              <span
                key={sp.id}
                className="sparkle w-2 h-2 rounded-full"
                style={{
                  left: sp.x,
                  top: sp.y,
                  backgroundColor: sp.color,
                  '--tx': sp.tx,
                  '--ty': sp.ty
                } as React.CSSProperties}
              />
            ))}
          </button>
        </form>
      </div>
    </div>
  );
}
