'use client';

import React from 'react';
import { QrCode, Smartphone, ExternalLink } from 'lucide-react';

interface QRCodeDisplayProps {
  url?: string;
  title?: string;
  subtitle?: string;
}

export default function QRCodeDisplay({
  url = typeof window !== 'undefined' ? window.location.origin : 'https://pigeon-ict.mutiarabangsa.sch.id',
  title = 'Scan QR Code untuk Mengakses PIGEON',
  subtitle = 'Gunakan kamera smartphone atau QR Scanner untuk langsung membuka sistem peminjaman',
}: QRCodeDisplayProps) {
  // Use a public QR code generator API image or an SVG representation
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
    url
  )}&color=16-163-74`;

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 text-center flex flex-col items-center">
      <div className="w-12 h-12 bg-pigeon-100 text-pigeon-700 rounded-full flex items-center justify-center mb-3">
        <QrCode className="w-6 h-6" />
      </div>
      <h3 className="font-semibold text-slate-800 text-lg mb-1">{title}</h3>
      <p className="text-slate-500 text-xs max-w-xs mb-4">{subtitle}</p>

      <div className="p-3 bg-slate-50 border-2 border-dashed border-pigeon-300 rounded-xl relative group">
        <img
          src={qrImageUrl}
          alt="QR Code PIGEON"
          className="w-44 h-44 rounded-lg object-contain mx-auto"
          loading="lazy"
        />
        <div className="mt-2 flex items-center justify-center gap-1.5 text-xs text-slate-600 font-medium">
          <Smartphone className="w-3.5 h-3.5 text-pigeon-600" />
          <span>Lab 1 & Lab 2 Entry Point</span>
        </div>
      </div>

      <div className="mt-4 text-[11px] text-slate-400 break-all px-2 bg-slate-100 py-1.5 rounded-lg max-w-full">
        <span className="font-mono text-slate-600">{url}</span>
      </div>
    </div>
  );
}
