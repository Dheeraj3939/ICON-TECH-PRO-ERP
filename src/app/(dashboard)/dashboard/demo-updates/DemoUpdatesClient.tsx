'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  CheckCircle2,
  ExternalLink,
  Search,
  Filter,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  Calendar,
} from 'lucide-react';
import type { DemoFeatureRegistryItem } from '@/types/hr';

interface DemoUpdatesClientProps {
  initialFeatures: DemoFeatureRegistryItem[];
}

export function DemoUpdatesClient({ initialFeatures }: DemoUpdatesClientProps) {
  const [features, setFeatures] = useState<DemoFeatureRegistryItem[]>(initialFeatures);
  const [search, setSearch] = useState('');
  const [selectedModule, setSelectedModule] = useState('ALL');

  const modules = ['ALL', ...Array.from(new Set(features.map((f) => f.module)))];

  const filteredFeatures = features.filter((feat) => {
    if (selectedModule !== 'ALL' && feat.module !== selectedModule) return false;
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      return (
        feat.feature_name.toLowerCase().includes(q) ||
        feat.description.toLowerCase().includes(q) ||
        feat.module.toLowerCase().includes(q) ||
        (feat.notes && feat.notes.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Module Filters & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          {modules.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setSelectedModule(m)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition whitespace-nowrap cursor-pointer ${
                selectedModule === m
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="w-full md:w-72 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search features, modules, notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Feature Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredFeatures.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition duration-200 flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200/50">
                  {item.module}
                </span>

                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>{item.status}</span>
                  </span>
                  <span className="text-[10px] font-mono font-bold text-slate-400">
                    {item.version}
                  </span>
                </div>
              </div>

              <h3 className="text-sm font-black text-slate-900 group-hover:text-indigo-600 transition">
                {item.feature_name}
              </h3>

              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                {item.description}
              </p>

              {item.notes && (
                <div className="mt-3 p-2.5 bg-slate-50 rounded-xl border border-slate-200/60 text-[11px] text-slate-500 italic">
                  &bull; {item.notes}
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-400 text-[11px]">
                Added: {item.added_date}
              </span>

              <Link
                href={item.demo_route}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 transition shadow-2xs group-hover:scale-102"
              >
                <span>Test Feature</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
