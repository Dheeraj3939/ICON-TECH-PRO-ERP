'use server';

import { getAuthenticatedUser } from '@/lib/auth/session';
import { getCustomers } from '@/lib/actions/customers';
import { getOrders } from '@/lib/actions/orders';
import { getInvoices } from '@/lib/actions/billing';
import { getProducts } from '@/lib/actions/products';
import { getSerialRecords } from '@/lib/actions/serials';
import { getAMCContracts } from '@/lib/actions/services';
import type { Customer } from '@/types/customer';
import type { SalesOrder, Product, SerialRecord, AMCContract } from '@/types/erp';

export interface ProductBuyerRow {
  customerId: string;
  customerCode: string;
  customerName: string;
  companyName?: string;
  phone: string;
  email?: string;
  city: string;
  ordersCount: number;
  totalQuantity: number;
  totalSpend: number;
  latestPurchaseDate: string;
  productsPurchased: string[];
}

export interface CrossSellGapRow {
  customerId: string;
  customerCode: string;
  customerName: string;
  phone: string;
  baseItemPurchased: string;
  targetItemMissing: string;
  lastOrderDate: string;
  opportunityValue: number;
}

export interface OpportunityItem {
  id: string;
  type: 'NO_AMC' | 'EXPIRING_WARRANTY' | 'INACTIVE_12_MONTHS';
  customerName: string;
  customerCode: string;
  phone: string;
  reason: string;
  urgency: 'HIGH' | 'MEDIUM' | 'LOW';
  recommendedAction: string;
  referenceAsset?: string;
  expiryDate?: string;
}

export async function queryProductToCustomers(params: {
  productQuery?: string;
  category?: string;
  brand?: string;
}): Promise<ProductBuyerRow[]> {
  const { productQuery, category, brand } = params;
  const pQuery = (productQuery || '').toLowerCase();
  const cQuery = (category || '').toLowerCase();
  const bQuery = (brand || '').toLowerCase();

  const [custRes, orderRes, prodRes] = await Promise.all([
    getCustomers({ limit: 100 }),
    getOrders(),
    getProducts(),
  ]);

  const customers = custRes.customers || [];
  const orders = orderRes.orders || [];
  const products = prodRes.products || [];

  // Group by customer
  const buyerMap = new Map<string, ProductBuyerRow>();

  orders.forEach((o) => {
    let matchedInOrder = false;
    const orderProds: string[] = [];
    let orderQty = 0;

    o.items.forEach((it) => {
      const pName = it.product_name.toLowerCase();
      const pSku = (it.sku || '').toLowerCase();

      // Check product match in catalog
      const matchedProd = products.find(
        (p) => p.name.toLowerCase() === pName || (it.sku && p.sku.toLowerCase() === pSku)
      );

      const matchesText = !pQuery || pName.includes(pQuery) || pSku.includes(pQuery);
      const matchesCat = !cQuery || (matchedProd?.category_name && matchedProd.category_name.toLowerCase().includes(cQuery));
      const matchesBrand = !bQuery || (matchedProd?.brand_name && matchedProd.brand_name.toLowerCase().includes(bQuery));

      if (matchesText && matchesCat && matchesBrand) {
        matchedInOrder = true;
        orderProds.push(it.product_name);
        orderQty += it.quantity;
      }
    });

    if (matchedInOrder) {
      const cust = customers.find((c) => c.id === o.customer_id || c.customer_code === o.customer_id);
      const custId = o.customer_id;
      const existing = buyerMap.get(custId) || {
        customerId: custId,
        customerCode: cust?.customer_code || custId,
        customerName: o.customer_name,
        companyName: o.company_name || cust?.company_name || undefined,
        phone: cust?.phone || 'N/A',
        email: cust?.email || undefined,
        city: cust?.city || 'Hyderabad',
        ordersCount: 0,
        totalQuantity: 0,
        totalSpend: 0,
        latestPurchaseDate: o.order_date,
        productsPurchased: [],
      };

      existing.ordersCount += 1;
      existing.totalQuantity += orderQty;
      existing.totalSpend += o.total_amount;
      if (new Date(o.order_date) > new Date(existing.latestPurchaseDate)) {
        existing.latestPurchaseDate = o.order_date;
      }

      orderProds.forEach((p) => {
        if (!existing.productsPurchased.includes(p)) {
          existing.productsPurchased.push(p);
        }
      });

      buyerMap.set(custId, existing);
    }
  });

  return Array.from(buyerMap.values()).sort((a, b) => b.totalSpend - a.totalSpend);
}

