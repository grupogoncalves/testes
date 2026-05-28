import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 3000);
const ASAAS_ENV = process.env.ASAAS_ENV === 'production' ? 'production' : 'sandbox';
const ASAAS_BASE_URL = ASAAS_ENV === 'production'
  ? 'https://api.asaas.com/v3'
  : 'https://api-sandbox.asaas.com/v3';

const PUBLIC_URL = (process.env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const API_KEY = process.env.ASAAS_API_KEY;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const onlyDigits = (value = '') => String(value).replace(/\D/g, '');
const money = (value) => Number.parseFloat(String(value).replace(',', '.'));

const offers = {
  unit: {
    id: 'unit',
    label: '1 unidade',
    subtitle: 'Para testar hoje',
    quantity: 1,
    price: money(process.env.OFFER_1_PRICE || 89.90)
  },
  duo: {
    id: 'duo',
    label: 'Kit 2 unidades',
    subtitle: 'Mais vendido',
    quantity: 2,
    price: money(process.env.OFFER_2_PRICE || 149.90)
  },
  trio: {
    id: 'trio',
    label: 'Kit 3 unidades',
    subtitle: 'Melhor custo-benefício',
    quantity: 3,
    price: money(process.env.OFFER_3_PRICE || 209.90)
  }
};

function dueDate(days = 2) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

async function asaasRequest(pathname, options = {}) {
  if (!API_KEY || API_KEY.includes('SUA_CHAVE_AQUI')) {
    const error = new Error('ASAAS_API_KEY não configurada no .env.');
    error.status = 500;
    throw error;
  }

  const response = await fetch(`${ASAAS_BASE_URL}${pathname}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': process.env.APP_USER_AGENT || 'meia-peluciada-lp/1.0',
      access_token: API_KEY,
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }

  if (!response.ok) {
    const details = data?.errors?.map((e) => e.description).join(' | ') || data?.message || response.statusText;
    const error = new Error(details);
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  return data;
}

async function findOrCreateCustomer(order) {
  const cpfCnpj = onlyDigits(order.cpfCnpj);
  const search = await asaasRequest(`/customers?cpfCnpj=${encodeURIComponent(cpfCnpj)}&limit=1`, { method: 'GET' });
  const existing = Array.isArray(search?.data) ? search.data[0] : null;
  if (existing?.id) return existing;

  return asaasRequest('/customers', {
    method: 'POST',
    body: JSON.stringify({
      name: order.name,
      cpfCnpj,
      email: order.email,
      mobilePhone: onlyDigits(order.phone),
      postalCode: onlyDigits(order.postalCode),
      address: order.address,
      addressNumber: order.addressNumber,
      complement: order.complement,
      province: order.neighborhood,
      externalReference: `lp-meia-${cpfCnpj}`,
      notificationDisabled: false,
      observations: `Cliente originado da landing page de ${process.env.PRODUCT_NAME || 'Meia Calça Peluciada'}`
    })
  });
}

async function saveLocalOrder(order) {
  const dir = path.join(__dirname, 'data');
  await fs.mkdir(dir, { recursive: true });
  await fs.appendFile(path.join(dir, 'orders.jsonl'), JSON.stringify(order) + '\n');
}

app.get('/api/config', (_req, res) => {
  res.json({
    productName: process.env.PRODUCT_NAME || 'Meia Calça Peluciada Premium',
    supportWhatsapp: process.env.SUPPORT_WHATSAPP || '5547999999999',
    stockAvailable: Number(process.env.STOCK_AVAILABLE || 17),
    offers: Object.values(offers),
    environment: ASAAS_ENV
  });
});

app.post('/api/checkout', async (req, res) => {
  try {
    const {
      offerId = 'duo', name, email, phone, cpfCnpj,
      postalCode, address, addressNumber, complement, neighborhood, city, state, size = 'Único'
    } = req.body || {};

    const offer = offers[offerId];
    if (!offer) return res.status(400).json({ error: 'Oferta inválida.' });

    const cpf = onlyDigits(cpfCnpj);
    const phoneDigits = onlyDigits(phone);
    if (!name || name.trim().length < 3) return res.status(400).json({ error: 'Informe o nome completo.' });
    if (!/^\S+@\S+\.\S+$/.test(String(email || ''))) return res.status(400).json({ error: 'Informe um e-mail válido.' });
    if (![11, 14].includes(cpf.length)) return res.status(400).json({ error: 'Informe CPF ou CNPJ válido, apenas números ou com pontuação.' });
    if (phoneDigits.length < 10) return res.status(400).json({ error: 'Informe um WhatsApp válido com DDD.' });
    if (!postalCode || onlyDigits(postalCode).length < 8) return res.status(400).json({ error: 'Informe o CEP para entrega.' });
    if (!address || !addressNumber || !city || !state) return res.status(400).json({ error: 'Informe endereço, número, cidade e UF.' });

    const orderRef = `MEIA-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const order = {
      orderRef,
      offer,
      name: name.trim(),
      email: email.trim(),
      phone: phoneDigits,
      cpfCnpj: cpf,
      postalCode: onlyDigits(postalCode),
      address: address.trim(),
      addressNumber: String(addressNumber).trim(),
      complement: complement?.trim() || '',
      neighborhood: neighborhood?.trim() || '',
      city: city?.trim() || '',
      state: String(state || '').trim().toUpperCase(),
      size,
      createdAt: new Date().toISOString(),
      source: 'landing-page-meia-peluciada'
    };

    const customer = await findOrCreateCustomer(order);

    const description = `${process.env.PRODUCT_NAME || 'Meia Calça Peluciada Premium'} | ${offer.label} | Tamanho: ${size} | Pedido: ${orderRef} | Entrega: ${order.address}, ${order.addressNumber}, ${order.neighborhood}, ${order.city}/${order.state}, CEP ${order.postalCode}`;

    const payment = await asaasRequest('/payments', {
      method: 'POST',
      body: JSON.stringify({
        customer: customer.id,
        billingType: process.env.ASAAS_BILLING_TYPE || 'UNDEFINED',
        value: offer.price,
        dueDate: dueDate(2),
        description,
        externalReference: orderRef,
        postalService: false,
        callback: {
          successUrl: `${PUBLIC_URL}/obrigado.html?pedido=${encodeURIComponent(orderRef)}`,
          autoRedirect: true
        }
      })
    });

    await saveLocalOrder({ ...order, customerId: customer.id, paymentId: payment.id, invoiceUrl: payment.invoiceUrl });

    res.json({
      ok: true,
      orderRef,
      paymentId: payment.id,
      invoiceUrl: payment.invoiceUrl,
      value: offer.price
    });
  } catch (error) {
    console.error('[checkout:error]', error.payload || error.message);
    res.status(error.status || 500).json({
      error: 'Não foi possível iniciar o pagamento.',
      detail: error.message
    });
  }
});

app.post('/api/asaas/webhook', async (req, res) => {
  const configuredToken = process.env.ASAAS_WEBHOOK_TOKEN;
  const incomingToken = req.headers['asaas-access-token'];

  if (configuredToken && configuredToken.length >= 32 && incomingToken !== configuredToken) {
    return res.status(401).json({ received: false });
  }

  const event = req.body;
  console.log('[asaas:webhook]', event?.event, event?.payment?.id || 'sem_payment_id');

  try {
    const dir = path.join(__dirname, 'data');
    await fs.mkdir(dir, { recursive: true });
    await fs.appendFile(path.join(dir, 'webhooks.jsonl'), JSON.stringify({ receivedAt: new Date().toISOString(), event }) + '\n');
  } catch (err) {
    console.error('[webhook:save:error]', err.message);
  }

  res.json({ received: true });
});

app.get('/health', (_req, res) => res.json({ ok: true, env: ASAAS_ENV }));

app.listen(PORT, () => {
  console.log(`Landing page rodando em ${PUBLIC_URL}`);
  console.log(`Asaas: ${ASAAS_ENV} - ${ASAAS_BASE_URL}`);
});
