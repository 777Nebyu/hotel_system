"use client"

import { useRef, useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import {
  Bot,
  Calendar,
  Check,
  ChevronRight,
  Compass,
  HeartPulse,
  Info,
  Landmark,
  MapPin,
  Mic,
  MicOff,
  Send,
  ShieldAlert,
  Sparkles,
  Utensils,
  Wand2,
  X,
} from "lucide-react"
import { aiService, tripApi, type Trip } from "@/lib/services"
import { useAuth } from "@/lib/auth-store"
import { toast } from "@/components/ui/Toast"
import { useLanguage } from "@/lib/i18n"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  toolCallsExecuted?: string[]
  placeCards?: Array<{
    id: string
    name: string
    category?: string
    distanceKm?: number
    images?: unknown[]
    verifiedSource?: { name: string; license?: string | null } | null
    lastVerifiedAt?: string | null
  }>
  draftAction?: {
    type: "ADD_TO_TRIP"
    title: string
    date?: string
    time?: string
    notes?: string
    placeName?: string
  }
  createdAt: string
}

export interface AIChatProps {
  hotelId?: string
  placeholder?: string
  className?: string
  initialOpen?: boolean
  onClose?: () => void
}

export default function AIChat({
  hotelId,
  placeholder,
  className = "",
  initialOpen = false,
  onClose,
}: AIChatProps) {
  const { t } = useLanguage()
  const inputPlaceholder = placeholder ?? t('common', 'chatPlaceholderDefault')
  const { user, tokens } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [conversationId, setConversationId] = useState<string | undefined>()
  const [loading, setLoading] = useState(false)
  const [confirmingDraftId, setConfirmingDraftId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(initialOpen)
  const [recording, setRecording] = useState(false)
  const [voiceSupported, setVoiceSupported] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    setVoiceSupported(
      typeof navigator !== "undefined" &&
        !!navigator.mediaDevices?.getUserMedia &&
        typeof MediaRecorder !== "undefined",
    )
  }, [])

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop())
      if (recorderRef.current?.state === "recording") recorderRef.current.stop()
    }
  }, [])

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const aiLanguage = (): "en" | "am" =>
    typeof document !== "undefined" && document.documentElement.lang.startsWith("am")
      ? "am"
      : "en"

  // Parse draft recommendations from assistant responses
  const parseDraftFromMessage = (content: string, toolCalls?: string[]): Message["draftAction"] | undefined => {
    if (
      content.toLowerCase().includes("would you like to add this to your trip") ||
      content.toLowerCase().includes("drafted") ||
      toolCalls?.includes("draft_itinerary") ||
      toolCalls?.includes("add_trip_item")
    ) {
      return {
        type: "ADD_TO_TRIP",
        title: t('common', 'recommendedActivity'),
        time: "10:00",
        notes: t('common', 'suggestedByAssistant'),
      }
    }
    return undefined
  }

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || loading || !tokens) return

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setLoading(true)
    setError(null)

    try {
      const res = await aiService.chat({
        message: text,
        conversationId,
        hotelId,
        language: aiLanguage(),
      })
      setConversationId(res.conversationId)
      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: res.message,
        toolCallsExecuted: res.toolCallsExecuted,
        placeCards: res.placeCards,
        draftAction: parseDraftFromMessage(res.message, res.toolCallsExecuted),
        createdAt: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, assistantMsg])
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : t('common', 'somethingWentWrongRetry'),
      )
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void sendMessage()
    }
  }

  const handleConfirmDraft = async (msgId: string, draft: NonNullable<Message["draftAction"]>) => {
    setConfirmingDraftId(msgId)
    try {
      const tripsRes = await tripApi.list()
      if (!tripsRes.data || tripsRes.data.length === 0) {
        toast.info(t('common', 'noActiveTrip'), t('common', 'createTripFirst'))
        return
      }
      const activeTrip = tripsRes.data[0]
      await tripApi.addItem(activeTrip.id, {
        dayDate: activeTrip.startDate.slice(0, 10),
        title: draft.title || t('common', 'aiRecommendedLandmark'),
        itemType: "CUSTOM",
        startTime: draft.time || "10:00",
        durationMin: 90,
        notes: draft.notes,
        createdBy: "AI",
        userConfirmed: true,
      })

      toast.success(t('common', 'addedToItinerary'), t('common', 'scheduledInTrip', { title: activeTrip.title }))
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, draftAction: undefined } : m)),
      )
    } catch (err) {
      toast.error(t('common', 'failedToAdd'), err instanceof Error ? err.message : t('common', 'errorSavingDraft'))
    } finally {
      setConfirmingDraftId(null)
    }
  }

  const sendVoice = async (audioBase64: string, mimeType: string) => {
    if (loading || !tokens) return
    setLoading(true)
    setError(null)
    try {
      const res = await aiService.voice({
        audioBase64,
        mimeType,
        conversationId,
        hotelId,
        language: aiLanguage(),
      })
      setConversationId(res.conversationId)
      setMessages((prev) => [
        ...prev,
        {
          id: `voice-${Date.now()}`,
          role: "user",
          content: res.transcript?.trim() || t('common', 'voiceMessage'),
          createdAt: new Date().toISOString(),
        },
        {
          id: `voice-assistant-${Date.now()}`,
          role: "assistant",
          content: res.message,
          draftAction: parseDraftFromMessage(res.message),
          createdAt: new Date().toISOString(),
        },
      ])
      if (res.audioBase64) {
        const audio = new Audio(`data:audio/wav;base64,${res.audioBase64}`)
        void audio.play().catch(() => undefined)
      }
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : t('common', 'voiceRequestFailed'),
      )
    } finally {
      setLoading(false)
    }
  }

  const toggleRecording = async () => {
    if (!voiceSupported || loading) return
    if (recording) {
      recorderRef.current?.stop()
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || "audio/webm"
        const blob = new Blob(chunksRef.current, { type: mimeType })
        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        setRecording(false)
        if (blob.size === 0) return
        const reader = new FileReader()
        reader.onloadend = () => {
          const dataUrl = String(reader.result || "")
          const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1)
          if (base64) void sendVoice(base64, mimeType)
        }
        reader.readAsDataURL(blob)
      }
      recorderRef.current = recorder
      recorder.start()
      setRecording(true)
      setError(null)
    } catch {
      setRecording(false)
      setError(t('common', 'microphoneUnavailable'))
    }
  }

  if (!tokens) return null

  return (
    <div className={`fixed top-6 bottom-6 right-6 z-50 flex flex-col items-end justify-end gap-3 ${className}`}>
      {/* Chat Drawer Window */}
      {isOpen && (
        <div className="flex flex-col w-[390px] max-w-[calc(100vw-3rem)] flex-1 min-h-0 rounded-3xl shadow-2xl border border-slate-200 bg-white overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-[#0F2942] to-[#1E3A5F] text-white shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#D4AF37]/20 text-[#D4AF37]">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <span className="font-serif font-bold text-sm leading-tight block">
                  {t('common', 'aiConciergeTitle')}
                </span>
                <span className="text-[10px] text-[#D4AF37] font-semibold">
                  {t('common', 'groundedAssistantSubtitle')}
                </span>
              </div>
            </div>
            <button
              onClick={() => { setIsOpen(false); onClose?.() }}
              className="rounded-lg p-1 text-white/70 hover:bg-white/10 hover:text-white transition"
              aria-label={t('common', 'closeAiChat')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3.5 bg-[#F8FAFC]">
            {messages.length === 0 && (
              <div className="text-center text-slate-500 text-sm mt-6 px-4 space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0F2942]/5 text-[#0F2942]">
                  <Bot className="h-6 w-6 text-[#D4AF37]" />
                </div>
                <div>
                  <p className="font-serif font-bold text-[#0F2942]">{t('common', 'chatWelcome')}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {t('common', 'chatWelcomeHint')}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2 text-[11px] text-left">
                  <button
                    onClick={() => {
                      setInput(t('common', 'suggestCoffeePrompt'))
                    }}
                    className="p-2.5 rounded-xl border border-slate-200 bg-white hover:border-[#D4AF37] text-slate-700 transition"
                  >
                    {t('common', 'suggestCoffeeLabel')}
                  </button>
                  <button
                    onClick={() => {
                      setInput(t('common', 'suggestEmergencyPrompt'))
                    }}
                    className="p-2.5 rounded-xl border border-slate-200 bg-white hover:border-[#D4AF37] text-slate-700 transition"
                  >
                    {t('common', 'suggestEmergencyLabel')}
                  </button>
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed shadow-sm ${
                    msg.role === "user"
                      ? "bg-[#0F2942] text-white rounded-br-sm"
                      : "bg-white text-slate-800 border border-slate-200 rounded-bl-sm"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>

                  {/* Tool execution badge */}
                  {msg.toolCallsExecuted && msg.toolCallsExecuted.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1 border-t border-slate-100 pt-1.5 text-[9px] text-slate-400">
                      <span>{t('common', 'verifiedTools')}</span>
                      {msg.toolCallsExecuted.map((tool) => (
                        <span key={tool} className="rounded bg-slate-100 px-1 font-mono text-slate-600">
                          {tool}
                        </span>
                      ))}
                    </div>
                  )}

                  {msg.placeCards && msg.placeCards.length > 0 && (
                    <div className="mt-3 space-y-2 border-t border-slate-100 pt-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#0F2942]">{t('common', 'verifiedNearbyPlaces')}</p>
                      {msg.placeCards.map((place) => {
                        const image = typeof place.images?.[0] === 'string' ? place.images[0] : null
                        const distance = place.distanceKm == null ? null : place.distanceKm < 1 ? `${Math.round(place.distanceKm * 1000)}m` : `${place.distanceKm.toFixed(1)} km`
                        return (
                          <Link key={place.id} href={`/discover/${place.id}`} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 transition hover:border-[#D4AF37]">
                            {image ? <Image src={image} alt="" width={40} height={40} className="h-10 w-10 rounded-lg object-cover" /> : <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0F2942]/10"><MapPin className="h-4 w-4 text-[#0F2942]" /></span>}
                            <span className="min-w-0 flex-1"><span className="block truncate text-[11px] font-bold text-[#0F2942]">{place.name}</span><span className="block truncate text-[9px] text-slate-500">{place.category || t('common', 'placeCategoryFallback')}{distance ? ` · ${distance}` : ''}</span><span className="block truncate text-[9px] text-emerald-700">✓ {place.verifiedSource?.name || t('common', 'verifiedSourceFallback')}</span></span>
                            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Draft Itinerary Confirmation Card (TRIP-008 / AI-035) */}
                {msg.draftAction && (
                  <div className="mt-2 w-[85%] rounded-2xl border border-[#D4AF37] bg-[#D4AF37]/10 p-3 shadow-sm">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#0F2942]">
                      <Wand2 className="h-3.5 w-3.5 text-[#D4AF37]" />
                      <span>{t('common', 'draftProposalTitle')}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-700 font-medium">
                      {t('common', 'draftProposalQuestion')}
                    </p>
                    <div className="mt-2.5 flex items-center gap-2">
                      <button
                        onClick={() => handleConfirmDraft(msg.id, msg.draftAction!)}
                        disabled={confirmingDraftId === msg.id}
                        className="inline-flex items-center gap-1 rounded-xl bg-[#0F2942] px-3 py-1.5 text-[11px] font-bold text-white shadow-sm hover:bg-[#1E3A5F] disabled:opacity-50"
                      >
                        <Check className="h-3 w-3 text-[#D4AF37]" />
                        {t('common', 'confirmAndAdd')}
                      </button>
                      <button
                        onClick={() =>
                          setMessages((prev) =>
                            prev.map((m) => (m.id === msg.id ? { ...m, draftAction: undefined } : m)),
                          )
                        }
                        className="rounded-xl px-2.5 py-1.5 text-[11px] font-semibold text-slate-500 hover:bg-slate-200/50"
                      >
                        {t('common', 'dismiss')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 px-3.5 py-2.5 rounded-2xl rounded-bl-sm shadow-sm">
                  <div className="flex gap-1.5 items-center">
                    <span className="w-1.5 h-1.5 bg-[#D4AF37] rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 bg-[#0F2942] rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 bg-[#D4AF37] rounded-full animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="text-center text-xs text-rose-600 bg-rose-50 border border-rose-200 px-3 py-2 rounded-xl">
                {error}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Footer */}
          <div className="border-t border-slate-200 bg-white px-3 py-3 flex gap-2 shrink-0">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={recording ? t('common', 'listeningPlaceholder') : inputPlaceholder}
              disabled={loading || recording}
              className="flex-1 text-xs bg-slate-100 rounded-xl px-3.5 py-2.5 outline-none focus:ring-1 focus:ring-[#D4AF37] text-slate-900 placeholder-slate-400 disabled:opacity-50"
            />

            {voiceSupported && (
              <button
                type="button"
                onClick={toggleRecording}
                disabled={loading}
                className={`p-2 rounded-xl border transition ${
                  recording
                    ? "bg-red-500 text-white border-red-500 animate-pulse"
                    : "border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
                title={recording ? t('common', 'stopRecording') : t('common', 'holdToSpeak')}
              >
                {recording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
            )}

            <button
              onClick={() => void sendMessage()}
              disabled={loading || !input.trim() || recording}
              className="bg-[#0F2942] text-white p-2.5 rounded-xl hover:bg-[#1E3A5F] transition disabled:opacity-40"
              aria-label={t('common', 'sendMessageLabel')}
            >
              <Send className="h-4 w-4 text-[#D4AF37]" />
            </button>
          </div>
        </div>
      )}

      {/* Floating Pill Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex items-center gap-2.5 px-4 py-3 bg-[#0F2942] hover:bg-[#1E3A5F] text-white rounded-full shadow-2xl transition hover:scale-105 active:scale-95 border-2 border-[#D4AF37]/50"
          aria-label={t('common', 'openAiAssistant')}
        >
          <Sparkles className="w-4 h-4 text-[#D4AF37] animate-pulse" />
          <span className="text-xs font-bold font-serif">{t('common', 'askAiLabel')}</span>
        </button>
      )}
    </div>
  )
}
