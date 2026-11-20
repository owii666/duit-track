import React, { useState, useEffect, useRef } from 'react';
import { AppSettings, Transaction, Wallet } from '../types';
import { getWallets } from '../db/indexedDB';
import { formatRupiah, getTodayLocalDateStr } from '../utils/financeHelpers';
import { Check, X, Calendar, Plus, BookOpen, Camera, ShoppingBag, Coins, Bookmark, ArrowRightLeft, Wallet as WalletIcon } from 'lucide-react';
import CategoryIcon from './CategoryIcon';

interface TransactionModalProps {
  type: 'income' | 'expense' | 'saving' | 'transfer';
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

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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
        if (prev.length >= 10) return prev;
        return prev + '000';
      });
    } else {
      setAmountStr(prev => {
        if (prev === '0') return val;
        if (prev.length >= 10) return prev;
        return prev + val;
      });
    }
  };

  const triggerSparkles = () => {
    if (!submitBtnRef.current) return;
    const rect = submitBtnRef.current.getBoundingClientRect();
    const list = [];
    const colors = ['#1A434E', '#2E7D5B', '#6B9A91', '#285B63', '#C98A2B'];

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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-xs animate-fade-in">
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modern Slide-Up Bottom Sheet */}
      <div className="bg-white w-full max-w-md p-5 border-t border-[var(--color-border)] rounded-t-3xl shadow-2xl z-10 max-h-[92vh] overflow-y-auto relative animate-slide-up select-none">
        
        {/* Handle bar indicator */}
        <div className="w-10 h-1 bg-neutral-300 rounded-full mx-auto mb-3" />

        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-bold text-[var(--color-text-primary)]">Catat Transaksi Keuangan</h3>
          <button 
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-[var(--color-bg)] hover:bg-neutral-200 text-[var(--color-text-secondary)] flex items-center justify-center cursor-pointer text-xs transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tab switch */}
        <div className="grid grid-cols-4 gap-1.5 p-1 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl mb-4">
          <button
            type="button"
            onClick={() => setActiveTab('expense')}
            className={`py-2 text-[11px] font-bold rounded-lg transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
              activeTab === 'expense'
                ? 'bg-[var(--color-danger)] text-white shadow-xs'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            <ShoppingBag size={14} /> Belanja
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('income')}
            className={`py-2 text-[11px] font-bold rounded-lg transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
              activeTab === 'income'
                ? 'bg-[var(--color-income)] text-white shadow-xs'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            <Coins size={14} /> Masuk
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('saving')}
            className={`py-2 text-[11px] font-bold rounded-lg transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
              activeTab === 'saving'
                ? 'bg-[var(--color-secondary)] text-white shadow-xs'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            <Bookmark size={14} /> Nabung
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('transfer')}
            className={`py-2 text-[11px] font-bold rounded-lg transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
              activeTab === 'transfer'
                ? 'bg-[var(--color-primary)] text-white shadow-xs'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            <ArrowRightLeft size={14} /> Transfer
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Big Nominal Input Display */}
          <div className="bg-[var(--color-bg)] p-4 border border-[var(--color-border)] rounded-2xl text-center relative overflow-hidden">
            <span className="text-[10px] font-bold tracking-wider text-[var(--color-text-muted)] uppercase">Nominal Transaksi</span>
            <div className="text-3xl font-extrabold font-mono mt-1 text-[var(--color-text-primary)] truncate">
              {formatRupiah(parseInt(amountStr, 10))}
            </div>
          </div>

          {/* Modern Keypad Numpad */}
          <div className="grid grid-cols-3 gap-2 p-1.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-2xl">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', 'back'].map(k => (
              <button
                key={k}
                type="button"
                onClick={() => handleKeyPress(k)}
                className={`h-11 rounded-xl text-base font-bold font-mono border transition-all cursor-pointer shadow-xs active:scale-95 ${
                  k === 'back' 
                    ? 'bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-200' 
                    : 'bg-white hover:bg-neutral-50 text-[var(--color-text-primary)] border-[var(--color-border)]'
                }`}
              >
                {k === 'back' ? '⌫' : k}
              </button>
            ))}
            <button
              type="button"
              onClick={() => handleKeyPress('C')}
              className="h-10 text-xs col-span-3 font-semibold bg-white hover:bg-red-50 text-[var(--color-danger)] border border-[var(--color-border)] rounded-xl cursor-pointer transition-colors active:scale-98"
            >
              Hapus Nominal (Clear)
            </button>
          </div>

          {/* Categories Grid */}
          {activeTab !== 'transfer' && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Pilih Kategori</label>
              <div className="border border-[var(--color-border)] rounded-2xl p-2.5 bg-[var(--color-bg)]">
                <div className="grid grid-cols-3 gap-2 max-h-[140px] overflow-y-auto pr-0.5">
                  {settings.categories[activeTab].map(cat => {
                    const isSelected = selectedCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCategory(cat)}
                        className={`py-2 px-2 rounded-xl text-[11px] font-semibold tracking-tight transition-all text-center truncate cursor-pointer ${
                          isSelected
                            ? 'bg-[var(--color-primary)] text-white shadow-xs'
                            : 'bg-white border border-[var(--color-border)] text-[var(--color-text-primary)] hover:border-[var(--color-border-hover)]'
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Wallet Selection */}
          {wallets.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {(activeTab === 'expense' || activeTab === 'saving' || activeTab === 'transfer') && (
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider flex items-center gap-1">
                    <WalletIcon size={12} /> Dari Dompet
                  </label>
                  <select
                    value={walletId}
                    onChange={e => setWalletId(e.target.value)}
                    className="w-full text-xs p-2.5 bg-white border border-[var(--color-border)] rounded-xl font-medium text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
                  >
                    {wallets.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {(activeTab === 'income' || activeTab === 'transfer') && (
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider flex items-center gap-1">
                    <WalletIcon size={12} /> Ke Dompet
                  </label>
                  <select
                    value={activeTab === 'transfer' ? toWalletId : walletId}
                    onChange={e => activeTab === 'transfer' ? setToWalletId(e.target.value) : setWalletId(e.target.value)}
                    className="w-full text-xs p-2.5 bg-white border border-[var(--color-border)] rounded-xl font-medium text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
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
            <label className="text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider flex items-center gap-1">
              <Camera size={12} /> Lampiran Struk / Foto (Opsional)
            </label>
            <div className="flex items-center gap-3 bg-[var(--color-bg)] p-2.5 border border-[var(--color-border)] rounded-xl">
              <div className="w-12 h-12 rounded-xl border border-[var(--color-border)] bg-white flex items-center justify-center overflow-hidden shrink-0">
                {photo ? (
                  <img src={photo} alt="Lampiran" className="w-full h-full object-cover" />
                ) : (
                  <Camera size={18} className="text-[var(--color-text-muted)]" />
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
                  className="px-3 py-1.5 bg-white hover:bg-neutral-50 border border-[var(--color-border)] rounded-lg text-xs font-semibold text-[var(--color-text-primary)] cursor-pointer inline-block transition-colors"
                >
                  Pilih Foto
                </label>
                {photo && (
                  <button
                    type="button"
                    onClick={() => setPhoto('')}
                    className="text-[var(--color-danger)] font-medium text-xs ml-3 hover:underline cursor-pointer"
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
              <label className="text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider flex items-center gap-1">
                <BookOpen size={12} /> Catatan
              </label>
              <input
                type="text"
                placeholder="cth: Nasi goreng, bonus"
                value={note}
                onChange={e => setNote(e.target.value)}
                className="w-full text-xs p-2.5 bg-white border border-[var(--color-border)] rounded-xl font-medium text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider flex items-center gap-1">
                <Calendar size={12} /> Tanggal
              </label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full text-xs p-2.5 bg-white border border-[var(--color-border)] rounded-xl font-mono text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            ref={submitBtnRef}
            type="submit"
            className="w-full py-3.5 mt-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 relative overflow-hidden shadow-md cursor-pointer transition-all active:scale-[0.99]"
          >
            <Check size={18} />
            <span>Simpan Transaksi</span>

            {/* Sparkles animation overlay */}
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
