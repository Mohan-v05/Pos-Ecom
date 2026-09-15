-- ============================================================
-- Techloom Assessment — Consolidated Database Schema
-- Single normalized schema for POS (Task 01) and E-Commerce (Task 02)
-- Channel discriminator ('POS' | 'ECOMMERCE') differentiates transaction sources.
-- ============================================================

-- Enable UUID generator extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 1. SHARED INVENTORY CATALOG
-- Single product table used by both POS and E-Commerce channels.
-- ============================================================
CREATE TABLE products (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    category        VARCHAR(100),
    price           NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    stock           INTEGER NOT NULL CHECK (stock >= 0),
    is_active       BOOLEAN NOT NULL DEFAULT true,
    image_url       TEXT,
    image_path      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. UNIFIED ORDERS TABLE
-- Tracks orders for both POS and E-Commerce via 'channel' discriminator.
-- ============================================================
CREATE TABLE orders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         VARCHAR(255) NOT NULL,
    channel         VARCHAR(20) NOT NULL CHECK (channel IN ('POS', 'ECOMMERCE')),
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING', 'RESERVED', 'PAID', 'CANCELLED', 'EXPIRED', 'FAILED', 'REFUNDED')),
    total_amount    NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 3. UNIFIED ORDER ITEMS TABLE
-- Line items associated with each order, linking back to shared products.
-- ============================================================
CREATE TABLE order_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id      UUID NOT NULL REFERENCES products(id),
    quantity        INTEGER NOT NULL CHECK (quantity > 0),
    unit_price      NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0)
);

-- ============================================================
-- 4. UNIFIED STOCK RESERVATIONS
-- Temporary stock holds (e.g., 5-minute checkout timeouts) for both channels.
-- ============================================================
CREATE TABLE reservations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id      UUID NOT NULL REFERENCES products(id),
    quantity        INTEGER NOT NULL CHECK (quantity > 0),
    status          VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
                    CHECK (status IN ('ACTIVE', 'EXPIRED', 'RELEASED', 'CONVERTED')),
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 5. UNIFIED PAYMENTS TABLE
-- Mock payment transactions enforcing uniqueness via idempotency keys.
-- ============================================================
CREATE TABLE payments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    idempotency_key VARCHAR(255) NOT NULL UNIQUE,
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED', 'TIMEOUT')),
    amount          NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
    attempted_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 6. UNIFIED REFUNDS TABLE
-- Refund records for cancelled/returned paid orders across channels.
-- ============================================================
CREATE TABLE refunds (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    payment_id      UUID NOT NULL REFERENCES payments(id),
    amount          NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING', 'COMPLETED')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES FOR PERFORMANCE OPTIMIZATION
-- ============================================================
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_orders_channel ON orders(channel);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_reservations_expires_at ON reservations(expires_at) WHERE status = 'ACTIVE';
CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_refunds_order_id ON refunds(order_id);



