// Contoh backend Midtrans Snap untuk Kenzz Store.
// Jalankan di server Node.js, JANGAN di browser/hosting statis.
// npm install express @supabase/supabase-js
// Environment: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MIDTRANS_SERVER_KEY,
// MIDTRANS_IS_PRODUCTION (true/false), PORT
const express = require('express');
const crypto = require('crypto');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || true }));
app.use(express.json());
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});
const serverKey = process.env.MIDTRANS_SERVER_KEY;
const production = process.env.MIDTRANS_IS_PRODUCTION === 'true';
const midtransBase = production ? 'https://app.midtrans.com' : 'https://app.sandbox.midtrans.com';

function bearer(req) {
  const value = req.headers.authorization || '';
  return value.startsWith('Bearer ') ? value.slice(7) : '';
}

app.post('/create-order-payment', async (req, res) => {
  try {
    if (!serverKey) return res.status(500).json({ error: 'MIDTRANS_SERVER_KEY belum diatur.' });
    const token = bearer(req);
    if (!token) return res.status(401).json({ error: 'Login diperlukan.' });
    const { data: auth, error: authError } = await supabase.auth.getUser(token);
    if (authError || !auth.user) return res.status(401).json({ error: 'Sesi login tidak valid.' });

    const orderId = String(req.body.order_id || '');
    const { data: order, error } = await supabase.from('orders')
      .select('id,user_id,total_amount,status,delivery_email')
      .eq('id', orderId).eq('user_id', auth.user.id).single();
    if (error || !order) return res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
    if (order.status !== 'pending_payment') return res.status(409).json({ error: 'Pesanan tidak menunggu pembayaran.' });

    const { data: items } = await supabase.from('order_items')
      .select('product_name,unit_price,quantity').eq('order_id', order.id);
    const amount = Number(order.total_amount);
    const payload = {
      transaction_details: { order_id: order.id, gross_amount: amount },
      item_details: (items || []).map(x => ({ id: x.product_name.slice(0, 50), price: Number(x.unit_price), quantity: Number(x.quantity), name: x.product_name.slice(0, 50) })),
      customer_details: { email: order.delivery_email || auth.user.email }
    };
    const response = await fetch(`${midtransBase}/snap/v1/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${serverKey}:`).toString('base64')}`
      },
      body: JSON.stringify(payload)
    });
    const invoice = await response.json();
    if (!response.ok || !invoice.redirect_url) {
      return res.status(502).json({ error: invoice.error_messages?.join(', ') || 'Midtrans gagal membuat invoice.' });
    }
    return res.json({ payment_url: invoice.redirect_url, token: invoice.token });
  } catch (e) {
    console.error('create-order-payment:', e);
    return res.status(500).json({ error: 'Gagal menyiapkan pembayaran.' });
  }
});

app.post('/midtrans-webhook', async (req, res) => {
  try {
    if (!serverKey) return res.status(500).send('Server key missing');
    const n = req.body || {};
    const raw = `${n.order_id}${n.status_code}${n.gross_amount}${serverKey}`;
    const expected = crypto.createHash('sha512').update(raw).digest('hex');
    const received = String(n.signature_key || '');
    const a = Buffer.from(expected);
    const b = Buffer.from(received);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(401).send('Invalid signature');

    const { data: order, error } = await supabase.from('orders')
      .select('id,total_amount,status').eq('id', n.order_id).single();
    if (error || !order) return res.status(404).send('Order not found');
    if (Number(n.gross_amount) !== Number(order.total_amount)) return res.status(400).send('Amount mismatch');

    const paid = n.transaction_status === 'settlement' ||
      (n.transaction_status === 'capture' && (!n.fraud_status || n.fraud_status === 'accept'));
    if (paid) {
      const { error: rpcError } = await supabase.rpc('confirm_order_payment', {
        p_order_id: order.id, p_provider: `midtrans:${n.payment_type || 'snap'}`
      });
      if (rpcError) throw rpcError;
    } else if (['deny', 'cancel', 'expire'].includes(n.transaction_status) && order.status === 'pending_payment') {
      await supabase.from('orders').update({ status: 'cancelled' }).eq('id', order.id).eq('status', 'pending_payment');
    }
    return res.status(200).send('OK');
  } catch (e) {
    console.error('midtrans-webhook:', e);
    return res.status(500).send('Webhook processing failed');
  }
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`Kenzz payment backend listening on ${port}`));
