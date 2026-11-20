import React, { useState, useMemo, useEffect } from 'react';
import { Transaction, AppSettings } from '../types';
import { formatRupiah, parseLocalDate } from '../utils/financeHelpers';
import gsap from 'gsap';

interface StatisticsProps {
  transactions: Transaction[];
  settings: AppSettings;
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export default function Statistics({ transactions, settings }: StatisticsProps) {
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());

  // GSAP Entrance Animations
  useEffect(() => {
    gsap.fromTo('#stats-filter',
      { opacity: 0, y: -10 },
      { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }
    );
    gsap.fromTo('.neo-card, .stats-card',
      { opacity: 0, y: 15 },
      { opacity: 1, y: 0, duration: 0.5, stagger: 0.08, ease: 'power2.out', delay: 0.1 }
    );
  }, [selectedMonth, selectedYear]);

  // 1. Calculate Monthly summaries (selected month vs last month)
  const summaries = useMemo(() => {
    const currentYear = selectedYear;
    const currentMonth = selectedMonth;

    // Last month calculation
    const lastMonthDate = new Date(currentYear, currentMonth - 1, 1);
    const lastMonthYear = lastMonthDate.getFullYear();
    const lastMonthNum = lastMonthDate.getMonth();

    let thisMonthIncome = 0;
    let thisMonthExpense = 0;
    let thisMonthSaving = 0;

    let lastMonthIncome = 0;
    let lastMonthExpense = 0;
    let lastMonthSaving = 0;

    transactions.forEach(t => {
      const tDate = parseLocalDate(t.date);
      if (tDate.getFullYear() === currentYear && tDate.getMonth() === currentMonth) {
        if (t.type === 'income') thisMonthIncome += t.amount;
        else if (t.type === 'expense') thisMonthExpense += t.amount;
        else if (t.type === 'saving') thisMonthSaving += t.amount;
      } else if (tDate.getFullYear() === lastMonthYear && tDate.getMonth() === lastMonthNum) {
        if (t.type === 'income') lastMonthIncome += t.amount;
        else if (t.type === 'expense') lastMonthExpense += t.amount;
        else if (t.type === 'saving') lastMonthSaving += t.amount;
      }
    });

    return {
      current: { income: thisMonthIncome, expense: thisMonthExpense, saving: thisMonthSaving },
      last: { income: lastMonthIncome, expense: lastMonthExpense, saving: lastMonthSaving },
      lastMonthNum,
      lastMonthYear
    };
  }, [transactions, selectedMonth, selectedYear]);

  // 2. Group expenses by category
  const categoryExpenses = useMemo(() => {
    const groups: Record<string, number> = {};
    let totalExpense = 0;

    transactions.forEach(t => {
      const tDate = parseLocalDate(t.date);
      if (t.type === 'expense' && tDate.getFullYear() === selectedYear && tDate.getMonth() === selectedMonth) {
        groups[t.category] = (groups[t.category] || 0) + t.amount;
        totalExpense += t.amount;
      }
    });

    // Sort descending
    return Object.entries(groups)
      .map(([name, amount]) => ({
        name,
        amount,
        percentage: totalExpense > 0 ? Math.round((amount / totalExpense) * 100) : 0
      }))
      .filter(item => item.amount > 0) // Filter out 0-amount entries/attendance check-ins
      .sort((a, b) => b.amount - a.amount);
  }, [transactions, selectedMonth, selectedYear]);

  // Total expense for percentage calculations
  const totalExpenseThisMonth = useMemo(() => {
    return categoryExpenses.reduce((sum, item) => sum + item.amount, 0);
  }, [categoryExpenses]);

