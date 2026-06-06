import { Ionicons } from '@expo/vector-icons';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useAssistant } from '@/hooks/useAssistant';
import { useAssistantStore } from '@/stores/assistant.store';
import { usePlayerStore } from '@/stores/player.store';
import type { ChatMessage, VibeProfile } from '@/types/assistant';
import type { SongSummary } from '@/types/songs';

const SUGGESTIONS = [
  'studying, something calm in the background',
  'driving, give me something energetic',
  'something light but not too mainstream',
  'more rock',
];

/** Compact, human-readable chips describing the active VibeProfile. */
function describeContext(ctx: VibeProfile): string[] {
  const chips: string[] = [];
  if (ctx.activity) chips.push(ctx.activity);
  if (Object.keys(ctx.featureTargets).length > 0) chips.push('🎚 vibe');
  for (const artist of ctx.artists) chips.push(`🎤 ${artist}`);
  for (const artist of ctx.seedArtists) chips.push(`🎧 like ${artist}`);
  for (const [genre, weight] of Object.entries(ctx.genreBoosts)) {
    chips.push(`${genre} ${weight >= 1 ? '↑' : '↓'}`);
  }
  for (const artist of ctx.excludedArtists) chips.push(`🚫 ${artist}`);
  for (const genre of ctx.excludedGenres) chips.push(`🚫 ${genre}`);
  if (ctx.mainstream < 0) chips.push('underground');
  if (ctx.mainstream > 0) chips.push('hits');
  return chips;
}

