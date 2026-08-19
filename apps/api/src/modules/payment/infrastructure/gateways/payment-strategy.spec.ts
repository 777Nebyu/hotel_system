import { CreditCardGateway } from './credit-card.gateway';
import { PayPalGateway } from './paypal.gateway';
import { TelebirrGateway } from './telebirr.gateway';
import { CbeBirrGateway } from './cbe-birr.gateway';
import { CashGateway } from './cash.gateway';
import { PaymentGatewayRegistry } from '../gateway-registry';

// ---------------------------------------------------------------------------
// Shared charge input — amount does not affect approve/decline in mock gateways
// ---------------------------------------------------------------------------
const anyAmount = 250;

// ---------------------------------------------------------------------------
// CreditCardGateway
// ---------------------------------------------------------------------------

describe('CreditCardGateway', () => {
  let gateway: CreditCardGateway;

  beforeEach(() => {
    gateway = new CreditCardGateway();
  });

  it('has method CREDIT_CARD', () => {
    expect(gateway.method).toBe('CREDIT_CARD');
  });

  // ── approve cases — exact test card numbers ────────────────────────────
  describe('approved references', () => {
    it.each([
      '4242424242424242',
      '4917484589897108',
      '4716293094400436',
    ])('approves card number %s', async (ref) => {
      const result = await gateway.charge({ amount: anyAmount, reference: ref });
      expect(result.approved).toBe(true);
    });

    it('approves a card number with spaces stripped (4242 with spaces)', async () => {
      const result = await gateway.charge({
        amount: anyAmount,
        reference: '4242 4242 4242 4242',
      });
      expect(result.approved).toBe(true);
    });

    it('approves a card number with dashes stripped', async () => {
      const result = await gateway.charge({
        amount: anyAmount,
        reference: '4242-4242-4242-4242',
      });
      expect(result.approved).toBe(true);
    });
  });

  // ── decline cases ──────────────────────────────────────────────────────
  describe('declined references', () => {
    it.each([
      '0000000000000000',
      '1234567890123456',
      '4111111111111111',
      '',
      'not-a-card',
    ])('declines reference "%s"', async (ref) => {
      const result = await gateway.charge({ amount: anyAmount, reference: ref });
      expect(result.approved).toBe(false);
    });
  });

  // ── providerRef shape ──────────────────────────────────────────────────
  it('always returns a non-empty providerRef string', async () => {
    const result = await gateway.charge({
      amount: anyAmount,
      reference: '4242424242424242',
    });
    expect(typeof result.providerRef).toBe('string');
    expect(result.providerRef.length).toBeGreaterThan(0);
    expect(result.providerRef).toMatch(/^mock_credit_card_/);
  });
});

// ---------------------------------------------------------------------------
// PayPalGateway
// ---------------------------------------------------------------------------

describe('PayPalGateway', () => {
  let gateway: PayPalGateway;

  beforeEach(() => {
    gateway = new PayPalGateway();
  });

  it('has method PAYPAL', () => {
    expect(gateway.method).toBe('PAYPAL');
  });

  // ── approve case — exact test email ───────────────────────────────────
  describe('approved references', () => {
    it('approves the exact test email approved@paypal.test', async () => {
      const result = await gateway.charge({
        amount: anyAmount,
        reference: 'approved@paypal.test',
      });
      expect(result.approved).toBe(true);
    });

    it('approves the test email in uppercase (case-insensitive)', async () => {
      const result = await gateway.charge({
        amount: anyAmount,
        reference: 'APPROVED@PAYPAL.TEST',
      });
      expect(result.approved).toBe(true);
    });

    it('approves the test email in mixed case', async () => {
      const result = await gateway.charge({
        amount: anyAmount,
        reference: 'Approved@PayPal.Test',
      });
      expect(result.approved).toBe(true);
    });
  });

  // ── decline cases ──────────────────────────────────────────────────────
  describe('declined references', () => {
    it.each([
      'user@paypal.test',
      'approved@paypal.com',
      'anything@example.com',
      '',
      'PAYPAL-FAIL',
    ])('declines reference "%s"', async (ref) => {
      const result = await gateway.charge({ amount: anyAmount, reference: ref });
      expect(result.approved).toBe(false);
    });
  });

  // ── providerRef shape ──────────────────────────────────────────────────
  it('always returns a non-empty providerRef string', async () => {
    const result = await gateway.charge({
      amount: anyAmount,
      reference: 'approved@paypal.test',
    });
    expect(result.providerRef).toMatch(/^mock_paypal_/);
  });
});

