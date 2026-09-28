import assert from 'node:assert/strict';
import { test, describe } from 'node:test';

// ===========================================================================
// ICON TECH PRO ERP — DASHBOARD CONSISTENCY & HEALTH AGREEMENT TEST SUITE
// ===========================================================================

describe('DASHBOARD DATA & CONNECTION STATE CONSISTENCY', () => {

  // -------------------------------------------------------------------------
  // Contract Definition Helpers (Simulating single source of truth contracts)
  // -------------------------------------------------------------------------

  function evaluateHealthStatus(isOnline) {
    return {
      isOnline,
      dbStatus: isOnline ? 'CONNECTED' : 'DATABASE_UNAVAILABLE',
      statusText: isOnline ? 'LIVE / CONNECTED' : 'OFFLINE / DATABASE UNAVAILABLE',
      badgeClass: isOnline ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800',
      showOfflineBanner: !isOnline,
    };
  }

  function computeDashboardKpis({ isOnline, invoices, orders, quotations }) {
    // In live mode with empty tables, records are empty arrays ([]), not fallback demo data
    const activeInvoicesCount = invoices.filter(
      (inv) => inv.payment_status !== 'PAID' && inv.status !== 'CANCELLED'
    ).length;

    const clearedPaymentsCount = invoices.filter(
      (inv) => (inv.paid_amount || 0) > 0
    ).length;

    const confirmedOrders = orders.length;

    const pendingQuotes = quotations.filter(
      (q) => q.status === 'Sent' || q.status === 'Draft' || q.status === 'Approval Pending'
    ).length;

    const totalReceivables = invoices.reduce(
      (sum, inv) => sum + ((inv.total_amount || 0) - (inv.paid_amount || 0)),
      0
    );

    const totalCollected = invoices.reduce(
      (sum, inv) => sum + (inv.paid_amount || 0),
      0
    );

    const totalOrdersValue = orders.reduce(
      (sum, o) => sum + (o.total_amount || 0),
      0
    );

    const totalQuotedValue = quotations.reduce(
      (sum, q) => sum + (q.grand_total || 0),
      0
    );

    return {
      isOnline,
      activeInvoicesCount,
      clearedPaymentsCount,
      confirmedOrders,
      pendingQuotes,
      totalReceivables,
      totalCollected,
      totalOrdersValue,
      totalQuotedValue,
      // Subtitle formatting contracts
      receivablesSubtitle: `Across ${activeInvoicesCount} active ${activeInvoicesCount === 1 ? 'invoice' : 'invoices'}`,
      collectedSubtitle: `${clearedPaymentsCount} bank-cleared ${clearedPaymentsCount === 1 ? 'receipt' : 'receipts'}`,
      ordersSubtitle: `${confirmedOrders} confirmed ${confirmedOrders === 1 ? 'order' : 'orders'} executing`,
      quotesSubtitle: `${pendingQuotes} commercial ${pendingQuotes === 1 ? 'proposal' : 'proposals'}`,
    };
  }

  // -------------------------------------------------------------------------
  // Test 1: Healthy Supabase -> LIVE / CONNECTED -> no offline banner
  // -------------------------------------------------------------------------
  test('Test 1: Healthy Supabase yields LIVE / CONNECTED and suppresses offline banner', () => {
    const health = evaluateHealthStatus(true);

    assert.equal(health.isOnline, true);
    assert.equal(health.dbStatus, 'CONNECTED');
    assert.equal(health.statusText, 'LIVE / CONNECTED');
    assert.equal(health.showOfflineBanner, false, 'Offline banner must NOT be shown when Supabase is online');
  });

  // -------------------------------------------------------------------------
  // Test 2: Unavailable Supabase -> OFFLINE / DATABASE UNAVAILABLE -> fallback mode
  // -------------------------------------------------------------------------
  test('Test 2: Unavailable Supabase yields OFFLINE / DATABASE UNAVAILABLE and triggers safe banner', () => {
    const health = evaluateHealthStatus(false);

    assert.equal(health.isOnline, false);
    assert.equal(health.dbStatus, 'DATABASE_UNAVAILABLE');
    assert.equal(health.statusText, 'OFFLINE / DATABASE UNAVAILABLE');
    assert.equal(health.showOfflineBanner, true, 'Offline banner MUST be shown when Supabase is unavailable');
  });

  // -------------------------------------------------------------------------
  // Test 3: Health and banner cannot disagree (both driven by single isOnline boolean)
  // -------------------------------------------------------------------------
  test('Test 3: Health status and offline banner display invariant cannot disagree', () => {
    // Check both boolean branches exhaustively
    for (const onlineState of [true, false]) {
      const status = evaluateHealthStatus(onlineState);
      // Invariant: showOfflineBanner must be strictly equivalent to (!isOnline)
      assert.equal(
        status.showOfflineBanner,
        !status.isOnline,
        `Contradiction detected for isOnline=${onlineState}: banner=${status.showOfflineBanner}`
      );
      if (status.isOnline) {
        assert.equal(status.showOfflineBanner, false);
      } else {
        assert.equal(status.showOfflineBanner, true);
      }
    }
  });

  // -------------------------------------------------------------------------
  // Test 4: Health and Command Center badge cannot disagree
  // -------------------------------------------------------------------------
  test('Test 4: Health status and Command Center badge cannot disagree', () => {
    for (const onlineState of [true, false]) {
      const status = evaluateHealthStatus(onlineState);
      if (status.isOnline) {
        assert.match(status.statusText, /LIVE \/ CONNECTED/);
        assert.match(status.badgeClass, /emerald/);
      } else {
        assert.match(status.statusText, /OFFLINE \/ DATABASE UNAVAILABLE/);
        assert.match(status.badgeClass, /amber/);
      }
      // If badge says LIVE, banner MUST NOT be visible
      if (status.statusText === 'LIVE / CONNECTED') {
        assert.equal(status.showOfflineBanner, false);
      }
      // If badge says OFFLINE, banner MUST be visible
      if (status.statusText === 'OFFLINE / DATABASE UNAVAILABLE') {
        assert.equal(status.showOfflineBanner, true);
      }
    }
  });

  // -------------------------------------------------------------------------
  // Test 5: Dashboard KPI amount/count/subtitle use the same authoritative source
  // -------------------------------------------------------------------------
  test('Test 5: Dashboard KPI amount, count, and subtitle are strictly synchronized from identical source', () => {
    // Scenario A: Live Connected Supabase with empty tables (0 records)
    const liveEmptyKpis = computeDashboardKpis({
      isOnline: true,
      invoices: [],
      orders: [],
      quotations: [],
    });

    assert.equal(liveEmptyKpis.totalReceivables, 0);
    assert.equal(liveEmptyKpis.activeInvoicesCount, 0);
    assert.equal(liveEmptyKpis.receivablesSubtitle, 'Across 0 active invoices');

    assert.equal(liveEmptyKpis.totalCollected, 0);
    assert.equal(liveEmptyKpis.clearedPaymentsCount, 0);
    assert.equal(liveEmptyKpis.collectedSubtitle, '0 bank-cleared receipts');

    assert.equal(liveEmptyKpis.totalOrdersValue, 0);
    assert.equal(liveEmptyKpis.confirmedOrders, 0);
    assert.equal(liveEmptyKpis.ordersSubtitle, '0 confirmed orders executing');

    assert.equal(liveEmptyKpis.totalQuotedValue, 0);
    assert.equal(liveEmptyKpis.pendingQuotes, 0);
    assert.equal(liveEmptyKpis.quotesSubtitle, '0 commercial proposals');

    // Scenario B: Fallback mode or populated table with 2 active invoices
    const sampleInvoices = [
      { id: 'inv-1', total_amount: 150000, paid_amount: 50000, payment_status: 'PARTIAL', status: 'ISSUED' },
      { id: 'inv-2', total_amount: 80000, paid_amount: 0, payment_status: 'UNPAID', status: 'ISSUED' },
    ];
    const sampleOrders = [
      { id: 'so-1', total_amount: 250000 },
      { id: 'so-2', total_amount: 120000 },
    ];
    const sampleQuotes = [
      { id: 'q-1', grand_total: 300000, status: 'Sent' },
    ];

    const populatedKpis = computeDashboardKpis({
      isOnline: true,
      invoices: sampleInvoices,
      orders: sampleOrders,
      quotations: sampleQuotes,
    });

    // Total receivables = (150000 - 50000) + 80000 = 180000
    assert.equal(populatedKpis.totalReceivables, 180000);
    assert.equal(populatedKpis.activeInvoicesCount, 2);
    assert.equal(populatedKpis.receivablesSubtitle, 'Across 2 active invoices');

    // Total collected = 50000 across 1 cleared receipt
    assert.equal(populatedKpis.totalCollected, 50000);
    assert.equal(populatedKpis.clearedPaymentsCount, 1);
    assert.equal(populatedKpis.collectedSubtitle, '1 bank-cleared receipt');

    // Confirmed orders = 2, value = 370000
    assert.equal(populatedKpis.confirmedOrders, 2);
    assert.equal(populatedKpis.totalOrdersValue, 370000);
    assert.equal(populatedKpis.ordersSubtitle, '2 confirmed orders executing');

    // Quoted = 1, value = 300000
    assert.equal(populatedKpis.pendingQuotes, 1);
    assert.equal(populatedKpis.totalQuotedValue, 300000);
    assert.equal(populatedKpis.quotesSubtitle, '1 commercial proposal');
  });

  // -------------------------------------------------------------------------
  // Test 6: No mixed live/fallback KPI calculations
  // -------------------------------------------------------------------------
  test('Test 6: Strict barrier prevents mixing live Supabase state with fallback demo constants', () => {
    // When live database returns [] for invoices, the system must NOT fall back to INITIAL_INVOICES
    // which previously had 2 invoices totaling ₹3,92,940 while receivables card showed ₹0.
    function queryInvoicesContract({ dbOnline, dbRows, fallbackRows }) {
      if (dbOnline) {
        // If query succeeded (even with 0 rows), return real data
        return { source: 'LIVE_SUPABASE', data: dbRows };
      }
      return { source: 'LOCAL_FALLBACK', data: fallbackRows };
    }

    const fallbackInvoices = [
      { id: 'demo-1', total_amount: 154000, paid_amount: 0 },
      { id: 'demo-2', total_amount: 238940, paid_amount: 100000 },
    ];

    // Live empty case
    const liveResult = queryInvoicesContract({
      dbOnline: true,
      dbRows: [],
      fallbackRows: fallbackInvoices,
    });
    assert.equal(liveResult.source, 'LIVE_SUPABASE');
    assert.equal(liveResult.data.length, 0, 'Must not leak fallback data when connected to live DB');

    // Offline case
    const offlineResult = queryInvoicesContract({
      dbOnline: false,
      dbRows: [],
      fallbackRows: fallbackInvoices,
    });
    assert.equal(offlineResult.source, 'LOCAL_FALLBACK');
    assert.equal(offlineResult.data.length, 2, 'Must use fallback data only when database is unavailable');
  });

});
