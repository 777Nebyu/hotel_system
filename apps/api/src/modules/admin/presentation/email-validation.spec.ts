import { createAdminUserSchema } from './dto/admin.dto';
import { addStaffSchema } from './manager-staff.controller';

// Every user-supplied email must go through the shared strict emailFieldSchema
// rather than zod's looser built-in .email(), which accepts values such as
// "john..doe@example.com", ".john@example.com" and "a@b.c".
const INVALID = [
  'john@',
  'a@b.c',
  '.john@x.com',
  'john..doe@x.com',
  'john@x..com',
  'john@example',
] as const;

describe('admin email validation uses the strict shared schema', () => {
  it.each(INVALID)('createAdminUserSchema rejects %s', (email) => {
    const result = createAdminUserSchema.safeParse({
      fullName: 'New User',
      email,
      password: 'Secret123',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'email')).toBe(true);
    }
  });

  it('createAdminUserSchema accepts a well formed email', () => {
    expect(
      createAdminUserSchema.safeParse({
        fullName: 'New User',
        email: 'user@example.com',
        password: 'Secret123',
      }).success,
    ).toBe(true);
  });

  it.each(INVALID)('addStaffSchema rejects %s', (email) => {
    expect(
      addStaffSchema.safeParse({ fullName: 'New Staff', email }).success,
    ).toBe(false);
  });

  it('addStaffSchema accepts a well formed email and still allows it to be omitted', () => {
    expect(
      addStaffSchema.safeParse({ email: 'staff@example.com' }).success,
    ).toBe(true);
    expect(addStaffSchema.safeParse({}).success).toBe(true);
  });
});
