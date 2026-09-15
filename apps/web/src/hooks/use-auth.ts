import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { authService } from '@/services/auth.service'
import { useAuth } from '@/lib/auth-store'
import type { LoginInput, RegisterInput, ForgotPasswordInput, ResetPasswordInput } from '@repo/shared-types'
import { useRouter } from 'next/navigation'

export function useLoginMutation() {
  const queryClient = useQueryClient()
  const setSession = useAuth((s) => s.setSession)

  return useMutation({
    mutationFn: (dto: LoginInput) => authService.login(dto),
    onSuccess: (data) => {
      setSession(data)
      queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
  })
}

export function useRegisterMutation() {
  const queryClient = useQueryClient()
  const setSession = useAuth((s) => s.setSession)

  return useMutation({
    mutationFn: (dto: RegisterInput) => authService.register(dto),
    onSuccess: (data) => {
      setSession(data)
      queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
  })
}

export function useForgotPasswordMutation() {
  return useMutation({
    mutationFn: (dto: ForgotPasswordInput) => authService.forgotPassword(dto),
  })
}

export function useResetPasswordMutation() {
  return useMutation({
    mutationFn: (dto: ResetPasswordInput) => authService.resetPassword(dto),
  })
}

export function useLogoutMutation() {
  const queryClient = useQueryClient()
  const logout = useAuth((s) => s.logout)
  const router = useRouter()

  return useMutation({
    mutationFn: () => authService.logout(),
    onSettled: () => {
      logout()
      queryClient.clear()
      router.push('/')
    },
  })
}

export function useProfileQuery() {
  const user = useAuth((s) => s.user)
  const setUser = useAuth((s) => s.setUser)

  return useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      const profile = await authService.getProfile()
      setUser(profile)
      return profile
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  })
}