export async function queryCrossSellGap(params: {
  baseCategoryOrBrand: string;
  targetCategoryOrBrand: string;
}): Promise<CrossSellGapRow[]> {
  const base = params.baseCategoryOrBrand.toLowerCase();
  const target = params.targetCategoryOrBrand.toLowerCase();

  const [custRes, orderRes, prodRes] = await Promise.all([
    getCustomers({ limit: 100 }),
    getOrders(),
    getProducts(),
  ]);

  const customers = custRes.customers || [];
  const orders = orderRes.orders || [];
  const products = prodRes.products || [];

  const customerBoughtBase = new Map<string, { prods: string[]; lastDate: string }>();
  const customerBoughtTarget = new Set<string>();

  orders.forEach((o) => {
    o.items.forEach((it) => {
      const pName = it.product_name.toLowerCase();
      const matchedProd = products.find((p) => p.name.toLowerCase() === pName);
      const cat = (matchedProd?.category_name || '').toLowerCase();
      const brand = (matchedProd?.brand_name || '').toLowerCase();

      if (pName.includes(base) || cat.includes(base) || brand.includes(base)) {
        const existing = customerBoughtBase.get(o.customer_id) || { prods: [], lastDate: o.order_date };
        if (!existing.prods.includes(it.product_name)) existing.prods.push(it.product_name);
        if (new Date(o.order_date) > new Date(existing.lastDate)) existing.lastDate = o.order_date;
        customerBoughtBase.set(o.customer_id, existing);
      }

      if (pName.includes(target) || cat.includes(target) || brand.includes(target)) {
        customerBoughtTarget.add(o.customer_id);
      }
    });
  });

  const gapRows: CrossSellGapRow[] = [];

  customerBoughtBase.forEach((val, custId) => {
    if (!customerBoughtTarget.has(custId)) {
      const cust = customers.find((c) => c.id === custId || c.customer_code === custId);
      gapRows.push({
        customerId: custId,
        customerCode: cust?.customer_code || custId,
        customerName: cust?.customer_name || 'Customer ' + custId,
        phone: cust?.phone || 'N/A',
        baseItemPurchased: val.prods.join(', '),
        targetItemMissing: params.targetCategoryOrBrand,
        lastOrderDate: val.lastDate,
        opportunityValue: 25000, // Estimated cross-sell value
      });
    }
  });

  return gapRows;
}

export async function queryOpportunities(params?: {
  daysThreshold?: number;
}): Promise<OpportunityItem[]> {
  const days = params?.daysThreshold || 30;
  const now = new Date();

  const [custRes, orderRes, serialRes, amcRes] = await Promise.all([
    getCustomers({ limit: 100 }),
    getOrders(),
    getSerialRecords(),
    getAMCContracts(),
  ]);

  const customers = custRes.customers || [];
  const orders = orderRes.orders || [];
  const serials = (serialRes && serialRes.records) || [];
  const amcContracts = amcRes || [];

  const opportunities: OpportunityItem[] = [];

  // 1. Expiring Warranty Opportunities
  serials.forEach((s) => {
    if (s.warranty_end_date) {
      const end = new Date(s.warranty_end_date);
      const diffDays = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays >= -30 && diffDays <= days) {
        const cust = customers.find((c) => c.id === s.customer_id || c.customer_code === s.customer_id);
        const custName = cust?.customer_name || 'Client ' + (s.customer_id || 'Direct');

        opportunities.push({
          id: `opp-war-${s.id}`,
          type: 'EXPIRING_WARRANTY',
          customerName: custName,
          customerCode: cust?.customer_code || 'ICON260001',
          phone: cust?.phone || 'N/A',
          reason: `Warranty for ${s.product_name} (SN: ${s.serial_number}) expires in ${diffDays} days (${s.warranty_end_date})`,
          urgency: diffDays <= 7 ? 'HIGH' : 'MEDIUM',
          recommendedAction: 'Propose Icon Care Warranty Extension or 1-Year AMC contract',
          referenceAsset: `${s.product_name} (${s.serial_number})`,
          expiryDate: s.warranty_end_date,
        });
      }
    }
  });

  // 2. Customers with Installed Hardware but Zero Active AMC
  customers.forEach((c) => {
    const custOrders = orders.filter((o) => o.customer_id === c.id || o.customer_name === c.customer_name);
    const custAmcs = amcContracts.filter(
      (a) => (a.customer_id === c.id || a.customer_name === c.customer_name) && a.is_active
    );

    if (custOrders.length > 0 && custAmcs.length === 0) {
      opportunities.push({
        id: `opp-amc-${c.id}`,
        type: 'NO_AMC',
        customerName: c.customer_name,
        customerCode: c.customer_code,
        phone: c.phone || 'N/A',
        reason: `Customer purchased ${custOrders.length} orders but currently has NO active AMC coverage`,
        urgency: 'MEDIUM',
        recommendedAction: 'Schedule Annual Maintenance Contract (AMC) pitch meeting',
      });
    }
  });

  // 3. Inactive Customers (> 12 Months)
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);

  customers.forEach((c) => {
    const custOrders = orders.filter((o) => o.customer_id === c.id || o.customer_name === c.customer_name);
    if (custOrders.length > 0) {
      const mostRecentOrder = [...custOrders].sort(
        (a, b) => new Date(b.order_date).getTime() - new Date(a.order_date).getTime()
      )[0];

      if (new Date(mostRecentOrder.order_date) < twelveMonthsAgo) {
        opportunities.push({
          id: `opp-inact-${c.id}`,
          type: 'INACTIVE_12_MONTHS',
          customerName: c.customer_name,
          customerCode: c.customer_code,
          phone: c.phone || 'N/A',
          reason: `Last order was on ${mostRecentOrder.order_date} (over 12 months ago)`,
          urgency: 'LOW',
          recommendedAction: 'Send reconnect email or schedule courtesy follow-up visit',
        });
      }
    }
  });

  return opportunities;
}
