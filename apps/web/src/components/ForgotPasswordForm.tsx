"use client";
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { forgotPasswordSchema, ForgotPasswordInput } from '@repo/shared-types';
import { api } from '../api';

export function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const mutation = useMutation({
    mutationFn: async (data: ForgotPasswordInput) => {
      const response = await api.post('/auth/forgot-password', data);
      return response.data;
    },
    onSuccess: () => {
      setSubmitted(true);
    },
  });

  return (
    <div className="glass-card" style={{ maxWidth: 450, margin: '2rem auto' }}>
      <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Reset Password</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
        Enter your registered email address and we&apos;ll send password recovery instructions.
      </p>

      {submitted ? (
        <div style={{ textAlign: 'center', padding: '1rem 0' }}>
          <p style={{ color: 'var(--success-accent)', marginBottom: '1rem', fontWeight: 600 }}>
            If the account exists, a reset link has been dispatched to your email.
          </p>
          <button type="button" className="btn btn-secondary" onClick={onBack}>
            Back to Sign In
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit((data) => mutation.mutate(data))}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              {...register('email')}
              type="email"
              placeholder="guest@example.com"
              className="form-input"
            />
            {errors.email && <p className="error-text">{errors.email.message}</p>}
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={mutation.isPending}>
            {mutation.isPending ? 'Sending...' : 'Send Reset Link'}
          </button>

          <div style={{ marginTop: '1rem', textAlign: 'center' }}>
            <button type="button" className="btn btn-secondary" onClick={onBack}>
              Back to Sign In
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
