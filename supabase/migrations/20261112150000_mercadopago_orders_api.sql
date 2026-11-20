-- Mercado Pago Checkout Pro Orders API identifier for the external order.
ALTER TABLE public.billing_payment_orders
  ADD COLUMN IF NOT EXISTS mercadopago_order_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_payment_orders_mercadopago_order_id
  ON public.billing_payment_orders (mercadopago_order_id)
  WHERE mercadopago_order_id IS NOT NULL;