  // 3. Dynamic Insights Engine
  const insights = useMemo(() => {
    const list = [];
    const { current, last } = summaries;
    const currentMonthLabel = MONTH_NAMES[selectedMonth];
    const lastMonthLabel = MONTH_NAMES[summaries.lastMonthNum];

    // Insight: Expense comparison
    if (last.expense > 0) {
      const diffPercent = Math.round(((current.expense - last.expense) / last.expense) * 100);
      if (diffPercent > 10) {
        list.push({
          type: 'warning',
          text: `Awas! Belanja kamu di bulan ${currentMonthLabel} naik ${diffPercent}% dibanding bulan ${lastMonthLabel}. Saatnya dikurangi.`
        });
      } else if (diffPercent < -10) {
        list.push({
          type: 'success',
          text: `Hebat! Belanja bulan ${currentMonthLabel} turun ${Math.abs(diffPercent)}% dibanding bulan ${lastMonthLabel}. Disiplinmu luar biasa!`
        });
      } else {
        list.push({
          type: 'info',
          text: `Belanja kamu di bulan ${currentMonthLabel} cukup stabil dibanding bulan ${lastMonthLabel}. Pertahankan kestabilan anggaranmu!`
        });
      }
    } else {
      list.push({
        type: 'info',
        text: `Belum ada data bulan ${lastMonthLabel} untuk perbandingan. Terus mencatat transaksi ya!`
      });
    }

    // Insight: Dominant category
    if (categoryExpenses.length > 0) {
      const topCat = categoryExpenses[0];
      if (topCat.percentage >= 35) {
        list.push({
          type: 'danger',
          text: `Porsi belanja untuk '${topCat.name}' di bulan ${currentMonthLabel} sangat tinggi (${topCat.percentage}% dari total pengeluaran). Coba cari alternatif hemat.`
        });
      } else {
        list.push({
          type: 'success',
          text: `Distribusi pengeluaranmu cukup sehat. Belanja terbesarmu di bulan ${currentMonthLabel} ada di kategori '${topCat.name}'.`
        });
      }
    }

    // Insight: Savings Rate
    const income = current.income;
    const saving = current.saving;
    if (income > 0) {
      const saveRate = Math.round((saving / income) * 100);
      if (saveRate >= 20) {
        list.push({
          type: 'success',
          text: `Rasio menabungmu di bulan ${currentMonthLabel} adalah ${saveRate}%, melampaui anjuran sehat (20%). Masa depanmu aman!`
        });
      } else if (saveRate > 0) {
        list.push({
          type: 'warning',
          text: `Rasio menabungmu di bulan ${currentMonthLabel} ${saveRate}% dari total pemasukan. Yuk coba genjot lagi ke target 20%!`
        });
      }
    }

    return list;
  }, [summaries, categoryExpenses, selectedMonth]);

  // Color mapper helper for top categories
  const getCategoryColor = (idx: number) => {
    const colors = [
      'var(--color-expense)',
      'var(--color-accent)',
      'var(--color-saving)',
      'var(--color-income)',
      '#C084FC' // purple
    ];
    return colors[idx % colors.length];
  };

  // Render comparative bar chart using plain SVG
  const renderBarChart = () => {
    const maxVal = Math.max(
      summaries.current.income,
      summaries.current.expense,
      summaries.last.income,
      summaries.last.expense,
      1000000 // default minimum scale
    );

    const scale = (val: number) => (val / maxVal) * 130; // height inside 160px container
    const lastMonthLabel = `${MONTH_NAMES[summaries.lastMonthNum].slice(0, 3)} '${String(summaries.lastMonthYear).slice(-2)}`;
    const currentMonthLabel = `${MONTH_NAMES[selectedMonth].slice(0, 3)} '${String(selectedYear).slice(-2)}`;

    return (
      <svg className="w-full h-44 border-b-2 border-neutral-900" viewBox="0 0 320 180">
        {/* Grid lines */}
        <line x1="20" y1="20" x2="300" y2="20" stroke="#E5E7EB" strokeDasharray="3" />
        <line x1="20" y1="80" x2="300" y2="80" stroke="#E5E7EB" strokeDasharray="3" />
        <line x1="20" y1="140" x2="300" y2="140" stroke="#E5E7EB" strokeDasharray="3" />

        {/* Axis line */}
        <line x1="20" y1="150" x2="300" y2="150" stroke="#171717" strokeWidth="2" />

        {/* Last Month Bars */}
        {/* Income */}
        <rect
          x="45"
          y={150 - scale(summaries.last.income)}
          width="24"
          height={scale(summaries.last.income)}
          fill="var(--color-income)"
          opacity="0.6"
          stroke="#171717"
          strokeWidth="2.5"
          rx="2"
        />
        {/* Expense */}
        <rect
          x="75"
          y={150 - scale(summaries.last.expense)}
          width="24"
          height={scale(summaries.last.expense)}
          fill="var(--color-expense)"
          opacity="0.6"
          stroke="#171717"
          strokeWidth="2.5"
          rx="2"
        />

        {/* This Month Bars */}
        {/* Income */}
        <rect
          x="185"
          y={150 - scale(summaries.current.income)}
          width="24"
          height={scale(summaries.current.income)}
          fill="var(--color-income)"
          stroke="#171717"
          strokeWidth="2.5"
          rx="2"
        />
        {/* Expense */}
        <rect
          x="215"
          y={150 - scale(summaries.current.expense)}
          width="24"
          height={scale(summaries.current.expense)}
          fill="var(--color-expense)"
          stroke="#171717"
          strokeWidth="2.5"
          rx="2"
        />

        {/* Text Labels */}
        <text x="72" y="168" fontSize="10" fontWeight="bold" textAnchor="middle" fill="#9CA3AF">{lastMonthLabel}</text>
        <text x="212" y="168" fontSize="10" fontWeight="bold" textAnchor="middle" fill="#171717">{currentMonthLabel}</text>
      </svg>
    );
  };

