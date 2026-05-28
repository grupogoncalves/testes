# Landing page — Meia Calça Peluciada + Asaas

Landing page mobile-first para venda de meia calça peluciada com campanha de escassez, cronômetro, checkout e integração segura com Asaas.

## O que vem pronto

- Página profissional responsiva em `public/index.html`
- Chamada de escassez com estoque configurável
- Cronômetro de campanha
- Cards de oferta: unidade, kit 2 e kit 3
- Formulário de compra com dados do cliente e entrega
- Backend Node/Express para criar cliente e cobrança no Asaas
- Redirecionamento para a fatura segura do Asaas
- Webhook básico para receber eventos de pagamento
- Registro local de pedidos e webhooks em arquivos `.jsonl`

## Como rodar

1. Instale o Node.js 18 ou superior.
2. Abra a pasta do projeto no terminal.
3. Instale as dependências:

```bash
npm install
```

4. Copie `.env.example` para `.env`:

```bash
cp .env.example .env
```

No Windows PowerShell:

```powershell
copy .env.example .env
```

5. Preencha no `.env`:

```env
ASAAS_ENV=sandbox
ASAAS_API_KEY=$aact_hmlg_SUA_CHAVE_AQUI
PUBLIC_URL=http://localhost:3000
```

6. Rode:

```bash
npm start
```

7. Acesse:

```text
http://localhost:3000
```

## Como colocar em produção

1. Publique o projeto em um servidor com Node.js, como Render, Railway, VPS, DigitalOcean, AWS, Google Cloud ou similar.
2. Troque `PUBLIC_URL` para o domínio real, por exemplo:

```env
PUBLIC_URL=https://seudominio.com.br
```

3. Depois de testar em sandbox, altere:

```env
ASAAS_ENV=production
ASAAS_API_KEY=$aact_prod_SUA_CHAVE_DE_PRODUCAO
```

4. Configure no Asaas o webhook apontando para:

```text
https://seudominio.com.br/api/asaas/webhook
```

Use no Asaas o mesmo token definido em `ASAAS_WEBHOOK_TOKEN`.

## Observações importantes

- Nunca coloque a chave do Asaas no HTML ou JavaScript do navegador.
- A chave fica somente no `.env`, no backend.
- Para uma cobrança avulsa, o backend envia apenas `value`, não envia parcelamento.
- Com `ASAAS_BILLING_TYPE=UNDEFINED`, o cliente escolhe a forma de pagamento disponível na sua conta Asaas.
- O estoque e o cronômetro devem representar uma campanha real para evitar promessa enganosa.

## Onde alterar preço e estoque

No arquivo `.env`:

```env
STOCK_AVAILABLE=17
OFFER_1_PRICE=89.90
OFFER_2_PRICE=149.90
OFFER_3_PRICE=209.90
```
