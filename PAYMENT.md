# Payment Architecture & Chapa Integration Guide

## 1. Overview & Architecture

The hotel booking payment system supports both **Local Sandbox / Mock Mode** and **Live/Test Chapa Gateway** modes:

```
                  ┌────────────────────────────────────────┐
                  │          Client Application            │
                  │        (Mobile / Web Browser)          │
                  └───────────────────┬────────────────────┘
                                      │
               POST /payments/:bookingId/chapa-intent
                                      │
                                      ▼
                        ┌──────────────────────────┐
                        │      PaymentService      │
                        └─────────────┬────────────┘
                                      │
               ┌──────────────────────┴──────────────────────┐
               │                                             │
      PAYMENT_PROVIDER="mock"                       PAYMENT_PROVIDER="chapa"
               │                                             │
               ▼                                             ▼
    ┌──────────────────────┐                     ┌──────────────────────┐
    │  ChapaMockProvider   │                     │  ChapaPaymentGateway │
    │  - Telebirr SMS OTP  │                     │  (api.chapa.co)      │
    │  - Bank Auth Sim     │                     │  - Hosted Checkout   │
    └──────────────────────┘                     └──────────┬───────────┘
                                                            │
                                              ┌─────────────┴─────────────┐
                                              ▼                           ▼
                                    GET /chapa/callback         POST /webhook/chapa
                                    (Server Verification)       (HMAC-SHA256 Sig Check)
```

---

## 2. Environment Configuration

To switch between the **Local Mock** and **Chapa Gateway**, update `PAYMENT_PROVIDER` in your `.env` file:

```env
# Provider Switch: mock | chapa
PAYMENT_PROVIDER="mock"

# Chapa Secrets (Required when PAYMENT_PROVIDER=chapa)
CHAPA_PUBLIC_KEY="CHAPUBK_TEST-xxxxxxxxxxxxxxxxxxxx"
CHAPA_SECRET_KEY="CHASECK_TEST-xxxxxxxxxxxxxxxxxxxx"
CHAPA_WEBHOOK_SECRET="your-chapa-webhook-secret-or-encryption-key"
CHAPA_BASE_URL="https://api.chapa.co/v1"

# Mock Secret (Used for local mock signature verification)
MOCK_PAYMENT_WEBHOOK_SECRET="your-strong-payment-webhook-secret"
```

---

## 3. Security Protections Implemented

1. **HMAC-SHA256 Webhook Verification**:
   - Webhooks sent to `POST /payments/webhook/chapa` require a valid `x-chapa-signature` header matching the HMAC-SHA256 hash computed with `CHAPA_WEBHOOK_SECRET`.
   - Verified using timing-safe buffer comparison (`crypto.timingSafeEqual`) to prevent timing attacks.

2. **Authoritative Server-to-Server Re-Verification**:
   - The backend **never** trusts the payment status sent in the webhook body or redirect query parameters.
   - Upon receiving a callback or webhook, the backend calls `GET /v1/transaction/verify/:txRef` against Chapa directly.

3. **Strict Amount & Currency Validation**:
   - The verified amount returned by Chapa is strictly compared against the database `booking.totalPrice`.
   - Any discrepancy (> 0.01 tolerance) immediately rejects the transaction.

4. **Stable Transaction References**:
   - Re-initiating or polling an ongoing session reuses the stable `txRef` to prevent orphaned transactions.

---

## 4. Payment Endpoints Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/payments/:bookingId/chapa-intent` | Creates intent; returns `checkoutUrl` (Chapa mode) or starts OTP/Bank session (Mock mode). |
| `POST` | `/payments/webhook/chapa` | Secure webhook endpoint with HMAC signature check & server verification. |
| `GET` | `/payments/chapa/callback` | Redirect callback after checkout that performs server-to-server verification. |
| `POST` | `/payments/:paymentId/verify-otp` | Verifies 6-digit OTP for Telebirr payments (mock mode). |
| `POST` | `/payments/:paymentId/bank-callback` | Simulates bank PIN debit authorization (mock mode). |
| `GET` | `/payments/:paymentId/status` | Returns current payment status for mobile polling. |
