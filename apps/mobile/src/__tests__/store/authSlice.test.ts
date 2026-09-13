import authReducer, { setSession, restoreSession, updateUser, signOut, type Session } from '../../store/authSlice';

const mockSession: Session = {
  accessToken: 'access-123',
  refreshToken: 'refresh-456',
  user: { id: 'u1', email: 'test@example.com', fullName: 'Test User', role: 'CUSTOMER' },
};

describe('authSlice', () => {
  it('should return the initial state', () => {
    const state = authReducer(undefined, { type: 'unknown' });
    expect(state).toEqual({ session: null, isRestoring: true });
  });

  it('setSession stores session and clears isRestoring', () => {
    const state = authReducer(undefined, setSession(mockSession));
    expect(state.session).toEqual(mockSession);
    expect(state.isRestoring).toBe(false);
  });

  it('setSession with null clears session', () => {
    const prev = { session: mockSession, isRestoring: false };
    const state = authReducer(prev, setSession(null));
    expect(state.session).toBeNull();
  });

  it('restoreSession restores session from storage', () => {
    const state = authReducer(undefined, restoreSession(mockSession));
    expect(state.session).toEqual(mockSession);
    expect(state.isRestoring).toBe(false);
  });

  it('restoreSession with null sets not restoring', () => {
    const state = authReducer(undefined, restoreSession(null));
    expect(state.session).toBeNull();
    expect(state.isRestoring).toBe(false);
  });

  it('updateUser patches user fields', () => {
    const prev = { session: mockSession, isRestoring: false };
    const state = authReducer(prev, updateUser({ fullName: 'Updated Name' }));
    expect(state.session?.user.fullName).toBe('Updated Name');
    expect(state.session?.user.email).toBe('test@example.com');
  });

  it('updateUser does nothing without session', () => {
    const prev = { session: null, isRestoring: false };
    const state = authReducer(prev, updateUser({ fullName: 'Updated' }));
    expect(state.session).toBeNull();
  });

  it('signOut clears session', () => {
    const prev = { session: mockSession, isRestoring: false };
    const state = authReducer(prev, signOut());
    expect(state.session).toBeNull();
    expect(state.isRestoring).toBe(false);
  });
});
