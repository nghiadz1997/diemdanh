'use client';

import React from 'react';

export function QuizVisual({ visualKey }: { visualKey: string }) {
  switch (visualKey) {
    case 'q71':
      return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
          <div className="p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <div className="text-2xl mb-1">🖨️</div>
            <div className="font-bold text-blue-600">1</div>
            <div>CutePDF Writer</div>
          </div>
          <div className="p-3 rounded-lg bg-white dark:bg-slate-800 border-2 border-emerald-500 relative">
            <span className="absolute top-1.5 right-1.5 bg-emerald-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">✓</span>
            <div className="text-2xl mb-1">🖨️</div>
            <div className="font-bold text-blue-600">2</div>
            <div>HP LaserJet 4250</div>
          </div>
          <div className="p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <div className="text-2xl mb-1">🖨️</div>
            <div className="font-bold text-blue-600">3</div>
            <div>Microsoft Office Doc...</div>
          </div>
          <div className="p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <div className="text-2xl mb-1">🖨️</div>
            <div className="font-bold text-blue-600">4</div>
            <div>Microsoft XPS Doc...</div>
          </div>
        </div>
      );
    case 'q72':
      return (
        <div className="flex flex-wrap justify-center gap-3 text-center text-xs">
          <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 w-24"><div className="text-xl">💾</div>3½ Floppy (A:)</div>
          <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 w-24"><div className="text-xl">💽</div>Local Disk (C:)</div>
          <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 w-24"><div className="text-xl">💽</div>DATA (D:)</div>
          <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 w-24"><div className="text-xl">💿</div>DVD-RAM (E:)</div>
          <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 w-24"><div className="text-xl">💽</div>Data 2 (F:)</div>
          <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 w-24"><div className="text-xl">💿</div>DVD Drive (G:)</div>
          <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 w-24"><div className="text-xl">📁</div>Shared Docs</div>
        </div>
      );
    case 'q73':
      return (
        <div className="flex flex-wrap justify-center gap-3 text-center text-xs">
          <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 w-24"><div className="text-xl">💾</div>3½ Floppy (A:)</div>
          <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 w-24"><div className="text-xl">💽</div>Local Disk (C:)</div>
          <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 w-24"><div className="text-xl">💽</div>DATA (D:)</div>
          <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 w-24"><div className="text-xl">💿</div>DVD-RAM Drive (E:)</div>
          <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 w-24"><div className="text-xl">💽</div>Data 2 (F:)</div>
        </div>
      );
    case 'q89':
      return (
        <div className="max-w-md mx-auto bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg p-4 text-left shadow-sm text-xs">
          <div className="font-bold text-slate-800 dark:text-slate-100 mb-2">Are you sure you want to permanently delete this folder?</div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl">📁❌</span>
            <div>
              <div className="font-semibold">Winrar</div>
              <div className="text-slate-500">Type: File folder<br />Date modified: 23/11/2014 08:54</div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <span className="px-4 py-1 border border-blue-500 rounded bg-slate-100 dark:bg-slate-700 font-semibold">Yes</span>
            <span className="px-4 py-1 border border-slate-300 dark:border-slate-600 rounded">No</span>
          </div>
        </div>
      );
    case 'q92':
      return (
        <div className="max-w-md mx-auto bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg p-4 text-left shadow-sm text-xs">
          <div className="font-bold text-slate-800 dark:text-slate-100 mb-2">Are you sure you want to move this folder to the Recycle Bin?</div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl">📁🗑️</span>
            <div>
              <div className="font-semibold">Books</div>
              <div className="text-slate-500">Date created: 04/11/2012 08:44</div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <span className="px-4 py-1 border border-blue-500 rounded bg-slate-100 dark:bg-slate-700 font-semibold">Yes</span>
            <span className="px-4 py-1 border border-slate-300 dark:border-slate-600 rounded">No</span>
          </div>
        </div>
      );
    case 'q193':
      return (
        <div className="inline-flex items-center gap-3 px-5 py-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl">
          <span className="font-mono text-2xl font-black text-slate-900 dark:text-white">└</span>
          <span className="text-xs text-slate-500">(Ký hiệu Left Tab trên thanh thước)</span>
        </div>
      );
    case 'q194':
      return (
        <div className="inline-flex items-center gap-3 px-5 py-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl">
          <span className="font-mono text-2xl font-black text-slate-900 dark:text-white">┴</span>
          <span className="text-xs text-slate-500">(Ký hiệu Center Tab trên thanh thước)</span>
        </div>
      );
    case 'q195':
      return (
        <div className="inline-flex items-center gap-3 px-5 py-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl">
          <span className="font-mono text-2xl font-black text-slate-900 dark:text-white">┘</span>
          <span className="text-xs text-slate-500">(Ký hiệu Right Tab trên thanh thước)</span>
        </div>
      );
    case 'q211':
      return (
        <table className="mx-auto text-xs border-collapse border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800">
          <thead>
            <tr className="bg-slate-100 dark:bg-slate-700">
              <th className="border border-slate-300 dark:border-slate-600 px-3 py-1"></th>
              <th className="border border-slate-300 dark:border-slate-600 px-6 py-1">A</th>
            </tr>
          </thead>
          <tbody>
            <tr><td className="border border-slate-300 dark:border-slate-600 px-3 py-1 bg-slate-100 dark:bg-slate-700 font-bold">1</td><td className="border border-slate-300 dark:border-slate-600 px-6 py-1 font-mono">A011</td></tr>
            <tr><td className="border border-slate-300 dark:border-slate-600 px-3 py-1 bg-slate-100 dark:bg-slate-700 font-bold">2</td><td className="border border-slate-300 dark:border-slate-600 px-6 py-1 font-mono">A010</td></tr>
            <tr><td className="border border-slate-300 dark:border-slate-600 px-3 py-1 bg-slate-100 dark:bg-slate-700 font-bold">3</td><td className="border border-slate-300 dark:border-slate-600 px-6 py-1 font-mono">A100</td></tr>
          </tbody>
        </table>
      );
    case 'q215':
      return (
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg font-mono font-bold text-sm">
          <span>.0</span><span className="text-blue-600">←</span><span>.00</span>
          <span className="text-xs font-sans font-normal text-slate-500">(Increase Decimal)</span>
        </div>
      );
    case 'q216':
      return (
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg font-mono font-bold text-sm">
          <span>.00</span><span className="text-blue-600">→</span><span>.0</span>
          <span className="text-xs font-sans font-normal text-slate-500">(Decrease Decimal)</span>
        </div>
      );
    case 'q217':
      return (
        <table className="mx-auto text-xs border-collapse border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800">
          <thead>
            <tr className="bg-slate-100 dark:bg-slate-700">
              <th className="border border-slate-300 dark:border-slate-600 px-3 py-1"></th>
              <th className="border border-slate-300 dark:border-slate-600 px-4 py-1">A</th>
              <th className="border border-slate-300 dark:border-slate-600 px-4 py-1">B</th>
            </tr>
          </thead>
          <tbody>
            <tr><td className="border border-slate-300 dark:border-slate-600 px-3 py-1 bg-slate-100 dark:bg-slate-700 font-bold">1</td><td className="border border-slate-300 dark:border-slate-600 px-4 py-1 font-mono">10/8/2016</td><td className="border border-slate-300 dark:border-slate-600 px-4 py-1 font-mono">Saturday 08-Oct-2016</td></tr>
          </tbody>
        </table>
      );
    case 'q228':
      return (
        <table className="mx-auto text-xs border-collapse border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800">
          <thead>
            <tr className="bg-slate-100 dark:bg-slate-700">
              <th className="border border-slate-300 dark:border-slate-600 px-3 py-1"></th>
              <th className="border border-slate-300 dark:border-slate-600 px-4 py-1">A</th>
              <th className="border border-slate-300 dark:border-slate-600 px-4 py-1">B</th>
            </tr>
          </thead>
          <tbody>
            <tr><td className="border border-slate-300 dark:border-slate-600 px-3 py-1 bg-slate-100 dark:bg-slate-700 font-bold">1</td><td className="border border-slate-300 dark:border-slate-600 px-4 py-1">9</td><td className="border border-slate-300 dark:border-slate-600 px-4 py-1">Giỏi</td></tr>
            <tr><td className="border border-slate-300 dark:border-slate-600 px-3 py-1 bg-slate-100 dark:bg-slate-700 font-bold">2</td><td className="border border-slate-300 dark:border-slate-600 px-4 py-1">6</td><td className="border border-slate-300 dark:border-slate-600 px-4 py-1">TB Khá</td></tr>
            <tr><td className="border border-slate-300 dark:border-slate-600 px-3 py-1 bg-slate-100 dark:bg-slate-700 font-bold">3</td><td className="border border-slate-300 dark:border-slate-600 px-4 py-1">7</td><td className="border border-slate-300 dark:border-slate-600 px-4 py-1">Khá</td></tr>
            <tr><td className="border border-slate-300 dark:border-slate-600 px-3 py-1 bg-slate-100 dark:bg-slate-700 font-bold">4</td><td className="border border-slate-300 dark:border-slate-600 px-4 py-1">5</td><td className="border border-slate-300 dark:border-slate-600 px-4 py-1">TB</td></tr>
            <tr><td className="border border-slate-300 dark:border-slate-600 px-3 py-1 bg-slate-100 dark:bg-slate-700 font-bold">5</td><td className="border border-slate-300 dark:border-slate-600 px-4 py-1">0</td><td className="border border-slate-300 dark:border-slate-600 px-4 py-1">Yếu</td></tr>
          </tbody>
        </table>
      );
    case 'q246':
      return (
        <table className="mx-auto text-xs border-collapse border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800">
          <thead>
            <tr className="bg-slate-100 dark:bg-slate-700">
              <th className="border border-slate-300 dark:border-slate-600 px-2 py-1"></th>
              <th className="border border-slate-300 dark:border-slate-600 px-3 py-1">A</th>
              <th className="border border-slate-300 dark:border-slate-600 px-3 py-1">B</th>
              <th className="border border-slate-300 dark:border-slate-600 px-3 py-1">C</th>
            </tr>
          </thead>
          <tbody>
            <tr><td className="border border-slate-300 dark:border-slate-600 px-2 py-1 bg-slate-100 dark:bg-slate-700 font-bold">1</td><td className="border border-slate-300 dark:border-slate-600 px-3 py-1 font-semibold">Tên NV</td><td className="border border-slate-300 dark:border-slate-600 px-3 py-1 font-semibold">HSL</td><td className="border border-slate-300 dark:border-slate-600 px-3 py-1 font-semibold">Lương</td></tr>
            <tr><td className="border border-slate-300 dark:border-slate-600 px-2 py-1 bg-slate-100 dark:bg-slate-700 font-bold">2</td><td className="border border-slate-300 dark:border-slate-600 px-3 py-1">Hoàng</td><td className="border border-slate-300 dark:border-slate-600 px-3 py-1">2.34</td><td className="border border-slate-300 dark:border-slate-600 px-3 py-1 text-blue-600 font-bold">?</td></tr>
            <tr><td className="border border-slate-300 dark:border-slate-600 px-2 py-1 bg-slate-100 dark:bg-slate-700 font-bold">3</td><td className="border border-slate-300 dark:border-slate-600 px-3 py-1">Nhân</td><td className="border border-slate-300 dark:border-slate-600 px-3 py-1">3.3</td><td className="border border-slate-300 dark:border-slate-600 px-3 py-1"></td></tr>
            <tr><td className="border border-slate-300 dark:border-slate-600 px-2 py-1 bg-slate-100 dark:bg-slate-700 font-bold">4</td><td className="border border-slate-300 dark:border-slate-600 px-3 py-1">Mức lương CB</td><td className="border border-slate-300 dark:border-slate-600 px-3 py-1 font-mono">540000</td><td className="border border-slate-300 dark:border-slate-600 px-3 py-1"></td></tr>
          </tbody>
        </table>
      );
    case 'q272':
      return (
        <div className="inline-flex items-center gap-4 px-5 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm">
          <span title="Normal">📄 Normal</span>
          <span title="Slide Sorter">⊞ Slide Sorter</span>
          <span title="Reading View">📖 Reading View</span>
          <span title="Slide Show" className="font-bold text-blue-600">📽️ Slide Show</span>
          <span className="text-xs text-slate-400">52% —●— +</span>
        </div>
      );
    default:
      return null;
  }
}
