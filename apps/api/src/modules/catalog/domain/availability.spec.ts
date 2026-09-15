import {
  dateKey,
  parseDateOnly,
  isAvailableOn,
  availableNights,
  roomAvailableAcross,
} from './availability';

// ---------------------------------------------------------------------------
// Helpers — keep tests readable
// ---------------------------------------------------------------------------

/** Build a UTC midnight Date from a YYYY-MM-DD string. */
const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** Shorthand: build an override entry. */
const override = (
  date: Date,
  status: 'AVAILABLE' | 'UNAVAILABLE' | 'MAINTENANCE',
) => ({ date, status });

// ---------------------------------------------------------------------------
// dateKey — ISO date string extractor
// ---------------------------------------------------------------------------

describe('dateKey', () => {
  it('returns YYYY-MM-DD for a UTC midnight date', () => {
    expect(dateKey(d('2026-09-01'))).toBe('2026-09-01');
  });

  it('returns the date portion only, ignoring time', () => {
    // Non-midnight timestamp — still yields correct date
    const ts = new Date('2026-09-15T14:35:22.000Z');
    expect(dateKey(ts)).toBe('2026-09-15');
  });

  it('handles year-end / year-start boundary', () => {
    expect(dateKey(d('2026-12-31'))).toBe('2026-12-31');
    expect(dateKey(d('2027-01-01'))).toBe('2027-01-01');
  });
});

// ---------------------------------------------------------------------------
// parseDateOnly — string → UTC midnight Date
// ---------------------------------------------------------------------------

describe('parseDateOnly', () => {
  it('parses a YYYY-MM-DD string to UTC midnight', () => {
    const result = parseDateOnly('2026-09-01');
    expect(result.toISOString()).toBe('2026-09-01T00:00:00.000Z');
  });

  it('round-trips through dateKey', () => {
    const iso = '2026-11-05';
    expect(dateKey(parseDateOnly(iso))).toBe(iso);
  });
});

// ---------------------------------------------------------------------------
// isAvailableOn — single-night availability check
// ---------------------------------------------------------------------------

