"use client";
import React from 'react';
import { useSelector } from 'react-redux';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import type { RootState } from '../store';

export function UserProfileCard() {
  const auth = useSelector((state: RootState) => state.auth);

  const { data: profile } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await api.get('/auth/me');
      return res.data;
    },
    enabled: !!auth.accessToken,
  });

  if (!auth.user) {
    return (
      <div className="glass-card" style={{ maxWidth: 500, margin: '2rem auto', textAlign: 'center' }}>
        <p>Please sign in to view your profile.</p>
      </div>
    );
  }

  const role = profile?.role || auth.user.role;
  const roleBadgeClass = 
    role === 'ADMIN' ? 'badge-admin' :
    role === 'MANAGER' ? 'badge-manager' :
    role === 'STAFF' ? 'badge-staff' : 'badge-customer';

  return (
    <div className="glass-card" style={{ maxWidth: 550, margin: '2rem auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '1.5rem' }}>
        <div 
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'var(--primary-gradient)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.75rem',
            fontWeight: 'bold',
          }}
        >
          {(profile?.fullName || auth.user.fullName)?.[0]?.toUpperCase()}
        </div>
        <div>
          <h2 style={{ fontSize: '1.35rem', marginBottom: '0.25rem' }}>
            {profile?.fullName || auth.user.fullName}
          </h2>
          <span className={`badge ${roleBadgeClass}`}>{role}</span>
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
        <div className="form-group">
          <label className="form-label">Email Address</label>
          <p style={{ color: 'var(--text-main)', fontSize: '1rem' }}>{profile?.email || auth.user.email}</p>
        </div>

        <div className="form-group">
          <label className="form-label">Phone Number</label>
          <p style={{ color: 'var(--text-main)', fontSize: '1rem' }}>{profile?.phone || 'Not provided'}</p>
        </div>

        <div className="form-group">
          <label className="form-label">Email Verification</label>
          <p style={{ color: profile?.emailVerifiedAt ? 'var(--success-accent)' : 'var(--warning-accent)' }}>
            {profile?.emailVerifiedAt ? '✓ Verified Account' : '⚠️ Pending Verification'}
          </p>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Account Created</label>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : 'Active Session'}
          </p>
        </div>
      </div>
    </div>
  );
}