  // Render circular breakdown donut chart using simple customized SVG slices
  const renderDonutChart = () => {
    if (categoryExpenses.length === 0) {
      return (
        <div className="text-center py-6 text-xs font-bold text-neutral-400">
          Belum ada pengeluaran di periode ini.
        </div>
      );
    }

    let accumulatedPercent = 0;

    return (
      <div className="flex flex-col sm:flex-row items-center justify-around gap-5 pt-2">
        {/* SVG Circle */}
        <div className="relative w-32 h-32 mx-auto sm:mx-0 shrink-0">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
            {/* Base circle background */}
            <circle cx="18" cy="18" r="15.915" fill="none" stroke="#E5E7EB" strokeWidth="4" />

            {/* Slices */}
            {categoryExpenses.map((cat, idx) => {
              const dashArray = `${cat.percentage} ${100 - cat.percentage}`;
              const dashOffset = 100 - accumulatedPercent;
              accumulatedPercent += cat.percentage;

              return (
                <circle
                  key={cat.name}
                  cx="18"
                  cy="18"
                  r="15.915"
                  fill="none"
                  stroke={getCategoryColor(idx)}
                  strokeWidth="4"
                  strokeDasharray={dashArray}
                  strokeDashoffset={dashOffset}
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white rounded-full w-24 h-24 m-auto neo-border">
            <span className="text-[9px] font-black uppercase text-neutral-400 tracking-wider">Total</span>
            <span className="text-xs font-black font-mono text-neutral-900">{formatRupiah(totalExpenseThisMonth)}</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-1.5 w-full max-w-[220px] mx-auto sm:mx-0">
          {categoryExpenses.slice(0, 5).map((cat, idx) => (
            <div key={cat.name} className="flex justify-between items-center text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <span 
                  className="w-2.5 h-2.5 rounded neo-border inline-block flex-shrink-0" 
                  style={{ backgroundColor: getCategoryColor(idx) }}
                />
                <span className="font-extrabold text-neutral-800 truncate">{cat.name}</span>
              </div>
              <span className="font-mono font-bold text-neutral-500 flex-shrink-0">{cat.percentage}%</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];
  }, []);

  return (
    <div className="space-y-4 px-1 py-1">
      {/* Period Selection Dropdown Header */}
      <div id="stats-filter" className="bg-white p-3.5 neo-border rounded-[var(--radius-md)] neo-shadow-sm flex items-center justify-between gap-3">
        <span className="text-xs font-black text-neutral-500 uppercase tracking-widest">Periode Analisa</span>
        <div className="flex gap-2">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="neo-border rounded-md px-2.5 py-1.5 text-xs font-black bg-white cursor-pointer focus:outline-none focus:bg-yellow-50"
          >
            {MONTH_NAMES.map((m, idx) => (
              <option key={idx} value={idx}>{m}</option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="neo-border rounded-md px-2.5 py-1.5 text-xs font-black bg-white cursor-pointer focus:outline-none focus:bg-yellow-50"
          >
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 1. Comparison Chart */}
      <div className="bg-[var(--color-surface)] p-4 neo-border rounded-[var(--radius-md)] neo-shadow-sm space-y-3 stats-card">
        <div className="flex justify-between items-center">
          <span className="text-xs font-extrabold uppercase tracking-widest text-neutral-500 flex items-center gap-1">
            Arus Keuangan (Masuk vs Belanja)
          </span>
          <div className="flex gap-2.5 text-[9px] font-bold">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded bg-[var(--color-income)]"></span> Masuk
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded bg-[var(--color-expense)]"></span> Belanja
            </span>
          </div>
        </div>

        {renderBarChart()}

        <div className="grid grid-cols-2 gap-3 text-center text-xs mt-2 pt-2 border-t border-neutral-200">
          <div>
            <span className="text-[10px] font-bold text-neutral-400 uppercase">Tabungan Bulan Ini</span>
            <p className="font-black font-mono text-emerald-600 mt-0.5">
              {formatRupiah(summaries.current.income - summaries.current.expense - summaries.current.saving)}
            </p>
          </div>
          <div>
            <span className="text-[10px] font-bold text-neutral-400 uppercase">Total Saving Terkunci</span>
            <p className="font-black font-mono text-blue-500 mt-0.5">
              {formatRupiah(summaries.current.saving)}
            </p>
          </div>
        </div>
      </div>

      {/* 2. Donut Distribution */}
      <div className="bg-[var(--color-surface)] p-4 neo-border rounded-[var(--radius-md)] neo-shadow-sm space-y-3 stats-card">
        <span className="text-xs font-extrabold uppercase tracking-widest text-neutral-500 flex items-center gap-1">
          Distribusi Belanja Terbesar
        </span>
        {renderDonutChart()}
      </div>

      {/* 3. Horizontal Ranking Bar Charts */}
      <div className="bg-[var(--color-surface)] p-4 neo-border rounded-[var(--radius-md)] neo-shadow-sm space-y-3 stats-card">
        <span className="text-xs font-extrabold uppercase tracking-widest text-neutral-500 flex items-center gap-1">
          Rangking Kategori Belanja
        </span>

        {categoryExpenses.length === 0 ? (
          <p className="text-xs text-neutral-400 text-center py-4 font-bold">Belum ada pengeluaran.</p>
        ) : (
          <div className="space-y-3 pt-1">
            {categoryExpenses.map((cat, idx) => (
              <div key={cat.name} className="space-y-1">
                <div className="flex justify-between items-center text-xs font-bold">
                  <span>{idx + 1}. {cat.name}</span>
                  <span className="font-mono text-neutral-500">{formatRupiah(cat.amount)} ({cat.percentage}%)</span>
                </div>
                <div className="w-full h-3.5 bg-neutral-100 neo-border rounded-md overflow-hidden">
                  <div 
                    className="h-full rounded-l transition-all duration-300"
                    style={{ 
                       width: `${cat.percentage}%`,
                       backgroundColor: getCategoryColor(idx)
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Automated Insights Card */}
      <div className="bg-[var(--color-surface)] p-4 neo-border rounded-[var(--radius-md)] neo-shadow-sm space-y-3 stats-card">
        <span className="text-xs font-extrabold uppercase tracking-widest text-neutral-500 flex items-center gap-1">
          Analisa & Solusi Keuangan
        </span>

        <div className="space-y-2">
          {insights.length === 0 ? (
            <p className="text-xs text-neutral-400 text-center py-2 font-bold">Belum ada analisa untuk periode ini.</p>
          ) : (
            insights.map((insight, idx) => (
              <div 
                key={idx} 
                className={`p-3 rounded-md neo-border text-xs font-bold ${
                  insight.type === 'danger' ? 'bg-rose-100 border-rose-300 text-rose-800' :
                  insight.type === 'warning' ? 'bg-yellow-50 border-yellow-300 text-yellow-800' :
                  insight.type === 'success' ? 'bg-emerald-50 border-emerald-300 text-emerald-800' :
                  'bg-blue-50 border-blue-300 text-blue-800'
                }`}
              >
                {insight.text}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