// ---------------------------------------------------------------------------
// TelebirrGateway
// ---------------------------------------------------------------------------

describe('TelebirrGateway', () => {
  let gateway: TelebirrGateway;

  beforeEach(() => {
    gateway = new TelebirrGateway();
  });

  it('has method TELEBIRR', () => {
    expect(gateway.method).toBe('TELEBIRR');
  });

  // ── approve cases ─────────────────────────────────────────────────────
  describe('approved references', () => {
    it('approves the E.164 test number +251911000001', async () => {
      const result = await gateway.charge({
        amount: anyAmount,
        reference: '+251911000001',
      });
      expect(result.approved).toBe(true);
    });

    it('approves the local format test number 0911000001', async () => {
      const result = await gateway.charge({
        amount: anyAmount,
        reference: '0911000001',
      });
      expect(result.approved).toBe(true);
    });

    it('approves E.164 number with spaces stripped', async () => {
      const result = await gateway.charge({
        amount: anyAmount,
        reference: '+251 911 000 001',
      });
      expect(result.approved).toBe(true);
    });

    it('approves local number with dashes stripped', async () => {
      const result = await gateway.charge({
        amount: anyAmount,
        reference: '0911-000-001',
      });
      expect(result.approved).toBe(true);
    });
  });

  // ── decline cases ──────────────────────────────────────────────────────
  describe('declined references', () => {
    it.each([
      '0911000002',        // CBE Birr number, not Telebirr
      '+251911000002',     // CBE Birr E.164
      '0900000000',        // arbitrary number
      '',
      'not-a-phone',
    ])('declines reference "%s"', async (ref) => {
      const result = await gateway.charge({ amount: anyAmount, reference: ref });
      expect(result.approved).toBe(false);
    });
  });

  // ── providerRef shape ──────────────────────────────────────────────────
  it('always returns a non-empty providerRef string', async () => {
    const result = await gateway.charge({
      amount: anyAmount,
      reference: '0911000001',
    });
    expect(result.providerRef).toMatch(/^mock_telebirr_/);
  });
});

// ---------------------------------------------------------------------------
// CbeBirrGateway
// ---------------------------------------------------------------------------

describe('CbeBirrGateway', () => {
  let gateway: CbeBirrGateway;

  beforeEach(() => {
    gateway = new CbeBirrGateway();
  });

  it('has method CBE_BIRR', () => {
    expect(gateway.method).toBe('CBE_BIRR');
  });

  // ── approve cases ─────────────────────────────────────────────────────
  describe('approved references', () => {
    it('approves the E.164 test number +251911000002', async () => {
      const result = await gateway.charge({
        amount: anyAmount,
        reference: '+251911000002',
      });
      expect(result.approved).toBe(true);
    });

    it('approves the local format test number 0911000002', async () => {
      const result = await gateway.charge({
        amount: anyAmount,
        reference: '0911000002',
      });
      expect(result.approved).toBe(true);
    });

    it('approves E.164 number with spaces stripped', async () => {
      const result = await gateway.charge({
        amount: anyAmount,
        reference: '+251 911 000 002',
      });
      expect(result.approved).toBe(true);
    });

    it('approves local number with dashes stripped', async () => {
      const result = await gateway.charge({
        amount: anyAmount,
        reference: '0911-000-002',
      });
      expect(result.approved).toBe(true);
    });
  });

  // ── decline cases ──────────────────────────────────────────────────────
  describe('declined references', () => {
    it.each([
      '0911000001',        // Telebirr number, not CBE Birr
      '+251911000001',     // Telebirr E.164
      '0900000000',        // arbitrary number
      '',
      'not-a-phone',
    ])('declines reference "%s"', async (ref) => {
      const result = await gateway.charge({ amount: anyAmount, reference: ref });
      expect(result.approved).toBe(false);
    });
  });

  // ── providerRef shape ──────────────────────────────────────────────────
  it('always returns a non-empty providerRef string', async () => {
    const result = await gateway.charge({
      amount: anyAmount,
      reference: '0911000002',
    });
    expect(result.providerRef).toMatch(/^mock_cbe_birr_/);
  });
});

