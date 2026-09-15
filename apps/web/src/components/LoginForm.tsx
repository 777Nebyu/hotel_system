"use client";
import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useDispatch } from 'react-redux';
import { loginSchema, LoginInput } from '@repo/shared-types';
import { api } from '../api';
import { setSession } from '../store';

function getErrorMessage(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const data = err.response?.data as { message?: string } | undefined;
    return data?.message ?? fallback;
  }
  return fallback;
}

export function LoginForm({ onSuccess, onForgotPassword }: { onSuccess: () => void; onForgotPassword: () => void }) {
  const dispatch = useDispatch();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  const mutation = useMutation({
    mutationFn: async (data: LoginInput) => {
      const response = await api.post('/auth/login', data);
      return response.data;
    },
    onSuccess: (data) => {
      dispatch(setSession(data));
      onSuccess();
    },
  });

  return (
    <div className="glass-card" style={{ maxWidth: 450, margin: '2rem auto' }}>
      <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Welcome Back</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
        Sign in to access your hotel bookings and profile.
      </p>

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

        <div className="form-group">
          <label className="form-label">Password</label>
          <input
            {...register('password')}
            type="password"
            placeholder="••••••••"
            className="form-input"
          />
          {errors.password && <p className="error-text">{errors.password.message}</p>}
        </div>

        {mutation.isError && (
          <p className="error-text" style={{ marginBottom: '1rem' }}>
            {getErrorMessage(mutation.error, 'Failed to sign in. Please check credentials.')}
          </p>
        )}

        <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={mutation.isPending}>
          {mutation.isPending ? 'Signing In...' : 'Sign In'}
        </button>

        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
          <button
            type="button"
            className="btn btn-outline"
            style={{ border: 'none', background: 'transparent', fontSize: '0.85rem' }}
            onClick={onForgotPassword}
          >
            Forgot your password?
          </button>
        </div>
      </form>
    </div>
  );
}
