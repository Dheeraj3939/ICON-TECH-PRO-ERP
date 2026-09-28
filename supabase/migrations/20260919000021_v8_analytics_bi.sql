-- ============================================================================
-- ICON TECH PRO ERP V8 — Phase M: Analytics / BI (Read-only)
-- Migration: 20260919000021_v8_analytics_bi.sql
-- 100% Additive: Views and indexes for high-performance BI aggregations
-- ============================================================================

-- Additive composite indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_quotations_status_total 
  ON quotations(status, grand_total);

CREATE INDEX IF NOT EXISTS idx_sales_orders_customer_total 
  ON sales_orders(customer_id, total_amount);

CREATE INDEX IF NOT EXISTS idx_invoices_customer_status_total 
  ON invoices(customer_id, status, grand_total);

-- ----------------------------------------------------------------------------
-- View: v_sales_pipeline_kpis
-- Aggregates real-time sales pipeline funnel metrics
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_sales_pipeline_kpis AS
SELECT
  COUNT(e.id) AS total_enquiries,
  COUNT(CASE WHEN e.status IN ('Quotation Sent', 'Converted', 'Order Confirmed', 'Won') THEN 1 END) AS converted_to_quotations,
  COUNT(CASE WHEN e.status IN ('Converted', 'Order Confirmed', 'Won') THEN 1 END) AS converted_to_orders,
  CASE 
    WHEN COUNT(e.id) > 0 THEN 
      ROUND((COUNT(CASE WHEN e.status IN ('Converted', 'Order Confirmed', 'Won') THEN 1 END)::NUMERIC / COUNT(e.id)::NUMERIC) * 100, 2)
    ELSE 0 
  END AS conversion_rate_percent,
  COALESCE(SUM(q.grand_total), 0) AS total_pipeline_value,
  CASE 
    WHEN COUNT(q.id) > 0 THEN 
      ROUND(COALESCE(SUM(q.grand_total), 0)::NUMERIC / COUNT(q.id)::NUMERIC, 2)
    ELSE 0 
  END AS average_deal_size
FROM enquiries e
LEFT JOIN quotations q ON q.enquiry_id = e.id;

-- ----------------------------------------------------------------------------
-- View: v_revenue_by_category
-- Aggregates revenue, order volume, and margins by product category
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_revenue_by_category AS
SELECT
  COALESCE(p.category, 'Uncategorized') AS category,
  COALESCE(SUM(so.total_amount), 0) AS total_revenue,
  COUNT(DISTINCT so.id) AS total_orders,
  CASE 
    WHEN COUNT(DISTINCT so.id) > 0 THEN 
      ROUND(COALESCE(SUM(so.total_amount), 0)::NUMERIC / COUNT(DISTINCT so.id)::NUMERIC, 2)
    ELSE 0 
  END AS average_order_value,
  -- Target gross margin benchmark for AV systems is typically 28-35%
  ROUND(AVG(COALESCE(p.margin_percent, 30.00)), 2) AS gross_margin_percent
FROM sales_orders so
LEFT JOIN products p ON p.id::text = (so.items->0->>'product_id')
GROUP BY COALESCE(p.category, 'Uncategorized');

-- ----------------------------------------------------------------------------
-- View: v_customer_ltv_summary
-- Aggregates customer lifetime value, invoices, collections, and outstanding
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_customer_ltv_summary AS
SELECT
  c.id AS customer_id,
  c.name AS customer_name,
  COALESCE(c.customer_type, 'Corporate') AS customer_type,
  COUNT(DISTINCT so.id) AS total_orders,
  COALESCE(SUM(so.total_amount), 0) AS lifetime_value,
  COALESCE(SUM(i.grand_total), 0) AS total_invoiced,
  COALESCE(SUM(i.paid_amount), 0) AS total_collected,
  (COALESCE(SUM(i.grand_total), 0) - COALESCE(SUM(i.paid_amount), 0)) AS outstanding_balance,
  MAX(so.created_at) AS last_order_date
FROM customers c
LEFT JOIN sales_orders so ON so.customer_id = c.id
LEFT JOIN invoices i ON i.customer_id = c.id
GROUP BY c.id, c.name, c.customer_type;

-- ----------------------------------------------------------------------------
-- View: v_collection_efficiency_metrics
-- Computes overall collection percentage and outstanding exposure
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_collection_efficiency_metrics AS
SELECT
  COALESCE(SUM(i.grand_total), 0) AS total_billed,
  COALESCE(SUM(i.paid_amount), 0) AS total_collected,
  (COALESCE(SUM(i.grand_total), 0) - COALESCE(SUM(i.paid_amount), 0)) AS current_outstanding,
  CASE 
    WHEN COALESCE(SUM(i.grand_total), 0) > 0 THEN 
      ROUND((COALESCE(SUM(i.paid_amount), 0)::NUMERIC / SUM(i.grand_total)::NUMERIC) * 100, 2)
    ELSE 100.00 
  END AS efficiency_rate_percent
FROM invoices i;
