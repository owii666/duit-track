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

  useEffect(() => {
    gsap.fromTo('#stats-filter',
      { opacity: 0, y: -8 },
      { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' }
    );
  }, [selectedMonth, selectedYear]);

  // 1. Calculate Monthly summaries (selected month vs last month)
  const summaries = useMemo(() => {
    const currentYear = selectedYear;
    const currentMonth = selectedMonth;

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

    return Object.entries(groups)
      .map(([name, amount]) => ({
        name,
        amount,
        percentage: totalExpense > 0 ? Math.round((amount / totalExpense) * 100) : 0
      }))
      .filter(item => item.amount > 0)
      .sort((a, b) => b.amount - a.amount);
  }, [transactions, selectedMonth, selectedYear]);

  const totalExpenseThisMonth = useMemo(() => {
    return categoryExpenses.reduce((sum, item) => sum + item.amount, 0);
  }, [categoryExpenses]);

  // 3. Dynamic Insights Engine
  const insights = useMemo(() => {
    const list = [];
    const { current, last } = summaries;
    const currentMonthLabel = MONTH_NAMES[selectedMonth];
    const lastMonthLabel = MONTH_NAMES[summaries.lastMonthNum];

    if (last.expense > 0) {
      const diffPercent = Math.round(((current.expense - last.expense) / last.expense) * 100);
      if (diffPercent > 10) {
        list.push({
          type: 'warning',
          text: `Perhatian: Pengeluaran bulan ${currentMonthLabel} naik ${diffPercent}% dibanding bulan ${lastMonthLabel}. Kendalikan belanja yang kurang mendesak.`
        });
      } else if (diffPercent < -10) {
        list.push({
          type: 'success',
          text: `Bagus sekali! Pengeluaran bulan ${currentMonthLabel} hemat ${Math.abs(diffPercent)}% dibanding bulan ${lastMonthLabel}. Terus pertahankan pola ini!`
        });
      } else {
        list.push({
          type: 'info',
          text: `Pengeluaran bulan ${currentMonthLabel} relatif stabil dibanding bulan ${lastMonthLabel}. Alur keuangan berjalan terkendali.`
        });
      }
    } else {
      list.push({
        type: 'info',
        text: `Belum ada riwayat di bulan ${lastMonthLabel} untuk pembanding. Catatan baru akan makin lengkap seiring waktu.`
      });
    }

    if (categoryExpenses.length > 0) {
      const topCat = categoryExpenses[0];
      if (topCat.percentage >= 35) {
        list.push({
          type: 'danger',
          text: `Porsi belanja untuk '${topCat.name}' mendominasi ${topCat.percentage}% dari total pengeluaran bulan ini. Evaluasi apakah bisa dihemat.`
        });
      } else {
        list.push({
          type: 'success',
          text: `Distribusi belanja cukup seimbang. Kategori terbesar bulan ini adalah '${topCat.name}' sebesar ${topCat.percentage}%.`
        });
      }
    }

    const income = current.income;
    const saving = current.saving;
    if (income > 0) {
      const saveRate = Math.round((saving / income) * 100);
      if (saveRate >= 20) {
        list.push({
          type: 'success',
          text: `Rasio menabungmu mencapai ${saveRate}%, melampaui target ideal (20%). Fondasi keuanganmu semakin kuat!`
        });
      } else if (saveRate > 0) {
        list.push({
          type: 'warning',
          text: `Rasio menabung saat ini ${saveRate}% dari total pemasukan. Coba alokasikan lebih awal menuju target 20%.`
        });
      }
    }

    return list;
  }, [summaries, categoryExpenses, selectedMonth]);

  // Color palette for top categories
  const getCategoryColor = (idx: number) => {
    const colors = [
      '#1A434E',
      '#C0504D',
      '#285B63',
      '#6B9A91',
      '#C98A2B',
      '#2E7D5B'
    ];
    return colors[idx % colors.length];
  };

  // Render comparative bar chart using clean SVG
  const renderBarChart = () => {
    const maxVal = Math.max(
      summaries.current.income,
      summaries.current.expense,
      summaries.last.income,
      summaries.last.expense,
      1000000
    );

    const scale = (val: number) => (val / maxVal) * 120;
    const lastMonthLabel = `${MONTH_NAMES[summaries.lastMonthNum].slice(0, 3)} '${String(summaries.lastMonthYear).slice(-2)}`;
    const currentMonthLabel = `${MONTH_NAMES[selectedMonth].slice(0, 3)} '${String(selectedYear).slice(-2)}`;

    return (
      <svg className="w-full h-44" viewBox="0 0 320 180">
        {/* Grid lines */}
        <line x1="20" y1="30" x2="300" y2="30" stroke="#E4ECEA" strokeDasharray="3" />
        <line x1="20" y1="85" x2="300" y2="85" stroke="#E4ECEA" strokeDasharray="3" />
        <line x1="20" y1="140" x2="300" y2="140" stroke="#E4ECEA" strokeWidth="1" />

        {/* Last Month Bars */}
        <rect
          x="50"
          y={140 - scale(summaries.last.income)}
          width="22"
          height={scale(summaries.last.income)}
          fill="#2E7D5B"
          opacity="0.45"
          rx="4"
        />
        <rect
          x="78"
          y={140 - scale(summaries.last.expense)}
          width="22"
          height={scale(summaries.last.expense)}
          fill="#C0504D"
          opacity="0.45"
          rx="4"
        />

        {/* This Month Bars */}
        <rect
          x="190"
          y={140 - scale(summaries.current.income)}
          width="22"
          height={scale(summaries.current.income)}
          fill="#2E7D5B"
          rx="4"
        />
        <rect
          x="218"
          y={140 - scale(summaries.current.expense)}
          width="22"
          height={scale(summaries.current.expense)}
          fill="#C0504D"
          rx="4"
        />

        {/* Text Labels */}
        <text x="75" y="160" fontSize="11" fontWeight="600" textAnchor="middle" fill="#718187">{lastMonthLabel}</text>
        <text x="215" y="160" fontSize="11" fontWeight="700" textAnchor="middle" fill="#203238">{currentMonthLabel}</text>
      </svg>
    );
  };

  // Render circular breakdown donut chart
  const renderDonutChart = () => {
    if (categoryExpenses.length === 0) {
      return (
        <div className="text-center py-6 text-xs font-medium text-[var(--color-text-muted)]">
          Belum ada pengeluaran di periode ini.
        </div>
      );
    }

    let accumulatedPercent = 0;

    return (
      <div className="flex flex-col sm:flex-row items-center justify-around gap-5 pt-1">
        {/* SVG Circle */}
        <div className="relative w-32 h-32 mx-auto sm:mx-0 shrink-0">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15.915" fill="none" stroke="#E4ECEA" strokeWidth="4" />

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
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white rounded-full w-22 h-22 m-auto border border-[var(--color-border)] shadow-xs">
            <span className="text-[9px] font-bold uppercase text-[var(--color-text-muted)] tracking-wider">Total</span>
            <span className="text-xs font-bold font-mono text-[var(--color-text-primary)] px-1 text-center truncate">{formatRupiah(totalExpenseThisMonth)}</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-1.5 w-full max-w-[220px] mx-auto sm:mx-0">
          {categoryExpenses.slice(0, 5).map((cat, idx) => (
            <div key={cat.name} className="flex justify-between items-center text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span 
                  className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0" 
                  style={{ backgroundColor: getCategoryColor(idx) }}
                />
                <span className="font-semibold text-[var(--color-text-primary)] truncate">{cat.name}</span>
              </div>
              <span className="font-mono font-medium text-[var(--color-text-secondary)] flex-shrink-0">{cat.percentage}%</span>
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
      <div id="stats-filter" className="bg-white p-3.5 border border-[var(--color-border)] rounded-2xl shadow-xs flex items-center justify-between gap-3">
        <span className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Periode Analisis</span>
        <div className="flex gap-2">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="border border-[var(--color-border)] rounded-xl px-2.5 py-1.5 text-xs font-bold text-[var(--color-text-primary)] bg-white cursor-pointer focus:outline-none focus:border-[var(--color-accent)]"
          >
            {MONTH_NAMES.map((m, idx) => (
              <option key={idx} value={idx}>{m}</option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="border border-[var(--color-border)] rounded-xl px-2.5 py-1.5 text-xs font-bold text-[var(--color-text-primary)] bg-white cursor-pointer focus:outline-none focus:border-[var(--color-accent)]"
          >
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 1. Comparison Chart */}
      <div className="bg-white p-4.5 border border-[var(--color-border)] rounded-2xl shadow-xs space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
            Arus Kas (Masuk vs Belanja)
          </span>
          <div className="flex gap-3 text-[10px] font-semibold">
            <span className="flex items-center gap-1.5 text-[var(--color-income)]">
              <span className="w-2 h-2 rounded-full bg-[var(--color-income)]"></span> Masuk
            </span>
            <span className="flex items-center gap-1.5 text-[var(--color-danger)]">
              <span className="w-2 h-2 rounded-full bg-[var(--color-danger)]"></span> Belanja
            </span>
          </div>
        </div>

        {renderBarChart()}

        <div className="grid grid-cols-2 gap-3 text-center text-xs pt-3 border-t border-[var(--color-border)]">
          <div>
            <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Sisa Bersih Bulan Ini</span>
            <p className="font-bold font-mono text-[var(--color-income)] mt-0.5">
              {formatRupiah(summaries.current.income - summaries.current.expense - summaries.current.saving)}
            </p>
          </div>
          <div>
            <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Total Tabungan Terkumpul</span>
            <p className="font-bold font-mono text-[var(--color-secondary)] mt-0.5">
              {formatRupiah(summaries.current.saving)}
            </p>
          </div>
        </div>
      </div>

      {/* 2. Donut Distribution */}
      <div className="bg-white p-4.5 border border-[var(--color-border)] rounded-2xl shadow-xs space-y-3">
        <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
          Distribusi Belanja Terbesar
        </span>
        {renderDonutChart()}
      </div>

      {/* 3. Horizontal Ranking Bar Charts */}
      <div className="bg-white p-4.5 border border-[var(--color-border)] rounded-2xl shadow-xs space-y-3">
        <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
          Peringkat Kategori Belanja
        </span>

        {categoryExpenses.length === 0 ? (
          <p className="text-xs text-[var(--color-text-muted)] text-center py-4 font-medium">Belum ada catatan pengeluaran.</p>
        ) : (
          <div className="space-y-3 pt-1">
            {categoryExpenses.map((cat, idx) => (
              <div key={cat.name} className="space-y-1">
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span className="text-[var(--color-text-primary)]">{idx + 1}. {cat.name}</span>
                  <span className="font-mono text-[var(--color-text-secondary)]">{formatRupiah(cat.amount)} ({cat.percentage}%)</span>
                </div>
                <div className="w-full h-2 bg-[var(--color-bg)] rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-300"
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
      <div className="bg-white p-4.5 border border-[var(--color-border)] rounded-2xl shadow-xs space-y-3">
        <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
          Analisis & Rekomendasi Finansial
        </span>

        <div className="space-y-2">
          {insights.length === 0 ? (
            <p className="text-xs text-[var(--color-text-muted)] text-center py-2 font-medium">Belum ada analisis untuk periode ini.</p>
          ) : (
            insights.map((insight, idx) => {
              let alertClass = 'bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-text-secondary)]';
              if (insight.type === 'danger') {
                alertClass = 'bg-[var(--color-danger-light)] border-[var(--color-danger-border)] text-[var(--color-danger)]';
              } else if (insight.type === 'warning') {
                alertClass = 'bg-[var(--color-warning-light)] border-[var(--color-warning-border)] text-[var(--color-warning)]';
              } else if (insight.type === 'success') {
                alertClass = 'bg-[var(--color-income-light)] border-[var(--color-income-border)] text-[var(--color-income)]';
              } else if (insight.type === 'info') {
                alertClass = 'bg-[var(--color-saving-light)] border-[var(--color-saving-border)] text-[var(--color-secondary)]';
              }

              return (
                <div 
                  key={idx} 
                  className={`p-3 rounded-xl border text-xs font-medium leading-relaxed ${alertClass}`}
                >
                  {insight.text}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
