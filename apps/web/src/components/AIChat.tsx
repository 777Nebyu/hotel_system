"use client"

import dynamic from "next/dynamic"
import { useState } from "react"
import { Sparkles } from "lucide-react"
import { useAuth } from "@/lib/auth-store"
import { useLanguage } from "@/lib/i18n"
import type { AIChatProps } from "./AIChatPanel"

const AIChatPanel = dynamic<AIChatProps>(() => import("./AIChatPanel"), {
  ssr: false,
})

export default function AIChat(props: AIChatProps) {
  const { tokens } = useAuth()
  const { t } = useLanguage()
  const [isOpen, setIsOpen] = useState(false)

  if (!tokens) return null

  if (isOpen) {
    return (
      <AIChatPanel
        {...props}
        initialOpen
        onClose={() => setIsOpen(false)}
      />
    )
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2.5 rounded-full border-2 border-[#D4AF37]/50 bg-[#0F2942] px-4 py-3 text-white shadow-2xl transition hover:scale-105 hover:bg-[#1E3A5F] active:scale-95"
        aria-label={t("common", "openAiAssistant")}
      >
        <Sparkles className="h-4 w-4 animate-pulse text-[#D4AF37]" />
        <span className="font-serif text-xs font-bold">{t("common", "askAiLabel")}</span>
      </button>
    </div>
  )
}
