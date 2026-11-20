import React from 'react';
import * as Icons from 'lucide-react';

interface CategoryIconProps {
  category: string;
  className?: string;
  size?: number;
}

export default function CategoryIcon({ category, className = '', size = 16 }: CategoryIconProps) {
  const normalized = category.trim().toLowerCase();

  let IconComponent: React.ComponentType<any> = Icons.Tag;

  if (normalized.includes('makan') || normalized.includes('restoran') || normalized.includes('kafe') || normalized.includes('kuliner')) {
    IconComponent = Icons.Utensils;
  } else if (normalized.includes('transport') || normalized.includes('bensin') || normalized.includes('ojek') || normalized.includes('mobil') || normalized.includes('motor')) {
    IconComponent = Icons.Car;
  } else if (normalized.includes('belanja') || normalized.includes('mall') || normalized.includes('baju') || normalized.includes('supermarket')) {
    IconComponent = Icons.ShoppingBag;
  } else if (normalized.includes('hiburan') || normalized.includes('nonton') || normalized.includes('game') || normalized.includes('bioskop')) {
    IconComponent = Icons.Gamepad2;
  } else if (normalized.includes('tagihan') || normalized.includes('listrik') || normalized.includes('air') || normalized.includes('wifi') || normalized.includes('pulsa')) {
    IconComponent = Icons.CreditCard;
  } else if (normalized.includes('kesehatan') || normalized.includes('dokter') || normalized.includes('obat') || normalized.includes('klinik') || normalized.includes('rs')) {
    IconComponent = Icons.HeartPulse;
  } else if (normalized.includes('pendidikan') || normalized.includes('sekolah') || normalized.includes('buku') || normalized.includes('kuliah') || normalized.includes('kursus')) {
    IconComponent = Icons.GraduationCap;
  } else if (normalized.includes('gaji') || normalized.includes('gajian') || normalized.includes('kantor') || normalized.includes('utama')) {
    IconComponent = Icons.Briefcase;
  } else if (normalized.includes('sampingan') || normalized.includes('freelance') || normalized.includes('tips')) {
    IconComponent = Icons.Zap;
  } else if (normalized.includes('investasi') || normalized.includes('saham') || normalized.includes('reksadana')) {
    IconComponent = Icons.TrendingUp;
  } else if (normalized.includes('hadiah') || normalized.includes('kado') || normalized.includes('bonus')) {
    IconComponent = Icons.Gift;
  } else if (normalized.includes('tabungan') || normalized.includes('saving') || normalized.includes('simpan')) {
    IconComponent = Icons.PiggyBank;
  } else if (normalized.includes('dana darurat') || normalized.includes('aman') || normalized.includes('darurat')) {
    IconComponent = Icons.ShieldAlert;
  } else if (normalized.includes('liburan') || normalized.includes('wisata') || normalized.includes('hotel') || normalized.includes('jalan')) {
    IconComponent = Icons.Compass;
  } else if (normalized.includes('laptop') || normalized.includes('komputer') || normalized.includes('gadget') || normalized.includes('hp')) {
    IconComponent = Icons.Laptop;
  } else if (normalized.includes('kost') || normalized.includes('sewa') || normalized.includes('rumah')) {
    IconComponent = Icons.Home;
  } else if (normalized.includes('transfer')) {
    IconComponent = Icons.ArrowRightLeft;
  }

  return <IconComponent className={className} size={size} />;
}
