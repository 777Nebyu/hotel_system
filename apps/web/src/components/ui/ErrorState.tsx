import * as React from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from './Button'

export interface ErrorStateProps {
  title?: string
  message: string
  onRetry?: () => void
  className?: string
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  className = '',
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={`p-6 sm:p-8 rounded-2xl border border-red-200 bg-red-50/50 backdrop-blur-sm flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left ${className}`}
    >
      <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center shrink-0 text-red-600">
        <AlertCircle className="w-6 h-6" />
      </div>
      <div className="flex-1">
        <h4 className="font-serif text-lg font-bold text-red-900 mb-1">{title}</h4>
        <p className="text-sm text-red-700 leading-relaxed max-w-xl">{message}</p>
        {onRetry && (
          <div className="mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              leftIcon={<RefreshCw className="w-4 h-4" />}
            >
              Try Again
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
