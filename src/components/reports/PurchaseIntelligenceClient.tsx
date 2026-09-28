'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Search,
  Users,
  Building2,
  Package,
  TrendingUp,
  Sparkles,
  ArrowRight,
  Download,
  AlertTriangle,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Filter,
  RefreshCw,
} from 'lucide-react';
import {
  queryProductToCustomers,
  queryCrossSellGap,
  queryOpportunities,
  type ProductBuyerRow,
  type CrossSellGapRow,
  type OpportunityItem,
} from '@/lib/actions/purchase-intelligence';

export function PurchaseIntelligenceClient() {
  const [activeTab, setActiveTab] = useState<'BUYERS' | 'CROSS_SELL' | 'OPPORTUNITIES'>('BUYERS');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [loading, setLoading] = useState(false);

  // Data states
  const [buyers, setBuyers] = useState<ProductBuyerRow[]>([]);
  const [crossSellGaps, setCrossSellGaps] = useState<CrossSellGapRow[]>([]);
  const [opportunities, setOpportunities] = useState<OpportunityItem[]>([]);

  // Load default data
  useEffect(() => {
    loadData();
  }, [activeTab, categoryFilter]);

  async function loadData() {
    setLoading(true);
    try {
      if (activeTab === 'BUYERS') {
        const res = await queryProductToCustomers({
          productQuery: searchQuery || undefined,
          category: categoryFilter !== 'ALL' ? categoryFilter : undefined,
        });
        setBuyers(res);
      } else if (activeTab === 'CROSS_SELL') {
        const res = await queryCrossSellGap({
          baseCategoryOrBrand: 'Laptops',
          targetCategoryOrBrand: 'Monitors',
        });
        setCrossSellGaps(res);
      } else if (activeTab === 'OPPORTUNITIES') {
        const res = await queryOpportunities({ daysThreshold: 60 });
        setOpportunities(res);
      }
    } catch (err) {
      console.error('Error loading intelligence data:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleExportCSV = () => {
    let headers = '';
    let rows = '';

    if (activeTab === 'BUYERS') {
      headers = 'Customer Code,Customer Name,Phone,City,Orders Count,Total Spend,Products\n';
      rows = buyers
        .map(
          (b) =>
            `"${b.customerCode}","${b.customerName}","${b.phone}","${b.city}",${b.ordersCount},${b.totalSpend},"${b.productsPurchased.join('; ')}"`
        )
        .join('\n');
    } else if (activeTab === 'CROSS_SELL') {
      headers = 'Customer Code,Customer Name,Phone,Base Item,Missing Target,Last Order\n';
      rows = crossSellGaps
        .map(
          (g) =>
            `"${g.customerCode}","${g.customerName}","${g.phone}","${g.baseItemPurchased}","${g.targetItemMissing}","${g.lastOrderDate}"`
        )
        .join('\n');
    } else {
      headers = 'Type,Customer Name,Customer Code,Phone,Urgency,Reason,Action\n';
      rows = opportunities
        .map(
          (o) =>
            `"${o.type}","${o.customerName}","${o.customerCode}","${o.phone}","${o.urgency}","${o.reason}","${o.recommendedAction}"`
        )
        .join('\n');
    }

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `purchase-intelligence-${activeTab.toLowerCase()}-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 bg-slate-900 rounded-2xl text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-brand-400" />
            <h1 className="text-xl font-black tracking-tight">Customer Purchase Intelligence</h1>
          </div>
          <p className="text-xs text-slate-400">
            Multi-directional customer $\leftrightarrow$ product queries, cross-sell opportunities & warranty/AMC radars
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportCSV}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Mode Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2 text-xs font-bold">
        {[
          { id: 'BUYERS', label: 'Product $\rightarrow$ Customer Buyers', icon: Users },
          { id: 'CROSS_SELL', label: 'Cross-Sell Gap Analysis', icon: TrendingUp },
          { id: 'OPPORTUNITIES', label: 'Proactive Opportunity Radar', icon: AlertTriangle },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-xl transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Filters (For Buyers Tab) */}
      {activeTab === 'BUYERS' && (
        <form
          onSubmit={handleSearchSubmit}
          className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center gap-3"
        >
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by product name, model or brand (e.g. 'Epson', 'Dell', 'Catalyst')..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 outline-none focus:bg-white focus:border-brand-500 transition"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none cursor-pointer"
            >
              <option value="ALL">All Categories</option>
              <option value="Projectors">Projectors</option>
              <option value="Interactive Displays">Interactive Displays</option>
              <option value="Laptops">Laptops</option>
              <option value="Audio Video">Audio Video</option>
              <option value="Networking">Networking</option>
            </select>

            <button
              type="submit"
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 flex-shrink-0 cursor-pointer"
            >
              <Filter className="w-3.5 h-3.5" />
              Apply Filter
            </button>
          </div>
        </form>
      )}

      {/* Tab 1: Product Buyers */}
      {activeTab === 'BUYERS' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900">
              Matched Customer Accounts ({buyers.length})
            </h3>
            <span className="text-[11px] text-slate-400">
              Sorted by Total Spend (High to Low)
            </span>
          </div>

          {loading ? (
            <div className="py-12 text-center text-slate-400 text-xs font-medium">
              Scanning customer order archives...
            </div>
          ) : buyers.length > 0 ? (
            <>
              {/* Desktop Zero-Scroll Table */}
              <div className="hidden md:block">
                <table className="w-full text-left text-xs table-fixed">
                  <colgroup>
                    <col className="w-[24%]" />
                    <col className="w-[20%]" />
                    <col className="w-[16%]" />
                    <col className="w-[14%]" />
                    <col className="w-[16%]" />
                    <col className="w-[10%]" />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                      <th className="p-3">Customer</th>
                      <th className="p-3">Phone & Location</th>
                      <th className="p-3">Orders</th>
                      <th className="p-3">Total Spend</th>
                      <th className="p-3">Products Purchased</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {buyers.map((b) => (
                      <tr key={b.customerId} className="hover:bg-slate-50/60">
                        <td className="p-3 truncate">
                          <span className="font-bold text-slate-900 block truncate">{b.customerName}</span>
                          <span className="font-mono text-[10px] text-slate-400 block">{b.customerCode}</span>
                        </td>
                        <td className="p-3 text-slate-600 truncate">
                          <span>{b.phone}</span>
                          <span className="text-[11px] text-slate-400 block truncate">{b.city}</span>
                        </td>
                        <td className="p-3 font-semibold text-slate-800 truncate">
                          {b.ordersCount} Orders ({b.totalQuantity} units)
                        </td>
                        <td className="p-3 font-black text-slate-900 font-mono truncate">
                          ₹{b.totalSpend.toLocaleString('en-IN')}
                        </td>
                        <td className="p-3 text-slate-600 truncate" title={b.productsPurchased.join(', ')}>
                          {b.productsPurchased.join(', ')}
                        </td>
                        <td className="p-3 text-right">
                          <Link
                            href={`/dashboard/customers/${b.customerId}`}
                            className="px-2.5 py-1 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-700 text-[11px] font-bold inline-flex items-center gap-1 transition"
                          >
                            <span>Customer 360</span>
                            <ArrowRight className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Zero-Scroll Cards */}
              <div className="block md:hidden space-y-3 p-3">
                {buyers.map((b) => (
                  <div key={b.customerId} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-bold text-slate-900 block text-xs">{b.customerName}</span>
                        <span className="font-mono text-[10px] text-slate-400">{b.customerCode}</span>
                      </div>
                      <span className="font-black text-slate-900 text-xs font-mono">
                        ₹{b.totalSpend.toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-600 space-y-0.5">
                      <div>Ph: <span className="font-medium text-slate-800">{b.phone}</span> • {b.city}</div>
                      <div>Orders: <span className="font-semibold text-slate-800">{b.ordersCount}</span> ({b.totalQuantity} units)</div>
                      <div className="text-slate-500 truncate" title={b.productsPurchased.join(', ')}>
                        Items: {b.productsPurchased.join(', ')}
                      </div>
                    </div>

                    <div className="pt-1">
                      <Link
                        href={`/dashboard/customers/${b.customerId}`}
                        className="w-full min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-bold transition"
                      >
                        <span>View Customer 360</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="py-12 text-center text-slate-400 text-xs">
              No matching customer purchase records found. Try adjusting the query.
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Cross-Sell Gap Analysis */}
      {activeTab === 'CROSS_SELL' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="p-4 bg-brand-50 rounded-xl border border-brand-100 text-xs text-brand-900">
            <h4 className="font-bold mb-1 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-brand-600" />
              Automated Opportunity Detection
            </h4>
            <p>
              Displaying accounts that have purchased <strong>Laptops</strong> but have zero recorded purchases of <strong>Monitors or Desktop Accessories</strong>. Prime targets for peripherals pitching.
            </p>
          </div>

          <div className="divide-y divide-slate-100">
            {crossSellGaps.map((g) => (
              <div key={g.customerId} className="py-3 flex items-center justify-between gap-4">
                <div>
                  <span className="font-bold text-xs text-slate-900 block">{g.customerName}</span>
                  <span className="text-[11px] text-slate-500 block">
                    Bought: <strong className="text-slate-700">{g.baseItemPurchased}</strong> • Missing: <span className="text-rose-600 font-bold">{g.targetItemMissing}</span>
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Phone: {g.phone} • Last Order: {g.lastOrderDate}
                  </span>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Est. Opportunity</span>
                    <span className="text-xs font-black text-emerald-600">₹{g.opportunityValue.toLocaleString('en-IN')}</span>
                  </div>
                  <Link
                    href={`/dashboard/customers/${g.customerId}`}
                    className="px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition flex items-center gap-1"
                  >
                    <span>Pitch Now</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Opportunity Radar */}
      {activeTab === 'OPPORTUNITIES' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {opportunities.map((opp) => (
            <div key={opp.id} className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    opp.urgency === 'HIGH'
                      ? 'bg-rose-100 text-rose-800 border border-rose-200'
                      : 'bg-amber-100 text-amber-800 border border-amber-200'
                  }`}
                >
                  {opp.urgency} Urgency
                </span>
                <span className="font-mono text-xs text-slate-400 font-semibold">{opp.customerCode}</span>
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-900">{opp.customerName}</h4>
                <p className="text-xs text-slate-600 mt-1">{opp.reason}</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-[11px]">
                <strong className="text-brand-700 block mb-0.5">Recommended Next Action:</strong>
                <span className="text-slate-600">{opp.recommendedAction}</span>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">Phone: {opp.phone}</span>
                <Link
                  href={`/dashboard/customers/${opp.customerCode}`}
                  className="font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1"
                >
                  <span>Customer 360</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
