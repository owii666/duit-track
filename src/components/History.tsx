import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Transaction, AppSettings, TransactionComment, Wallet } from '../types';
import { getWallets, updateTransaction } from '../db/indexedDB';
import { formatRupiah, parseLocalDate } from '../utils/financeHelpers';
import { 
  Search, 
  Trash2, 
  Heart, 
  MessageCircle, 
  Send, 
  Calendar,
  Sparkles
} from 'lucide-react';
import gsap from 'gsap';

interface HistoryProps {
  transactions: Transaction[];
  settings: AppSettings;
  onDeleteTransaction: (id: number) => void;
  onUpdateTransaction?: () => void;
}

interface InstagramCardProps {
  key?: any;
  tx: Transaction;
  userName: string;
  profilePhoto: string;
  wallets: Wallet[];
  onDelete: (id: number) => void;
  onUpdate: (updated: Transaction) => void;
}

const InstagramCard = React.memo(function InstagramCard({ tx, userName, profilePhoto, wallets, onDelete, onUpdate }: InstagramCardProps) {
  const [likes, setLikes] = useState(tx.likes || 0);
  const [isLiked, setIsLiked] = useState(tx.likedByCurrentUser || false);
  const [showHeartAnimation, setShowHeartAnimation] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [showAllComments, setShowAllComments] = useState(false);
  const commentInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLikes(tx.likes || 0);
    setIsLiked(tx.likedByCurrentUser || false);
  }, [tx.likes, tx.likedByCurrentUser]);

  const handleDoubleClick = () => {
    setShowHeartAnimation(true);
    setTimeout(() => setShowHeartAnimation(false), 900);

    if (!isLiked) {
      const nextLiked = true;
      const nextLikes = likes + 1;
      setLikes(nextLikes);
      setIsLiked(nextLiked);

      onUpdate({
        ...tx,
        likes: nextLikes,
        likedByCurrentUser: nextLiked
      });
    }
  };

  const handleLikeToggle = () => {
    const nextLiked = !isLiked;
    const nextLikes = nextLiked ? likes + 1 : Math.max(0, likes - 1);
    setLikes(nextLikes);
    setIsLiked(nextLiked);

    onUpdate({
      ...tx,
      likes: nextLikes,
      likedByCurrentUser: nextLiked
    });
  };

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    const newComment: TransactionComment = {
      id: Date.now().toString(),
      user: userName,
      text: commentText.trim(),
      createdAt: Date.now()
    };

    const updatedComments = [...(tx.comments || []), newComment];
    onUpdate({
      ...tx,
      comments: updatedComments
    });
    setCommentText('');
  };

  const handleFocusComment = () => {
    commentInputRef.current?.focus();
  };

  const getPosterBg = () => {
    if (tx.amount === 0) return 'bg-[var(--color-bg)]';
    if (tx.type === 'income') return 'bg-[var(--color-income-light)]';
    if (tx.type === 'saving') return 'bg-[var(--color-saving-light)]';
    if (tx.type === 'transfer') return 'bg-[var(--color-primary-light)]';
    return 'bg-[var(--color-expense-light)]';
  };

  const getBadgeStyle = () => {
    if (tx.amount === 0) return 'bg-neutral-100 text-[var(--color-text-secondary)] border-[var(--color-border)]';
    if (tx.type === 'income') return 'badge-income';
    if (tx.type === 'saving') return 'badge-saving';
    if (tx.type === 'transfer') return 'bg-[var(--color-primary-light)] text-[var(--color-primary)] border-[#D0E3E6]';
    return 'badge-expense';
  };

  const relativeDate = useMemo(() => {
    const d = parseLocalDate(tx.date);
    if (isNaN(d.getTime())) return 'Baru saja dicatat';
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  }, [tx.date]);

  const walletName = useMemo(() => {
    if (!tx.walletId) return null;
    const w = wallets.find(w => w.id === tx.walletId);
    return w ? w.name : null;
  }, [tx.walletId, wallets]);

  const toWalletName = useMemo(() => {
    if (!tx.toWalletId) return null;
    const w = wallets.find(w => w.id === tx.toWalletId);
    return w ? w.name : null;
  }, [tx.toWalletId, wallets]);

  const visibleComments = useMemo(() => {
    const list = tx.comments || [];
    if (showAllComments) return list;
    return list.slice(-2);
  }, [tx.comments, showAllComments]);

  return (
    <div className="bg-white border border-[var(--color-border)] rounded-2xl overflow-hidden shadow-xs flex flex-col relative select-none hover:border-[var(--color-border-hover)] transition-all">
      
      {/* 1. Header Post */}
      <div className="flex justify-between items-center p-3.5 border-b border-[var(--color-border)] bg-white">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[var(--color-primary-light)] border border-[var(--color-border)] flex items-center justify-center overflow-hidden shrink-0">
            {profilePhoto ? (
              <img src={profilePhoto} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs font-bold text-[var(--color-primary)] uppercase">{userName.charAt(0)}</span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-[var(--color-text-primary)]">{userName}</span>
              <span className={`text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-md border ${getBadgeStyle()}`}>
                {tx.amount === 0 ? 'Check-in' : tx.type === 'income' ? 'Masuk' : tx.type === 'saving' ? 'Nabung' : tx.type === 'transfer' ? 'Transfer' : 'Belanja'}
              </span>
            </div>
            <p className="text-[10px] text-[var(--color-text-muted)] font-medium">{relativeDate}</p>
          </div>
        </div>

        {/* Delete transaction */}
        <button 
          onClick={() => tx.id !== undefined && onDelete(tx.id)}
          className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-light)] rounded-lg transition-colors cursor-pointer"
          title="Hapus Transaksi"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* 2. Media Area (Double-tap enabled) */}
      <div 
        onDoubleClick={handleDoubleClick}
        className="relative overflow-hidden cursor-pointer"
      >
        {tx.photo ? (
          <div className="aspect-square w-full bg-[var(--color-bg)] flex items-center justify-center border-b border-[var(--color-border)]">
            <img src={tx.photo} alt="Catatan keuangan" className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className={`aspect-square w-full flex flex-col justify-between p-6 border-b border-[var(--color-border)] ${getPosterBg()}`}>
            <div>
              <span className="text-[10px] font-bold tracking-wider text-[var(--color-text-muted)] uppercase">Kategori</span>
              <div className="text-lg font-bold mt-0.5 text-[var(--color-text-primary)]">{tx.category}</div>
            </div>

            <div className="my-auto text-center py-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Nominal Transaksi</div>
              <div className={`text-2xl font-extrabold font-mono tracking-tight mt-1 ${
                tx.type === 'expense' ? 'text-[var(--color-danger)]' : 
                tx.type === 'saving' ? 'text-[var(--color-secondary)]' : 'text-[var(--color-income)]'
              }`}>
                {tx.amount === 0 ? 'Rp 0' : tx.type === 'expense' ? '-' : ''}{formatRupiah(tx.amount)}
              </div>
            </div>

            <div className="border-t border-neutral-200/80 pt-3">
              <span className="text-[10px] font-bold tracking-wider text-[var(--color-text-muted)] uppercase block">Catatan</span>
              <p className="text-xs font-semibold text-[var(--color-text-primary)] truncate mt-0.5">
                {tx.note ? `"${tx.note}"` : `Tanpa catatan tambahan`}
              </p>
            </div>
          </div>
        )}

        {/* Heart animation pop-up */}
        {showHeartAnimation && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-xs animate-fade-in pointer-events-none z-20">
            <div className="animate-scale-up-heart p-4 bg-white/95 rounded-full shadow-lg border border-[var(--color-border)]">
              <Heart size={44} className="text-[var(--color-danger)] fill-[var(--color-danger)] animate-pulse" />
            </div>
          </div>
        )}
      </div>

      {/* 3. Action Buttons & Likes Counter */}
      <div className="p-3.5 bg-white flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <button 
            onClick={handleLikeToggle}
            className="transition-transform active:scale-125 focus:outline-none cursor-pointer"
          >
            <Heart 
              size={20} 
              className={isLiked ? "text-[var(--color-danger)] fill-[var(--color-danger)]" : "text-[var(--color-text-primary)] hover:text-[var(--color-danger)]"} 
              strokeWidth={2}
            />
          </button>
          <button 
            onClick={handleFocusComment}
            className="focus:outline-none cursor-pointer text-[var(--color-text-primary)] hover:text-[var(--color-secondary)]"
          >
            <MessageCircle size={20} strokeWidth={2} />
          </button>
        </div>

        {/* Suka Counter */}
        <div className="text-xs font-bold text-[var(--color-text-primary)]">
          {likes > 0 ? `${likes} Suka` : 'Belum ada yang menyukai'}
        </div>

        {/* Caption */}
        <div className="text-xs leading-relaxed text-[var(--color-text-primary)]">
          <span className="font-bold mr-1.5">{userName}</span>
          {tx.amount === 0 ? (
            <span className="text-[var(--color-text-secondary)]">mengonfirmasi kehadiran harian untuk menjaga rekor streak aktif. {tx.note && `(${tx.note})`}</span>
          ) : tx.photo ? (
            <span className="text-[var(--color-text-secondary)]">mencatat transaksi <strong className="font-bold text-[var(--color-text-primary)]">{tx.category}</strong> senilai <strong className="font-mono text-[var(--color-text-primary)]">{formatRupiah(tx.amount)}</strong>
            {walletName && <span> dari {walletName}</span>}
            {toWalletName && <span> ke {toWalletName}</span>}
            . {tx.note && `(${tx.note})`}</span>
          ) : (
            <span className="text-[var(--color-text-secondary)]">mencatat aktivitas <strong className="font-bold text-[var(--color-text-primary)]">{tx.category}</strong>
            {walletName && <span> dari {walletName}</span>}
            {toWalletName && <span> ke {toWalletName}</span>}
            .</span>
          )}
        </div>

        {/* 4. Comments Section */}
        {tx.comments && tx.comments.length > 0 && (
          <div className="mt-1 pt-2 border-t border-[var(--color-border)] space-y-1.5">
            {tx.comments.length > 2 && (
              <button 
                onClick={() => setShowAllComments(!showAllComments)}
                className="text-[11px] font-semibold text-[var(--color-text-muted)] hover:underline block mb-1 cursor-pointer"
              >
                {showAllComments ? 'Sembunyikan sebagian komentar' : `Lihat semua ${tx.comments.length} komentar`}
              </button>
            )}

            <div className="space-y-1">
              {visibleComments.map(c => (
                <div key={c.id} className="text-xs leading-relaxed text-[var(--color-text-secondary)]">
                  <span className="font-bold text-[var(--color-text-primary)] mr-1.5">{c.user}</span>
                  <span>{c.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Comment input form */}
        <form onSubmit={handleCommentSubmit} className="mt-2 flex gap-1.5">
          <input
            ref={commentInputRef}
            type="text"
            placeholder="Tambahkan komentar..."
            value={commentText}
            onChange={e => setCommentText(e.target.value)}
            className="flex-1 text-xs px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl font-medium text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
          />
          <button 
            type="submit"
            className="p-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-xl transition-colors cursor-pointer"
            title="Kirim Komentar"
          >
            <Send size={13} />
          </button>
        </form>
      </div>
    </div>
  );
});

const getLocalDateString = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getHeaderLabel = (dateStr: string) => {
  const today = new Date();
  const todayStr = getLocalDateString(today);
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = getLocalDateString(yesterday);
  
  if (dateStr === todayStr) {
    return 'Hari ini';
  } else if (dateStr === yesterdayStr) {
    return 'Kemarin';
  } else {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const d = parseInt(parts[2], 10);
      return `${d}/${m}/${y}`;
    }
    const d = parseLocalDate(dateStr);
    if (!isNaN(d.getTime())) {
      return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
    }
    return dateStr;
  }
};

export default function History({
  transactions,
  settings,
  onDeleteTransaction,
  onUpdateTransaction
}: HistoryProps) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(4);

  const [userName] = useState(() => localStorage.getItem('finance_user_name') || 'Budi');
  const [profilePhoto] = useState(() => localStorage.getItem('finance_profile_photo') || '');

  const [wallets, setWallets] = useState<Wallet[]>([]);
  useEffect(() => {
    getWallets().then(setWallets).catch(console.error);
  }, []);

  useEffect(() => {
    gsap.fromTo('#history-search',
      { opacity: 0, y: -8 },
      { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' }
    );
  }, [debouncedSearch]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500);

    return () => {
      clearTimeout(handler);
    };
  }, [search]);

  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 150) {
        setVisibleCount(prev => prev + 4);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleUpdate = useCallback(async (updatedTx: Transaction) => {
    try {
      await updateTransaction(updatedTx);
      if (onUpdateTransaction) {
        onUpdateTransaction();
      }
    } catch (err) {
      console.error('Failed to update likes/comments: ', err);
    }
  }, [onUpdateTransaction]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (debouncedSearch.trim()) {
        const query = debouncedSearch.toLowerCase();
        const matchesCategory = t.category.toLowerCase().includes(query);
        const matchesNote = t.note.toLowerCase().includes(query);
        return matchesCategory || matchesNote;
      }
      return true;
    });
  }, [transactions, debouncedSearch]);

  useEffect(() => {
    setVisibleCount(4);
  }, [debouncedSearch]);

  const paginatedTransactions = useMemo(() => {
    return filteredTransactions.slice(0, visibleCount);
  }, [filteredTransactions, visibleCount]);

  return (
    <div className="space-y-4 px-1 py-1">
      {/* Search Input Bar */}
      <div id="history-search" className="relative">
        <input
          type="text"
          placeholder="Cari transaksi (cth: makanan, bonus)..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white text-xs border border-[var(--color-border)] rounded-xl shadow-xs font-medium text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/15 transition-all"
        />
        <Search className="absolute left-3.5 top-3.5 text-[var(--color-text-muted)]" size={16} />
      </div>

      {/* Transaction Feed */}
      {paginatedTransactions.length === 0 ? (
        <div className="bg-white p-10 text-center border border-[var(--color-border)] rounded-2xl shadow-xs">
          <p className="text-xs font-medium text-[var(--color-text-muted)]">Tidak ada aktivitas keuangan yang cocok.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {(() => {
            let lastHeaderLabel = '';
            return paginatedTransactions.map((tx, idx) => {
              const currentHeaderLabel = getHeaderLabel(tx.date);
              const showHeader = currentHeaderLabel !== lastHeaderLabel;
              if (showHeader) {
                lastHeaderLabel = currentHeaderLabel;
              }
              return (
                <React.Fragment key={tx.id || idx}>
                  {showHeader && (
                    <div className="flex items-center justify-center py-1">
                      <span className="bg-white border border-[var(--color-border)] px-3 py-1 rounded-full text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider shadow-xs">
                        {currentHeaderLabel}
                      </span>
                    </div>
                  )}
                  <InstagramCard 
                    tx={tx}
                    userName={userName}
                    profilePhoto={profilePhoto}
                    wallets={wallets}
                    onDelete={onDeleteTransaction}
                    onUpdate={handleUpdate}
                  />
                </React.Fragment>
              );
            });
          })()}

          {/* Show progressive load trigger/indicator if there's more */}
          {filteredTransactions.length > visibleCount && (
            <div className="pt-2 text-center">
              <button 
                onClick={() => setVisibleCount(prev => prev + 4)}
                className="py-2.5 px-4 bg-white hover:bg-[var(--color-bg)] border border-[var(--color-border)] text-xs font-bold text-[var(--color-text-primary)] rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Muat Lebih Banyak Aktivitas
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
