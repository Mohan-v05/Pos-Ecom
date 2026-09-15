const supabase = require('../supabaseClient');

const fail = (message, status = 400) => Object.assign(new Error(message), { status });

function normaliseItems(items) {
  if (!Array.isArray(items) || items.length === 0) throw fail('At least one order item is required.');
  const quantities = new Map();
  for (const item of items) {
    const quantity = Number(item?.quantity);
    if (!item?.product_id || !Number.isInteger(quantity) || quantity <= 0) throw fail('Each item requires a product_id and a positive whole-number quantity.');
    quantities.set(item.product_id, (quantities.get(item.product_id) || 0) + quantity);
  }
  return [...quantities].map(([product_id, quantity]) => ({ product_id, quantity }));
}

async function pricedItems(items, { checkStock = false } = {}) {
  const requested = normaliseItems(items);
  const ids = requested.map((item) => item.product_id);
  const { data: products, error } = await supabase.from('products').select('id, name, price, stock').in('id', ids);
  if (error) throw fail(error.message);
  if (!products || products.length !== ids.length) throw fail('One or more products no longer exist.', 404);
  const byId = new Map(products.map((product) => [product.id, product]));
  return requested.map((item) => {
    const product = byId.get(item.product_id);
    if (checkStock && Number(product.stock) < item.quantity) throw fail(`${product.name} has only ${product.stock} item(s) available.`);
    return { ...item, unit_price: Number(product.price), product };
  });
}

async function createOrder({ userId, channel, items }) {
  if (!userId?.trim()) throw fail('user_id is required.');
  const priced = await pricedItems(items, { checkStock: true });
  const total = priced.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  const { data: order, error: orderError } = await supabase.from('orders').insert({ user_id: userId.trim(), channel, total_amount: total, status: 'PENDING' }).select().single();
  if (orderError) throw fail(orderError.message);
  const { data: orderItems, error: itemError } = await supabase.from('order_items').insert(priced.map(({ product, ...item }) => ({ order_id: order.id, ...item }))).select();
  if (itemError) {
    await supabase.from('orders').delete().eq('id', order.id);
    throw fail(itemError.message);
  }
  return { order, items: orderItems };
}

async function getChannelOrder(orderId, channel, withItems = false) {
  const { data, error } = await supabase.from('orders').select(withItems ? '*, order_items(*)' : '*').eq('id', orderId).eq('channel', channel).single();
  if (error || !data) throw fail('Order not found for this sales channel.', 404);
  return data;
}

async function releaseExpiredReservations() {
  const now = new Date().toISOString();
  const { data: expired, error } = await supabase.from('reservations').select('id, product_id, quantity, order_id').eq('status', 'ACTIVE').lt('expires_at', now);
  if (error || !expired?.length) return;
  for (const reservation of expired) {
    const { data: claimed } = await supabase.from('reservations').update({ status: 'EXPIRED' }).eq('id', reservation.id).eq('status', 'ACTIVE').select('id').maybeSingle();
    if (!claimed) continue;
    const { data: product } = await supabase.from('products').select('stock').eq('id', reservation.product_id).single();
    if (product) await supabase.from('products').update({ stock: Number(product.stock) + Number(reservation.quantity), updated_at: now }).eq('id', reservation.product_id);
    await supabase.from('orders').update({ status: 'EXPIRED', updated_at: now }).eq('id', reservation.order_id).eq('status', 'RESERVED');
  }
}

module.exports = { fail, normaliseItems, pricedItems, createOrder, getChannelOrder, releaseExpiredReservations };
