import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../navigation/types';
import { useAppSelector } from '../store/hooks';
import { classifyAndAnnounce } from '../errors';
import { Button, EmptyState, ErrorBox } from '../components/Shared';
import { SkeletonDetail } from '../components/Skeleton';
import { useToast } from '../components/Toast';
import { useContactThread, useSendMessage, useCloseContactThread } from '../hooks/useQueries';
import { useTheme } from '../hooks/useTheme';
import { useResponsivePadding } from '../hooks/useResponsivePadding';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'ContactThread'>;

interface OptimisticMessage {
  id: string;
  threadId: string;
  senderId: string;
  sender?: { id: string; fullName: string };
  content: string;
  createdAt: string;
  isPending?: boolean;
}

export default function ContactThreadDetailScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const threadId = route.params.threadId;
  const insets = useSafeAreaInsets();
  const pad = useResponsivePadding();
  const { colors: c } = useTheme();
  const session = useAppSelector((s) => s.auth.session);
  const token = session?.accessToken ?? '';
  const toast = useToast();
  const flatListRef = useRef<FlatList>(null);
  const { isOffline } = useNetworkStatus();

  const [inputText, setInputText] = useState('');
  const [optimisticMessages, setOptimisticMessages] = useState<OptimisticMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  const { data: thread, isLoading, error, refetch } = useContactThread(token, threadId, {
    refetchInterval: 5000,
  });
  const sendMessage = useSendMessage(token);
  const closeThread = useCloseContactThread(token);

  const serverMessages = useMemo(() => thread?.messages ?? [], [thread?.messages]);
  const isClosed = thread?.status === 'CLOSED';
  const prevMsgCount = useRef(serverMessages.length);

  useEffect(() => {
    if (serverMessages.length > prevMsgCount.current) {
      const lastMsg = serverMessages[serverMessages.length - 1];
      if (lastMsg && lastMsg.senderId !== session?.user.id) {
        setIsTyping(false);
        try {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch { /* ignore */ }
      }
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
    prevMsgCount.current = serverMessages.length;
  }, [serverMessages, session?.user.id]);

  const allMessages = useMemo(() => {
    const combined = [...serverMessages];
    for (const opt of optimisticMessages) {
      const alreadyIncluded = combined.some(
        (m: any) =>
          m.id === opt.id ||
          (m.content === opt.content &&
            Math.abs(new Date(m.createdAt).getTime() - new Date(opt.createdAt).getTime()) < 15000)
      );
      if (!alreadyIncluded) {
        combined.push(opt);
      }
    }
    return combined;
  }, [serverMessages, optimisticMessages]);

  const handleSend = async () => {
    if (isOffline) {
      return Alert.alert('Offline', 'Cannot send a message while offline. Please connect to the internet.');
    }
    const content = inputText.trim();
    if (!content) return;

    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch { /* ignore */ }
    setInputText('');

    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: OptimisticMessage = {
      id: tempId,
      threadId,
      senderId: session?.user.id ?? '',
      sender: { id: session?.user.id ?? '', fullName: session?.user.fullName ?? 'You' },
      content,
      createdAt: new Date().toISOString(),
      isPending: true,
    };
    setOptimisticMessages((prev) => [...prev, optimisticMsg]);
    setIsTyping(true);

    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 50);

    try {
      await sendMessage.mutateAsync({ threadId, content });
      setOptimisticMessages((prev) => prev.filter((m) => m.id !== tempId));
    } catch (err) {
      setOptimisticMessages((prev) => prev.filter((m) => m.id !== tempId));
      setIsTyping(false);
      const classified = classifyAndAnnounce(err);
      Alert.alert('Error', classified.title);
    }
  };

  const handleClose = () => {
    if (isOffline) {
      return Alert.alert('Offline', 'Cannot close a thread while offline. Please connect to the internet.');
    }
    Alert.alert(t('contact.closeThread'), 'Are you sure?', [
      { text: t('buttons.cancel'), style: 'cancel' },
      { text: t('contact.closeThread'), style: 'destructive', onPress: async () => {
        try {
          await closeThread.mutateAsync(threadId);
          toast('success', 'Thread closed');
        } catch {
          toast('error', 'Failed to close');
        }
      }},
    ]);
  };

  const s = makeStyles(c);

  const renderMessage = ({ item }: { item: any }) => {
    const isMe = item.senderId === session?.user.id;
    return (
      <View style={[s.messageBubble, isMe ? s.messageMe : s.messageThem]}>
        {!isMe && <Text style={s.senderName}>{item.sender?.fullName ?? 'Hotel Concierge'}</Text>}
        <Text style={[s.messageText, isMe && s.messageTextMe]}>{item.content}</Text>
        <View style={s.messageFooter}>
          <Text style={[s.messageTime, isMe && s.messageTimeMe]}>
            {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
          {isMe && (
            <Ionicons
              name={item.isPending ? 'time-outline' : 'checkmark-done'}
              size={12}
              color={item.isPending ? 'rgba(255,255,255,0.5)' : '#A7F3D0'}
              style={{ marginLeft: 4 }}
            />
          )}
        </View>
      </View>
    );
  };

  if (isLoading && !thread) return <View style={s.center}><SkeletonDetail /></View>;
  if (error && !thread) return <View style={s.center}><ErrorBox message="Failed to load messages" onRetry={() => refetch()} /></View>;

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={s.backBtn}>
          <Ionicons name="arrow-back" size={20} color={c.teal} />
        </Pressable>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle} numberOfLines={1}>{thread?.subject ?? 'Hotel Concierge'}</Text>
          <View style={s.statusRow}>
            {!isClosed && <View style={s.liveDot} />}
            <Text style={[s.headerStatus, isClosed ? { color: c.inkMuted } : { color: c.teal }]}>
              {isClosed ? 'Closed' : 'Active \u2022 Real-time'}
            </Text>
          </View>
        </View>
        {!isClosed && <Button title="Close" variant="ghost" size="sm" onPress={handleClose} />}
      </View>

      {allMessages.length === 0 ? (
        <EmptyState title="No messages yet" subtitle="Send the first message below to chat with the hotel." />
      ) : (
        <FlatList
          ref={flatListRef}
          data={allMessages}
          keyExtractor={(item: any) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={[s.messagesList, { paddingHorizontal: pad }]}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListFooterComponent={
            isTyping ? (
              <View style={s.typingIndicator}>
                <View style={s.typingDot} />
                <Text style={s.typingText}>Hotel Concierge is typing\u2026</Text>
                <ActivityIndicator size="small" color={c.teal} style={{ marginLeft: 6 }} />
              </View>
            ) : null
          }
        />
      )}

      {isClosed ? (
        <View style={s.closedBanner}>
          <Text style={s.closedText}>{t('contact.threadClosed')}</Text>
        </View>
      ) : (
        <View style={s.inputRow}>
          <TextInput
            value={inputText}
            onChangeText={setInputText}
            placeholder={t('contact.typeReply')}
            placeholderTextColor={c.inkMuted}
            style={s.input}
            multiline
            returnKeyType="send"
            onSubmitEditing={handleSend}
          />
          <Pressable
            style={[s.sendBtn, !inputText.trim() && s.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim()}
          >
            <Ionicons name="send" size={16} color="#FFFFFF" />
          </Pressable>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.paper },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.paper },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line, gap: 8 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.paperDeep, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontFamily: 'Georgia', fontSize: 16, fontWeight: '600', color: c.ink },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  headerStatus: { fontSize: 11, fontWeight: '600' },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: c.teal },
  messagesList: { padding: 16, gap: 12 },
  messageBubble: { maxWidth: '78%', padding: 12, borderRadius: 16 },
  messageMe: { alignSelf: 'flex-end', backgroundColor: c.teal, borderBottomRightRadius: 4 },
  messageThem: { alignSelf: 'flex-start', backgroundColor: c.paperDeep, borderBottomLeftRadius: 4 },
  senderName: { fontSize: 11, fontWeight: '700', color: c.inkSoft, marginBottom: 4 },
  messageText: { fontSize: 14, color: c.ink, lineHeight: 20 },
  messageTextMe: { color: '#FFFFFF' },
  messageFooter: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', marginTop: 4 },
  messageTime: { fontSize: 10, color: c.inkMuted },
  messageTimeMe: { color: 'rgba(255,255,255,0.7)' },
  typingIndicator: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: c.paperDeep, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, marginTop: 4 },
  typingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.teal, marginRight: 6 },
  typingText: { fontSize: 12, fontStyle: 'italic', color: c.inkSoft },
  inputRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line, gap: 8 },
  input: { flex: 1, backgroundColor: c.surface, borderRadius: 20, borderWidth: 1, borderColor: c.lineStrong, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: c.ink, maxHeight: 100 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.teal, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.4 },
  closedBanner: { padding: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line, backgroundColor: c.paperDeep },
  closedText: { fontSize: 13, color: c.inkMuted, textAlign: 'center', fontWeight: '600' },
});
