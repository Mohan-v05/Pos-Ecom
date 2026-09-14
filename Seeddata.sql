
-- ============================================================
-- Techloom Assessment — Sample Seed Data Script (Fixed UUIDs)
-- ============================================================

-- Clean up existing data
TRUNCATE TABLE refunds, payments, reservations, order_items, orders, products CASCADE;

-- 1. SEED PRODUCTS
INSERT INTO products (id, name, description, category, price, stock) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Keychron K2 Mechanical Keyboard', '75% Layout Wireless RGB Mechanical Keyboard (Red Switches)', 'Peripherals', 89.99, 25),
  ('22222222-2222-2222-2222-222222222222', 'Logitech MX Master 3S Mouse', 'Performance Wireless Mouse with Quiet Clicks and 8K DPI', 'Peripherals', 99.99, 40),
  ('33333333-3333-3333-3333-333333333333', 'Dell UltraSharp 27" 4K Monitor', 'IPS USB-C Hub Monitor (U2723QE) with HDR 400', 'Displays', 499.99, 12),
  ('44444444-4444-4444-4444-444444444444', 'Extended Desk Mat (900x400mm)', 'Water-resistant microfiber desk pad with stitched edges', 'Accessories', 19.99, 100);

-- 2. SEED ORDERS
-- Order 1: Completed POS Sale
INSERT INTO orders (id, user_id, channel, status, total_amount) VALUES
  ('a1111111-0000-0000-0000-000000000001', 'pos_cashier_01', 'POS', 'PAID', 189.98);

-- Order 2: Active E-Commerce Checkout (Pending/Reserved)
INSERT INTO orders (id, user_id, channel, status, total_amount) VALUES
  ('a2222222-0000-0000-0000-000000000002', 'cust_alex_99', 'ECOMMERCE', 'RESERVED', 499.99);

-- Order 3: Cancelled E-Commerce Order (Refunded)
INSERT INTO orders (id, user_id, channel, status, total_amount) VALUES
  ('a3333333-0000-0000-0000-000000000003', 'cust_sarah_m', 'ECOMMERCE', 'REFUNDED', 89.99);

-- 3. SEED ORDER ITEMS
-- Items for Order 1 (POS)
INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
  ('a1111111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 1, 89.99),
  ('a1111111-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 1, 99.99);

-- Items for Order 2 (E-Commerce)
INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
  ('a2222222-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 1, 499.99);

-- Items for Order 3 (E-Commerce Refunded)
INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
  ('a3333333-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 1, 89.99);

-- 4. SEED RESERVATIONS
-- Active 5-Minute Hold for Order 2
INSERT INTO reservations (order_id, product_id, quantity, status, expires_at) VALUES
  ('a2222222-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 1, 'ACTIVE', NOW() + INTERVAL '5 minutes');

-- 5. SEED PAYMENTS
-- Successful Payment for Order 1
INSERT INTO payments (id, order_id, idempotency_key, status, amount) VALUES
  ('b1111111-0000-0000-0000-000000000001', 'a1111111-0000-0000-0000-000000000001', 'tx_pos_terminal_1001', 'SUCCESS', 189.98);

-- Successful Payment for Order 3 (before refund)
INSERT INTO payments (id, order_id, idempotency_key, status, amount) VALUES
  ('b3333333-0000-0000-0000-000000000003', 'a3333333-0000-0000-0000-000000000003', 'tx_ecom_stripe_3003', 'SUCCESS', 89.99);

-- 6. SEED REFUNDS
-- Completed Refund for Order 3 linked to Payment 3
INSERT INTO refunds (order_id, payment_id, amount, status) VALUES
  ('a3333333-0000-0000-0000-000000000003', 'b3333333-0000-0000-0000-000000000003', 89.99, 'COMPLETED');

  