describe('isAvailableOn', () => {
  const date = d('2026-09-10');

  // ── no overrides — room status is the source of truth ─────────────────
  describe('no overrides — uses room status', () => {
    it('returns true when room is AVAILABLE and there are no overrides', () => {
      expect(isAvailableOn('AVAILABLE', [], date)).toBe(true);
    });

    it('returns false when room is UNAVAILABLE and there are no overrides', () => {
      expect(isAvailableOn('UNAVAILABLE', [], date)).toBe(false);
    });

    it('returns false when room is MAINTENANCE and there are no overrides', () => {
      expect(isAvailableOn('MAINTENANCE', [], date)).toBe(false);
    });
  });

  // ── matching override — override wins over room status ─────────────────
  describe('matching override — override wins', () => {
    it('returns false when override on exact date says UNAVAILABLE (room is AVAILABLE)', () => {
      expect(
        isAvailableOn('AVAILABLE', [override(date, 'UNAVAILABLE')], date),
      ).toBe(false);
    });

    it('returns false when override on exact date says MAINTENANCE (room is AVAILABLE)', () => {
      expect(
        isAvailableOn('AVAILABLE', [override(date, 'MAINTENANCE')], date),
      ).toBe(false);
    });

    it('returns true when override on exact date says AVAILABLE (room is UNAVAILABLE)', () => {
      expect(
        isAvailableOn('UNAVAILABLE', [override(date, 'AVAILABLE')], date),
      ).toBe(true);
    });

    it('returns true when override on exact date says AVAILABLE (room is MAINTENANCE)', () => {
      expect(
        isAvailableOn('MAINTENANCE', [override(date, 'AVAILABLE')], date),
      ).toBe(true);
    });
  });

  // ── non-matching override — override on a different date is ignored ────
  describe('non-matching override — ignored', () => {
    const otherDate = d('2026-09-11');

    it('ignores override on a different date — falls back to AVAILABLE room status', () => {
      expect(
        isAvailableOn('AVAILABLE', [override(otherDate, 'UNAVAILABLE')], date),
      ).toBe(true);
    });

    it('ignores override on a different date — falls back to UNAVAILABLE room status', () => {
      expect(
        isAvailableOn('UNAVAILABLE', [override(otherDate, 'AVAILABLE')], date),
      ).toBe(false);
    });
  });

  // ── multiple overrides — only the matching date matters ───────────────
  describe('multiple overrides', () => {
    it('picks the matching date from a list of overrides', () => {
      const overrides = [
        override(d('2026-09-08'), 'UNAVAILABLE'),
        override(d('2026-09-10'), 'UNAVAILABLE'), // this one matches
        override(d('2026-09-12'), 'UNAVAILABLE'),
      ];
      expect(isAvailableOn('AVAILABLE', overrides, date)).toBe(false);
    });

    it('returns room status when no override in the list matches', () => {
      const overrides = [
        override(d('2026-09-08'), 'UNAVAILABLE'),
        override(d('2026-09-12'), 'UNAVAILABLE'),
      ];
      expect(isAvailableOn('AVAILABLE', overrides, date)).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// availableNights — count available nights in a date range
// ---------------------------------------------------------------------------

describe('availableNights', () => {
  // ── zero-night range ───────────────────────────────────────────────────
  describe('zero-night range (from === toExclusive)', () => {
    it('returns 0 when check-in equals check-out', () => {
      expect(
        availableNights('AVAILABLE', [], d('2026-09-01'), d('2026-09-01')),
      ).toBe(0);
    });
  });

  // ── all nights available ───────────────────────────────────────────────
  describe('all nights available', () => {
    it('counts 1 night for a single-night stay', () => {
      expect(
        availableNights('AVAILABLE', [], d('2026-09-01'), d('2026-09-02')),
      ).toBe(1);
    });

    it('counts 3 nights for a 3-night stay', () => {
      expect(
        availableNights('AVAILABLE', [], d('2026-09-01'), d('2026-09-04')),
      ).toBe(3);
    });

    it('counts 7 nights for a week-long stay', () => {
      expect(
        availableNights('AVAILABLE', [], d('2026-09-01'), d('2026-09-08')),
      ).toBe(7);
    });
  });

  // ── room fully unavailable ─────────────────────────────────────────────
  describe('room status blocks all nights', () => {
    it('returns 0 when room is UNAVAILABLE with no overrides', () => {
      expect(
        availableNights('UNAVAILABLE', [], d('2026-09-01'), d('2026-09-04')),
      ).toBe(0);
    });

    it('returns 0 when room is MAINTENANCE with no overrides', () => {
      expect(
        availableNights('MAINTENANCE', [], d('2026-09-01'), d('2026-09-04')),
      ).toBe(0);
    });
  });

  // ── partial blocks via overrides ───────────────────────────────────────
  describe('partial blocks via date overrides', () => {
    it('reduces count by 1 when the middle night is blocked', () => {
      // Sep 01→04, 3 nights; Sep 02 blocked
      const overrides = [override(d('2026-09-02'), 'UNAVAILABLE')];
      expect(
        availableNights('AVAILABLE', overrides, d('2026-09-01'), d('2026-09-04')),
      ).toBe(2);
    });

    it('reduces count by 1 when the first night is blocked', () => {
      const overrides = [override(d('2026-09-01'), 'UNAVAILABLE')];
      expect(
        availableNights('AVAILABLE', overrides, d('2026-09-01'), d('2026-09-04')),
      ).toBe(2);
    });

    it('reduces count by 1 when the last night is blocked', () => {
      // Range Sep 01→04 covers nights Sep 01, Sep 02, Sep 03 (toExclusive)
      const overrides = [override(d('2026-09-03'), 'UNAVAILABLE')];
      expect(
        availableNights('AVAILABLE', overrides, d('2026-09-01'), d('2026-09-04')),
      ).toBe(2);
    });

    it('returns 0 when all nights are individually blocked by overrides', () => {
      const overrides = [
        override(d('2026-09-01'), 'UNAVAILABLE'),
        override(d('2026-09-02'), 'UNAVAILABLE'),
        override(d('2026-09-03'), 'UNAVAILABLE'),
      ];
      expect(
        availableNights('AVAILABLE', overrides, d('2026-09-01'), d('2026-09-04')),
      ).toBe(0);
    });

    it('an AVAILABLE override on one night un-blocks it when room is UNAVAILABLE', () => {
      // Room is UNAVAILABLE but Sep 02 has an AVAILABLE override
      const overrides = [override(d('2026-09-02'), 'AVAILABLE')];
      expect(
        availableNights('UNAVAILABLE', overrides, d('2026-09-01'), d('2026-09-04')),
      ).toBe(1);
    });
  });

  // ── toExclusive boundary — check-out night is NOT charged ─────────────
  describe('toExclusive boundary', () => {
    it('does not count the check-out date as a night', () => {
      // Sep 01→03 = nights Sep 01, Sep 02 only — Sep 03 is check-out, not a night
      const overrides = [override(d('2026-09-03'), 'UNAVAILABLE')];
      // Sep 03 is excluded from the loop, so the override has no effect on the count
      expect(
        availableNights('AVAILABLE', overrides, d('2026-09-01'), d('2026-09-03')),
      ).toBe(2);
    });
  });
});

// ---------------------------------------------------------------------------
// roomAvailableAcross — full stay availability check
// ---------------------------------------------------------------------------

describe('roomAvailableAcross', () => {
  // ── zero-night range ───────────────────────────────────────────────────
  describe('zero-night range', () => {
    it('returns true when check-in equals check-out (0 nights required, 0 available)', () => {
      // 0 availableNights === 0 required nights → true
      expect(
        roomAvailableAcross('AVAILABLE', [], d('2026-09-01'), d('2026-09-01')),
      ).toBe(true);
    });

    it('returns true even for UNAVAILABLE room when range is zero nights', () => {
      expect(
        roomAvailableAcross('UNAVAILABLE', [], d('2026-09-01'), d('2026-09-01')),
      ).toBe(true);
    });
  });

  // ── single-night stay ──────────────────────────────────────────────────
  describe('single-night stay', () => {
    it('returns true when the one night is available', () => {
      expect(
        roomAvailableAcross('AVAILABLE', [], d('2026-09-01'), d('2026-09-02')),
      ).toBe(true);
    });

    it('returns false when the one night is blocked by room status', () => {
      expect(
        roomAvailableAcross('UNAVAILABLE', [], d('2026-09-01'), d('2026-09-02')),
      ).toBe(false);
    });

    it('returns false when the one night is blocked by an override', () => {
      const overrides = [override(d('2026-09-01'), 'UNAVAILABLE')];
      expect(
        roomAvailableAcross('AVAILABLE', overrides, d('2026-09-01'), d('2026-09-02')),
      ).toBe(false);
    });
  });

  // ── multi-night stay — all nights must be available ───────────────────
  describe('multi-night stay', () => {
    it('returns true when all 3 nights are available', () => {
      expect(
        roomAvailableAcross('AVAILABLE', [], d('2026-09-01'), d('2026-09-04')),
      ).toBe(true);
    });

    it('returns false when any single night in the stay is blocked', () => {
      const overrides = [override(d('2026-09-02'), 'UNAVAILABLE')];
      expect(
        roomAvailableAcross('AVAILABLE', overrides, d('2026-09-01'), d('2026-09-04')),
      ).toBe(false);
    });

    it('returns false when ALL nights are blocked', () => {
      expect(
        roomAvailableAcross('UNAVAILABLE', [], d('2026-09-01'), d('2026-09-04')),
      ).toBe(false);
    });
  });

  // ── adjacent stays — check-out of one, check-in of next ───────────────
  describe('adjacent stay boundary', () => {
    it('range ending on Sep 04 does not cover the Sep 04 night', () => {
      // A prior booking checked out Sep 04. New booking Sep 04→07.
      // Sep 04 should count as the check-in night for the new booking.
      // Override blocking Sep 04 should affect the new booking, not Sep 01→04.
      const overrides = [override(d('2026-09-04'), 'UNAVAILABLE')];

      // Sep 01→04 stays: covers nights Sep 01, 02, 03 → Sep 04 is NOT included
      expect(
        roomAvailableAcross('AVAILABLE', overrides, d('2026-09-01'), d('2026-09-04')),
      ).toBe(true);

      // Sep 04→07 stay: covers nights Sep 04, 05, 06 → Sep 04 IS blocked
      expect(
        roomAvailableAcross('AVAILABLE', overrides, d('2026-09-04'), d('2026-09-07')),
      ).toBe(false);
    });
  });

  // ── longer stay ────────────────────────────────────────────────────────
  describe('7-night stay', () => {
    it('returns true when all 7 nights are clear', () => {
      expect(
        roomAvailableAcross('AVAILABLE', [], d('2026-09-01'), d('2026-09-08')),
      ).toBe(true);
    });

    it('returns false when night 5 is blocked', () => {
      const overrides = [override(d('2026-09-05'), 'MAINTENANCE')];
      expect(
        roomAvailableAcross('AVAILABLE', overrides, d('2026-09-01'), d('2026-09-08')),
      ).toBe(false);
    });
  });
});
