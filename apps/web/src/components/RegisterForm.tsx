"use client";
import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useDispatch } from 'react-redux';
import { registerSchema, RegisterInput } from '@repo/shared-types';
import { api } from '../api';
import { setSession } from '../store';

function getErrorMessage(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const data = err.response?.data as { message?: string } | undefined;
    return data?.message ?? fallback;
  }
  return fallback;
}

export function RegisterForm({ onSuccess }: { onSuccess: () => void }) {
  const dispatch = useDispatch();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  });

  const mutation = useMutation({
    mutationFn: async (data: RegisterInput) => {
      const response = await api.post('/auth/register', data);
      return response.data;
    },
    onSuccess: (data) => {
      dispatch(setSession(data));
      onSuccess();
    },
  });

  return (
    <div className="glass-card" style={{ maxWidth: 480, margin: '2rem auto' }}>
      <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Create an Account</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
        Join YayeTech Hotel to discover luxury stays and manage reservations.
      </p>

      <form onSubmit={handleSubmit((data) => mutation.mutate(data))}>
        <div className="form-group">
          <label className="form-label">Full Name</label>
          <input
            {...register('fullName')}
            type="text"
            placeholder="Abebe Bikila"
            className="form-input"
          />
          {errors.fullName && <p className="error-text">{errors.fullName.message}</p>}
        </div>

        <div className="form-group">
          <label className="form-label">Email Address</label>
          <input
            {...register('email')}
            type="email"
            placeholder="abebe@example.com"
            className="form-input"
          />
          {errors.email && <p className="error-text">{errors.email.message}</p>}
        </div>

        <div className="form-group">
          <label className="form-label">Phone Number (Optional)</label>
          <input
            {...register('phone')}
            type="tel"
            placeholder="+251 911 234 567"
            className="form-input"
          />
          {errors.phone && <p className="error-text">{errors.phone.message}</p>}
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
            {getErrorMessage(mutation.error, 'Registration failed. Email may already be in use.')}
          </p>
        )}

        <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={mutation.isPending}>
          {mutation.isPending ? 'Creating Account...' : 'Register'}
        </button>
      </form>
    </div>
  );
}