// ---------------------------------------------------------------------------
// CashGateway
// ---------------------------------------------------------------------------

describe('CashGateway', () => {
  let gateway: CashGateway;

  beforeEach(() => {
    gateway = new CashGateway();
  });

  it('has method CASH', () => {
    expect(gateway.method).toBe('CASH');
  });

  // ── always approved — cash requires no reference validation ───────────
  describe('always approved regardless of reference', () => {
    it.each([
      'RECEIPT-001',
      '12345',
      '',
      'any-arbitrary-string',
      'null',
    ])('approves reference "%s"', async (ref) => {
      const result = await gateway.charge({ amount: anyAmount, reference: ref });
      expect(result.approved).toBe(true);
    });
  });

  it('approves regardless of amount', async () => {
    for (const amount of [0, 1, 999_999]) {
      const result = await gateway.charge({ amount, reference: 'receipt' });
      expect(result.approved).toBe(true);
    }
  });

  // ── providerRef shape ──────────────────────────────────────────────────
  it('always returns a non-empty providerRef string', async () => {
    const result = await gateway.charge({ amount: anyAmount, reference: 'cash-ref' });
    expect(result.providerRef).toMatch(/^mock_cash_/);
  });
});

// ---------------------------------------------------------------------------
// PaymentGatewayRegistry
// ---------------------------------------------------------------------------

describe('PaymentGatewayRegistry', () => {
  const gateways = [
    new CreditCardGateway(),
    new PayPalGateway(),
    new TelebirrGateway(),
    new CbeBirrGateway(),
    new CashGateway(),
  ];

  let registry: PaymentGatewayRegistry;

  beforeEach(() => {
    registry = new PaymentGatewayRegistry(gateways);
  });

  // ── retrieval of known gateways ────────────────────────────────────────
  describe('get() — known methods', () => {
    it.each([
      ['CREDIT_CARD', CreditCardGateway],
      ['PAYPAL', PayPalGateway],
      ['TELEBIRR', TelebirrGateway],
      ['CBE_BIRR', CbeBirrGateway],
      ['CASH', CashGateway],
    ] as const)('returns the correct gateway for method %s', (method, GatewayClass) => {
      expect(registry.get(method)).toBeInstanceOf(GatewayClass);
    });
  });

  // ── unknown method throws ──────────────────────────────────────────────
  describe('get() — unknown method', () => {
    it('throws an error for an unregistered method', () => {
      expect(() => registry.get('STRIPE')).toThrow();
    });

    it('error message names the unregistered method', () => {
      expect(() => registry.get('UNKNOWN_GATEWAY')).toThrow('UNKNOWN_GATEWAY');
    });

    it('throws for an empty string method', () => {
      expect(() => registry.get('')).toThrow();
    });
  });

  // ── empty registry ─────────────────────────────────────────────────────
  describe('empty registry', () => {
    it('throws for any method when no gateways are registered', () => {
      const emptyRegistry = new PaymentGatewayRegistry([]);
      expect(() => emptyRegistry.get('CASH')).toThrow();
    });
  });

  // ── retrieved gateway is fully functional ────────────────────────────
  it('the retrieved CREDIT_CARD gateway actually processes a charge', async () => {
    const gw = registry.get('CREDIT_CARD');
    const result = await gw.charge({
      amount: 100,
      reference: '4242424242424242',
    });
    expect(result.approved).toBe(true);
  });

  it('the retrieved CASH gateway always approves', async () => {
    const gw = registry.get('CASH');
    const result = await gw.charge({ amount: 50, reference: 'any' });
    expect(result.approved).toBe(true);
  });

  // ── last-registered gateway wins on duplicate method ──────────────────
  it('registers all 5 gateways and each is independently retrievable', () => {
    const methods = ['CREDIT_CARD', 'PAYPAL', 'TELEBIRR', 'CBE_BIRR', 'CASH'];
    for (const method of methods) {
      expect(() => registry.get(method)).not.toThrow();
    }
  });
});
