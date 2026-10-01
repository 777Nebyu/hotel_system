import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { createAudioPlayer, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { File } from 'expo-file-system';
import { useAppSelector } from '../store/hooks';
import { request } from '../api';
import type { RootStackParamList } from '../navigation/types';
import { useTheme } from '../hooks/useTheme';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';

type Props = NativeStackScreenProps<RootStackParamList, 'AIChat'>;
type Message = { id: string; role: 'user' | 'assistant'; content: string; createdAt: string };
type ChatResponse = { conversationId: string; message: string };
type ConversationResponse = { messages: Array<{ id: string; role: string; content: string; createdAt: string }> };
const MAX_AUDIO_BASE64_LENGTH = 8_000_000;

/** Current UI language, sent so the API transcribes and replies in it. */
const aiLanguage = (): 'en' | 'am' => (i18n.language?.startsWith('am') ? 'am' : 'en');

export default function AIChatScreen({ route, navigation }: Props) {
  const { colors: c, font, spacing, borderRadius } = useTheme();
  const { t } = useTranslation();
  const listRef = React.useRef<FlatList<Message>>(null);
  const token = useAppSelector((state) => state.auth.session?.accessToken);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState(route.params?.conversationId);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(Boolean(route.params?.conversationId));
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const playerRef = React.useRef<ReturnType<typeof createAudioPlayer> | null>(null);

  useEffect(() => {
    const id = route.params?.conversationId;
    if (!id || !token) return;
    let mounted = true;
    setLoadingHistory(true);
    void request<ConversationResponse>(`/ai/conversations/${encodeURIComponent(id)}`, { token })
      .then((data) => {
        if (mounted) {
          setMessages(data.messages
            .filter((message) => message.role === 'user' || message.role === 'assistant')
            .map((message) => ({ ...message, role: message.role as Message['role'] })));
        }
      })
      .catch((err: Error) => mounted && setError(err.message))
      .finally(() => mounted && setLoadingHistory(false));
    return () => { mounted = false; };
  }, [route.params?.conversationId, token]);

  const playResponseAudio = useCallback((audioBase64?: string) => {
    if (!audioBase64) return;
    playerRef.current?.release();
    const player = createAudioPlayer(`data:audio/wav;base64,${audioBase64}`);
    playerRef.current = player;
    player.play();
  }, []);

  useEffect(() => () => {
    playerRef.current?.release();
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: messages.length > 1 }));
    return () => cancelAnimationFrame(frame);
  }, [messages.length]);

  const appendAssistant = useCallback((message: string) => {
    setMessages((current) => [...current, {
      id: `local-assistant-${Date.now()}`,
      role: 'assistant',
      content: message,
      createdAt: new Date().toISOString(),
    }]);
  }, []);

  const send = useCallback(async () => {
    const message = input.trim();
    if (!message || loading || voiceLoading || !token) return;
    setInput('');
    setError(null);
    const userMessage: Message = {
      id: `local-user-${Date.now()}`,
      role: 'user',
      content: message,
      createdAt: new Date().toISOString(),
    };
    setMessages((current) => [...current, userMessage]);
    setLoading(true);
    try {
      const result = await request<ChatResponse>('/ai/chat', {
        method: 'POST',
        token,
        body: { message, conversationId, hotelId: route.params?.hotelId, language: aiLanguage() },
      });
      setConversationId(result.conversationId);
      appendAssistant(result.message);
    } catch (err: any) {
      setError(err?.message || t('ai.serviceUnavailable'));
    } finally {
      setLoading(false);
    }
  }, [appendAssistant, conversationId, input, loading, route.params?.hotelId, t, token, voiceLoading]);

  const toggleRecording = useCallback(async () => {
    if (recording) {
      setVoiceLoading(true);
      try {
        await recorder.stop();
        await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
        setRecording(false);
        const uri = recorder.uri;
        if (!uri || !token) throw new Error(t('ai.noRecording'));
        const recordingFile = new File(uri);
        let audioBase64: string;
        try {
          audioBase64 = await recordingFile.base64();
        } finally {
          // The encoded payload is already in memory; do not leave every
          // completed recording in the device cache.
          try { recordingFile.delete(); } catch { /* web/blob URIs may not be deletable */ }
        }
        if (audioBase64.length > MAX_AUDIO_BASE64_LENGTH) {
          throw new Error(t('ai.recordingTooLong'));
        }
        const result = await request<ChatResponse & { transcript: string; audioBase64?: string }>('/ai/voice', {
          method: 'POST',
          token,
          timeoutMs: 60_000,
          body: { audioBase64, mimeType: Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4', conversationId, hotelId: route.params?.hotelId, language: aiLanguage() },
        });
        setConversationId(result.conversationId);
        if (result.transcript) {
          setMessages((current) => [...current, {
            id: `local-user-${Date.now()}`,
            role: 'user',
            content: result.transcript,
            createdAt: new Date().toISOString(),
          }]);
        }
        appendAssistant(result.message);
        playResponseAudio(result.audioBase64);
      } catch (err: any) {
        setError(err?.message || t('ai.voiceUnavailable'));
        setRecording(false);
      } finally {
        setVoiceLoading(false);
      }
      return;
    }

    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setError(t('ai.microphoneRequired'));
      return;
    }
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setError(null);
      setRecording(true);
    } catch (err: any) {
      setError(err?.message || t('ai.recordingUnavailable'));
    }
  }, [appendAssistant, conversationId, playResponseAudio, recorder, recording, route.params?.hotelId, t, token]);

  const styles = useMemo(() => StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.paper },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: c.line, backgroundColor: c.surface },
    title: { flex: 1, marginLeft: spacing.sm, color: c.ink, fontFamily: font.sans, fontSize: 18, fontWeight: '700' },
    subtitle: { color: c.inkMuted, fontSize: 12, marginLeft: spacing.sm },
    list: { padding: spacing.md, paddingBottom: spacing.lg },
    empty: { marginTop: spacing.xl, alignItems: 'center', paddingHorizontal: spacing.lg },
    emptyTitle: { color: c.ink, fontSize: 18, fontWeight: '700', marginTop: spacing.sm },
    emptyText: { color: c.inkSoft, textAlign: 'center', marginTop: spacing.xs, lineHeight: 20 },
    bubble: { maxWidth: '86%', borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginBottom: spacing.sm },
    userBubble: { alignSelf: 'flex-end', backgroundColor: c.teal, borderBottomRightRadius: 4 },
    assistantBubble: { alignSelf: 'flex-start', backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderBottomLeftRadius: 4 },
    userText: { color: '#fff', lineHeight: 20 },
    assistantText: { color: c.ink, lineHeight: 20 },
    composer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs, padding: spacing.sm, borderTopWidth: 1, borderTopColor: c.line, backgroundColor: c.surface },
    input: { flex: 1, maxHeight: 110, minHeight: 44, borderWidth: 1, borderColor: c.lineStrong, borderRadius: borderRadius.md, color: c.ink, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, backgroundColor: c.paper },
    voice: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: c.gold },
    send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: c.teal },
    sendDisabled: { opacity: 0.45 },
    error: { color: c.danger, textAlign: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
    loadingBubble: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginBottom: spacing.sm },
  }), [borderRadius.md, c, font.sans, spacing]);

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} accessibilityLabel={t('ai.goBack')}>
            <Ionicons name="arrow-back" size={24} color={c.ink} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{t('ai.title')}</Text>
            <Text style={styles.subtitle}>{t('ai.subtitle')}</Text>
          </View>
        </View>
        {loadingHistory ? <ActivityIndicator color={c.teal} style={{ marginTop: spacing.lg }} /> : (
          <FlatList
            style={{ flex: 1 }}
            contentContainerStyle={styles.list}
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            removeClippedSubviews={Platform.OS === 'android'}
            initialNumToRender={12}
            maxToRenderPerBatch={8}
            windowSize={5}
            renderItem={({ item }) => (
              <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.assistantBubble]}>
                <Text style={item.role === 'user' ? styles.userText : styles.assistantText}>{item.content}</Text>
              </View>
            )}
            ListEmptyComponent={<View style={styles.empty}>
              <Ionicons name="sparkles-outline" size={36} color={c.gold} />
              <Text style={styles.emptyTitle}>{t('ai.emptyTitle')}</Text>
              <Text style={styles.emptyText}>{t('ai.emptyText')}</Text>
            </View>}
            ListFooterComponent={loading ? <View style={styles.loadingBubble}>
              <ActivityIndicator size="small" color={c.teal} />
              <Text style={styles.assistantText}>{t('ai.thinking')}</Text>
            </View> : null}
          />
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={t('ai.placeholder')}
            placeholderTextColor={c.inkMuted}
            multiline
            editable={!loading && !recording && !voiceLoading}
            onSubmitEditing={() => { void send(); }}
            returnKeyType="send"
          />
          <Pressable onPress={() => { void toggleRecording(); }} disabled={loading || voiceLoading} style={[styles.voice, (loading || voiceLoading) && styles.sendDisabled]} accessibilityLabel={recording ? t('ai.stopVoice') : t('ai.startVoice')}>
            {voiceLoading ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name={recording ? 'stop' : 'mic'} size={19} color="#fff" />}
          </Pressable>
          <Pressable onPress={() => { void send(); }} disabled={loading || voiceLoading || !input.trim()} style={[styles.send, (loading || voiceLoading || !input.trim()) && styles.sendDisabled]} accessibilityLabel="Send message">
            {loading ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="send" size={19} color="#fff" />}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
