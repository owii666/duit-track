import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Transaction, AppSettings, TransactionComment, Wallet } from '../types';
import { getWallets } from '../db/indexedDB';
import { formatRupiah, parseLocalDate } from '../utils/financeHelpers';
import { 
  Search, 
  Trash2, 
  Heart, 
  MessageCircle, 
  Send, 
  Calendar 
} from 'lucide-react';
import { updateTransaction } from '../db/indexedDB';
import gsap from 'gsap';

interface HistoryProps {
  transactions: Transaction[];
  settings: AppSettings;
  onDeleteTransaction: (id: number) => void;
  onUpdateTransaction?: () => void; // Reload callback
}

// Sub-component for individual Instagram post to keep state isolated
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

  // Keep internal likes state synced when prop updates
  useEffect(() => {
    setLikes(tx.likes || 0);
    setIsLiked(tx.likedByCurrentUser || false);
  }, [tx.likes, tx.likedByCurrentUser]);

  // Handle double click (auto-like)
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

  // Toggle like via Heart Button
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

  // Submit comment
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

  // Determine card design background color for fallback typographic poster
  const getPosterBg = () => {
    if (tx.amount === 0) return 'bg-neutral-50 border-neutral-200';
    if (tx.type === 'income') return 'bg-emerald-50 border-emerald-200';
    if (tx.type === 'saving') return 'bg-blue-50 border-blue-200';
    if (tx.type === 'transfer') return 'bg-blue-50 border-blue-200';
    return 'bg-rose-50 border-rose-200';
  };

  const getPosterTextBadge = () => {
    if (tx.amount === 0) return 'bg-neutral-250 text-neutral-800 border-neutral-400';
    if (tx.type === 'income') return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    if (tx.type === 'saving') return 'bg-blue-100 text-blue-800 border-blue-300';
    if (tx.type === 'transfer') return 'bg-blue-100 text-blue-800 border-blue-300';
    return 'bg-rose-100 text-rose-800 border-rose-300';
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

  // Limit shown comments
  const visibleComments = useMemo(() => {
    const list = tx.comments || [];
    if (showAllComments) return list;
    return list.slice(-2); // last 2 comments
  }, [tx.comments, showAllComments]);

  return (
    <div className="bg-white border-2 border-neutral-900 rounded-xl overflow-hidden neo-shadow-sm flex flex-col relative select-none">
      
      {/* 1. Header Post */}
      <div className="flex justify-between items-center p-3 border-b-2 border-neutral-900 bg-white">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full border-1.5 border-neutral-950 bg-neutral-100 flex items-center justify-center overflow-hidden shrink-0">
            {profilePhoto ? (
              <img src={profilePhoto} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs font-black text-neutral-600 uppercase">{userName.charAt(0)}</span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black text-neutral-900">{userName}</span>
              <span className={`text-[8px] font-black uppercase px-1 rounded border ${getPosterTextBadge()}`}>
                {tx.amount === 0 ? 'Harian' : tx.type === 'income' ? 'Masuk' : tx.type === 'saving' ? 'Nabung' : tx.type === 'transfer' ? 'Transfer' : 'Belanja'}
              </span>
            </div>
            <p className="text-[9px] font-mono text-neutral-400 font-bold">{relativeDate}</p>
          </div>
        </div>

        {/* Delete transaction */}
        <button 
          onClick={() => tx.id !== undefined && onDelete(tx.id)}
          className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
          title="Hapus Transaksi"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* 2. Media Area (Double-tap enabled) */}
      <div 
        onDoubleClick={handleDoubleClick}
        className="relative overflow-hidden cursor-pointer"
      >
        {tx.photo ? (
          /* Case A: Photo uploaded */
          <div className="aspect-square w-full bg-neutral-50 flex items-center justify-center border-b-2 border-neutral-900">
            <img src={tx.photo} alt="Catatan keuangan" className="w-full h-full object-cover" />
          </div>
        ) : (
          /* Case B: Elegant Graphic typographic poster */
          <div className={`aspect-square w-full flex flex-col justify-between p-6 border-b-2 border-neutral-900 ${getPosterBg()}`}>
            <div>
              <span className="text-[9px] font-black tracking-widest text-neutral-400 uppercase">Kategori Transaksi</span>
              <div className="text-lg font-black mt-0.5 text-neutral-900">{tx.category}</div>
            </div>

            <div className="my-auto text-center py-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Jumlah Nominal</div>
              <div className="text-2xl font-black font-mono tracking-tight text-neutral-950 mt-1">
                {tx.amount === 0 ? '' : tx.type === 'expense' ? '-' : ''}{formatRupiah(tx.amount)}
              </div>
            </div>

            <div className="border-t border-dashed border-neutral-300 pt-3">
              <span className="text-[9px] font-black tracking-widest text-neutral-400 uppercase block">Catatan</span>
              <p className="text-xs font-black text-neutral-800 truncate mt-0.5">
                {tx.note ? `"${tx.note}"` : `Tanpa keterangan tambahan`}
              </p>
            </div>
          </div>
        )}

        {/* Big Heart animation pop-up */}
        {showHeartAnimation && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/20 backdrop-blur-xs animate-fade-in pointer-events-none z-20">
            <div className="animate-scale-up-heart p-4 bg-white/95 rounded-full shadow-lg border-2 border-neutral-900">
              <Heart size={48} className="text-rose-500 fill-rose-500 animate-pulse" />
            </div>
          </div>
        )}
      </div>

      {/* 3. Action Buttons & Likes Counter */}
      <div className="p-3 bg-white flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <button 
            onClick={handleLikeToggle}
            className="transition-transform active:scale-125 focus:outline-none"
          >
            <Heart 
              size={20} 
              className={isLiked ? "text-rose-500 fill-rose-500" : "text-neutral-900 hover:text-rose-500"} 
              strokeWidth={2.5}
            />
          </button>
          <button 
            onClick={handleFocusComment}
            className="focus:outline-none"
          >
            <MessageCircle size={20} className="text-neutral-900 hover:text-blue-500" strokeWidth={2.5} />
          </button>
        </div>

        {/* Suka Counter */}
        <div className="text-xs font-black text-neutral-900">
          {likes > 0 ? `${likes} Suka` : 'Belum ada yang menyukai'}
        </div>

        {/* Caption */}
        <div className="text-xs leading-relaxed text-neutral-800">
          <span className="font-black text-neutral-950 mr-1.5">{userName}</span>
          {tx.amount === 0 ? (
            <span>mengonfirmasi kehadiran harian untuk menjaga streak tetap aktif. {tx.note && `(${tx.note})`}</span>
          ) : tx.photo ? (
            <span>mencatat transaksi <strong className="font-black">{tx.category}</strong> senilar <strong className="font-mono text-neutral-900">{formatRupiah(tx.amount)}</strong>
            {walletName && <span className="text-neutral-500"> dari {walletName}</span>}
            {toWalletName && <span className="text-neutral-500"> ke {toWalletName}</span>}
            . {tx.note && `(${tx.note})`}</span>
          ) : (
            <span>mengunggah poster catatan <strong className="font-black">{tx.category}</strong>
            {walletName && <span className="text-neutral-500"> dari {walletName}</span>}
            {toWalletName && <span className="text-neutral-500"> ke {toWalletName}</span>}
            .</span>
          )}
        </div>

        {/* 4. Comments Section */}
        {tx.comments && tx.comments.length > 0 && (
          <div className="mt-1 pt-2 border-t border-neutral-100 space-y-1.5">
            {tx.comments.length > 2 && (
              <button 
                onClick={() => setShowAllComments(!showAllComments)}
                className="text-[10px] font-bold text-neutral-400 hover:underline block mb-1"
              >
                {showAllComments ? 'Sembunyikan sebagian komentar' : `Lihat semua ${tx.comments.length} komentar`}
              </button>
            )}

            <div className="space-y-1">
              {visibleComments.map(c => (
                <div key={c.id} className="text-[11px] leading-relaxed text-neutral-700">
                  <span className="font-extrabold text-neutral-950 mr-1.5">{c.user}</span>
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
            className="flex-1 text-xs px-2.5 py-1.5 bg-neutral-50 border border-neutral-300 rounded-md font-medium text-neutral-800 focus:outline-none focus:border-neutral-900"
          />
          <button 
            type="submit"
            className="p-1.5 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 rounded-md text-neutral-700 hover:text-neutral-900 transition-colors"
          >
            <Send size={12} />
          </button>
        </form>
      </div>
    </div>
  );
});

// Helper to parse local date to YYYY-MM-DD safely
const getLocalDateString = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper to determine date header label
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
      // "YYYY-MM-DD" -> "D/M/YYYY"
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const d = parseInt(parts[2], 10);
      return `${d}/${m}/${y}`;
    }
    // Fallback if formatting is unexpected
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
  
  // Lazy load state: only display visibleCount items first
  const [visibleCount, setVisibleCount] = useState(4);

  const [userName] = useState(() => localStorage.getItem('finance_user_name') || 'Budi');
  const [profilePhoto] = useState(() => localStorage.getItem('finance_profile_photo') || '');

  const [wallets, setWallets] = useState<Wallet[]>([]);
  useEffect(() => {
    getWallets().then(setWallets).catch(console.error);
  }, []);

  // GSAP Entrance Animations
  useEffect(() => {
    gsap.fromTo('#history-search',
      { opacity: 0, y: -10 },
      { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }
    );
    gsap.fromTo('.neo-shadow-sm',
      { opacity: 0, y: 15 },
      { opacity: 1, y: 0, duration: 0.5, stagger: 0.08, ease: 'power2.out', delay: 0.05 }
    );
  }, [debouncedSearch]);

  // Debouncing for 0.5 seconds (500ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500);

    return () => {
      clearTimeout(handler);
    };
  }, [search]);

  // Infinite scroll trigger
  useEffect(() => {
    const handleScroll = () => {
      // Check if we have scrolled near the bottom of the page
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 150) {
        setVisibleCount(prev => prev + 4);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Update transaction likes & comments in IndexedDB - optimized with useCallback
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

  // Filter transaction list purely based on debounced search
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

  // Whenever debouncedSearch changes, reset pagination window back to 4
  useEffect(() => {
    setVisibleCount(4);
  }, [debouncedSearch]);

  // Paginated/Sliced transactions
  const paginatedTransactions = useMemo(() => {
    return filteredTransactions.slice(0, visibleCount);
  }, [filteredTransactions, visibleCount]);

  return (
    <div className="space-y-5 px-1 py-1">
      {/* Search Input Bar */}
      <div id="history-search" className="relative">
        <input
          type="text"
          placeholder="Cari transaksi (cth: makanan, bonus)..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white text-sm border-2 border-neutral-900 rounded-lg neo-shadow-sm font-bold focus:outline-none focus:ring-0 placeholder-neutral-400"
        />
        <Search className="absolute left-3 top-3.5 text-neutral-400" size={16} />
      </div>

      {/* Transaction Feed (Instagram Style) */}
      {paginatedTransactions.length === 0 ? (
        <div className="bg-white p-12 text-center border-2 border-neutral-900 rounded-lg neo-shadow-sm">
          <p className="text-sm font-bold text-neutral-400">Tidak ada aktifitas keuangan yang cocok.</p>
        </div>
      ) : (
        <div className="space-y-6">
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
                    <div className="flex items-center justify-center py-2 animate-fade-in">
                      <span className="bg-neutral-50 border-2 border-neutral-900 px-3.5 py-1.5 rounded-full text-[10px] font-black text-neutral-900 uppercase tracking-widest neo-shadow-xs">
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
                className="neo-btn bg-white hover:bg-neutral-50 text-xs font-black px-4 py-2.5"
              >
                Muat Lebih Banyak Aktifitas...
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