export default function Assistant() {
  const router = useRouter();
  const setQueue = usePlayerStore((s) => s.setQueue);
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();

  const messages = useAssistantStore((s) => s.messages);
  const context = useAssistantStore((s) => s.context);
  const songs = useAssistantStore((s) => s.songs);
  const addUserMessage = useAssistantStore((s) => s.addUserMessage);
  const addAssistantMessage = useAssistantStore((s) => s.addAssistantMessage);
  const applyReply = useAssistantStore((s) => s.applyReply);
  const reset = useAssistantStore((s) => s.reset);

  const { mutate, isPending } = useAssistant();
  const [input, setInput] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const scrollToEnd = useCallback(() => {
    // Defer so it runs after the keyboard frame / new content settles.
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  }, []);

  // Manual keyboard handling: KeyboardAvoidingView is unreliable on Android
  // with edge-to-edge (app.json `edgeToEdgeEnabled`), so we measure the keyboard
  // and pad the container ourselves. The tab bar already sits below the screen
  // content, so the actual overlap is (keyboardHeight - tabBarHeight).
  useEffect(() => {
    const showEvt =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvt, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      scrollToEnd();
    });
    const hideSub = Keyboard.addListener(hideEvt, () => setKeyboardHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [scrollToEnd]);

  // On Android edge-to-edge the keyboard height and tabBarHeight account for the
  // bottom nav-bar inset differently, so we add it back to avoid under-padding.
  const overlap =
    Platform.OS === 'android'
      ? keyboardHeight - tabBarHeight + insets.bottom
      : keyboardHeight - tabBarHeight;
  const paddingBottom = Math.max(overlap, 0);

  const send = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text || isPending) return;
      setInput('');
      addUserMessage(text);
      scrollToEnd();
      // Snapshot the current context — the server merges its patch onto it.
      mutate(
        { text, context: useAssistantStore.getState().context },
        {
          onSuccess: (reply) => applyReply(reply),
          onError: () =>
            addAssistantMessage(
              'Sorry, something went wrong. Please try again. 🙏',
            ),
        },
      );
    },
    [
      isPending,
      addUserMessage,
      addAssistantMessage,
      applyReply,
      mutate,
      scrollToEnd,
    ],
  );

  const renderMessage = useCallback(({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';
    return (
      <View
        className={`my-1 max-w-[82%] rounded-2xl px-4 py-2.5 ${
          isUser ? 'self-end bg-cyan-500/30' : 'self-start bg-white/10'
        }`}
      >
        <Text className="text-[15px] leading-5 text-white">{item.text}</Text>
      </View>
    );
  }, []);

  const openSong = useCallback(
    (song: SongSummary) => {
      setQueue(songs.map((s) => s.id));
      router.push(`/song/${song.id}`);
    },
    [setQueue, songs, router],
  );

  const chips = describeContext(context);
  // Quick prompts stay available and reappear whenever the input is empty —
  // including for the second, third, … prompt (not just the empty screen).
  const showSuggestions = input.trim().length === 0;

  return (
    <View className="flex-1 bg-ink-950">
      <LinearGradient
        colors={['#020617', '#0e7490']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', inset: 0 }}
      />
      <SafeAreaView className="flex-1" edges={['top']}>
        <View className="flex-1" style={{ paddingBottom }}>
          {/* Header */}
          <View className="flex-row items-center justify-between px-4 pb-1 pt-2">
            <Text className="text-2xl font-bold text-white">Muse</Text>
            {messages.length > 0 ? (
              <Pressable
                onPress={reset}
                hitSlop={8}
                className="h-10 w-10 items-center justify-center rounded-full bg-white/10 active:bg-white/20"
              >
                <Ionicons name="refresh" size={18} color="#ffffff" />
              </Pressable>
            ) : null}
          </View>

          {/* Active-context chips */}
          {chips.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}
              className="max-h-9 shrink-0 grow-0 py-1"
            >
              {chips.map((chip) => (
                <View
                  key={chip}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1"
                >
                  <Text className="text-xs text-brand-100/80">{chip}</Text>
                </View>
              ))}
            </ScrollView>
          ) : null}

          {/* Messages */}
          {messages.length === 0 ? (
            <View className="flex-1 items-center justify-center px-8">
              <Ionicons name="sparkles-outline" size={40} color="#67e8f966" />
              <Text className="mt-4 text-center text-base text-brand-100/70">
                Tell me what you&apos;re doing or the vibe you want — the
                recommendations adapt.
              </Text>
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={renderMessage}
              style={{ flex: 1 }}
              contentContainerStyle={{
                paddingHorizontal: 16,
                paddingVertical: 8,
              }}
              keyboardShouldPersistTaps="handled"
              onContentSizeChange={scrollToEnd}
              ListFooterComponent={
                isPending ? (
                  <View className="my-1 self-start rounded-2xl bg-white/10 px-4 py-3">
                    <ActivityIndicator color="#67e8f9" size="small" />
                  </View>
                ) : null
              }
            />
          )}

          {/* Live recommendation strip */}
          {songs.length > 0 ? (
            <View className="shrink-0 border-t border-white/5 pt-2">
              <Text className="px-4 pb-1 text-xs font-semibold text-brand-100/60">
                For this vibe
              </Text>
              <FlatList
                horizontal
                data={songs}
                keyExtractor={(item) => item.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => openSong(item)}
                    className="w-28 active:opacity-80"
                  >
                    <View className="h-28 w-28 overflow-hidden rounded-xl bg-ink-800">
                      {item.coverUrl ? (
                        <Image
                          source={{ uri: item.coverUrl }}
                          style={{ width: 112, height: 112 }}
                          contentFit="cover"
                          transition={200}
                        />
                      ) : null}
                    </View>
                    <Text
                      numberOfLines={1}
                      className="mt-1 text-xs font-semibold text-white"
                    >
                      {item.title}
                    </Text>
                    <Text
                      numberOfLines={1}
                      className="text-xs text-brand-100/60"
                    >
                      {item.artist}
                    </Text>
                  </Pressable>
                )}
              />
            </View>
          ) : null}

          {/* Quick-prompt suggestions — reappear whenever the input is empty */}
          {showSuggestions ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}
              className="shrink-0 grow-0 pt-2"
            >
              {SUGGESTIONS.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => send(s)}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-2 active:bg-white/10"
                >
                  <Text className="text-xs text-brand-100/90">{s}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}

          {/* Input bar */}
          <View className="flex-row items-end gap-2 px-4 pb-2 pt-2">
            <View className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-3">
              <TextInput
                value={input}
                onChangeText={setInput}
                onFocus={scrollToEnd}
                placeholder="What are you doing / what vibe?"
                placeholderTextColor="#67e8f970"
                multiline
                className="max-h-28 py-3 text-base text-white"
                onSubmitEditing={() => send(input)}
                returnKeyType="send"
                blurOnSubmit={false}
              />
            </View>
            <Pressable
              onPress={() => send(input)}
              disabled={isPending || input.trim().length === 0}
              className={`h-11 w-11 items-center justify-center rounded-full ${
                isPending || input.trim().length === 0
                  ? 'bg-white/10'
                  : 'bg-cyan-500 active:bg-cyan-400'
              }`}
            >
              <Ionicons name="arrow-up" size={20} color="#ffffff" />
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}
