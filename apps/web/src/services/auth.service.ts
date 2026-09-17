import { apiClient } from '@/lib/axios'
import type { User, SessionItem } from '@/lib/types'
import type {
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  ForgotPasswordInput,
} from '@repo/shared-types'
import type { AuthResponse } from '@/lib/auth-store'

export const authService = {
  login: async (dto: LoginInput): Promise<AuthResponse> => {
    const res = await apiClient.post<AuthResponse>('/auth/login', dto)
    return res.data
  },

  register: async (dto: RegisterInput): Promise<AuthResponse> => {
    const res = await apiClient.post<AuthResponse>('/auth/register', dto)
    return res.data
  },

  googleLogin: async (dto: {
    credential?: string
    email?: string
    fullName?: string
    googleId?: string
  }): Promise<AuthResponse> => {
    const res = await apiClient.post<AuthResponse>('/auth/google', dto)
    return res.data
  },

  forgotPassword: async (dto: ForgotPasswordInput): Promise<{ message: string }> => {
    const res = await apiClient.post<{ message: string }>('/auth/forgot-password', dto)
    return res.data
  },

  resetPassword: async (dto: ResetPasswordInput): Promise<{ message: string }> => {
    const res = await apiClient.post<{ message: string }>('/auth/reset-password', dto)
    return res.data
  },

  verifyEmail: async (token: string): Promise<{ message: string; verified?: boolean }> => {
    const res = await apiClient.post<{ message: string; verified?: boolean }>(
      `/auth/verify-email/${encodeURIComponent(token)}`,
    )
    return res.data
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout')
  },

  getProfile: async (): Promise<User> => {
    const res = await apiClient.get<User>('/auth/me')
    return res.data
  },

  updateProfile: async (data: Partial<Pick<User, 'fullName' | 'phone'>> & { currentPassword?: string; newPassword?: string }): Promise<User> => {
    const res = await apiClient.patch<User>('/auth/me', data)
    return res.data
  },

  uploadProfilePhoto: async (file: File): Promise<User> => {
    const formData = new FormData()
    formData.append('photo', file)
    const res = await apiClient.post<User>('/auth/me/photo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data
  },

  listSessions: async (): Promise<SessionItem[]> => {
    const res = await apiClient.get<SessionItem[]>('/auth/sessions')
    return res.data
  },

  revokeSession: async (id: string): Promise<void> => {
    await apiClient.delete(`/auth/sessions/${id}`)
  },

  revokeAllOtherSessions: async (): Promise<void> => {
    await apiClient.delete('/auth/sessions')
  },

  deactivateAccount: async (reason?: string): Promise<void> => {
    await apiClient.post('/auth/me/deactivate', { reason })
  },
}
