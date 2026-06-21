import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  AlgorithmPicker,
  type AlgorithmOption,
} from '@/components/AlgorithmPicker';
import { useInsights, type InsightsRangeOption } from '@/hooks/useInsights';
import type {
  ArtistCount,
  GenreCount,
  HourBucket,
  ListeningInsights,
  SongCount,
  TasteShift,
  WeekdayBucket,
} from '@/types/insights';

const RANGE_OPTIONS: readonly AlgorithmOption<string>[] = [
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '365', label: 'Last year' },
];

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Insights() {
  const [days, setDays] = useState<InsightsRangeOption>(90);
  const { data, isLoading, isRefetching, refetch, error } = useInsights(days);

  return (
    <View className="flex-1 bg-ink-950">
      <LinearGradient
        colors={['#020617', '#312e81']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', inset: 0 }}
      />
      <SafeAreaView className="flex-1" edges={['top']}>
        <View className="px-4 pb-1 pt-2">
          <Text className="text-2xl font-bold text-white">Your sound</Text>
          <Text className="mt-0.5 text-xs text-brand-100/60">
            How your listening looks over time.
          </Text>
        </View>

        <AlgorithmPicker
          options={RANGE_OPTIONS}
          value={String(days)}
          onChange={(next) => setDays(Number(next) as InsightsRangeOption)}
        />

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#a5b4fc" />
          </View>
        ) : error ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="text-center text-base text-rose-200">
              Couldn&apos;t load your insights.
            </Text>
            <Pressable
              onPress={() => void refetch()}
              className="mt-4 rounded-full bg-white/10 px-4 py-2 active:bg-white/20"
            >
              <Text className="text-white">Try again</Text>
            </Pressable>
          </View>
        ) : data && data.totals.plays > 0 ? (
          <ScrollView
            contentContainerStyle={{ paddingBottom: 32 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={() => void refetch()}
                tintColor="#a5b4fc"
              />
            }
          >
            <InsightsBody data={data} />
          </ScrollView>
        ) : (
          <View className="flex-1 items-center justify-center px-8">
            <Ionicons name="stats-chart-outline" size={40} color="#a5b4fc66" />
            <Text className="mt-4 text-center text-base text-brand-100/70">
              Play some songs and your listening insights will show up here.
            </Text>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

function InsightsBody({ data }: { data: ListeningInsights }) {
  return (
    <View className="gap-6 px-4 pt-2">
      <TotalsGrid totals={data.totals} />

      {data.topArtists.length > 0 && (
        <Section title="Top artists">
          <TopArtists artists={data.topArtists} />
        </Section>
      )}

      {data.topSongs.length > 0 && (
        <Section title="Top songs">
          <TopSongs songs={data.topSongs} />
        </Section>
      )}

      {data.topGenres.length > 0 && (
        <Section title="Top genres">
          <TopGenres genres={data.topGenres} />
        </Section>
      )}

      <Section title="When you listen">
        <HourChart buckets={data.byHour} />
        <WeekdayChart buckets={data.byWeekday} />
      </Section>

      {(data.tasteShift.rising.length > 0 ||
        data.tasteShift.falling.length > 0) && (
        <Section title="How your taste is shifting">
          <TasteShiftView shift={data.tasteShift} />
        </Section>
      )}
    </View>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View>
      <Text className="mb-3 text-sm font-semibold uppercase tracking-wide text-brand-100/60">
        {title}
      </Text>
      {children}
    </View>
  );
}

function TotalsGrid({ totals }: { totals: ListeningInsights['totals'] }) {
  const cards = [
    { label: 'Songs played', value: formatNumber(totals.plays) },
    { label: 'Minutes', value: formatNumber(totals.listeningMinutes) },
    { label: 'Artists', value: formatNumber(totals.uniqueArtists) },
    { label: 'Saved', value: formatNumber(totals.saves) },
  ];
  return (
    <View className="flex-row flex-wrap gap-3">
      {cards.map((card) => (
        <View
          key={card.label}
          className="min-w-[45%] flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
        >
          <Text className="text-2xl font-bold text-white">{card.value}</Text>
          <Text className="mt-0.5 text-xs text-brand-100/60">{card.label}</Text>
        </View>
      ))}
    </View>
  );
}

function TopArtists({ artists }: { artists: ArtistCount[] }) {
  return (
    <View className="gap-2">
      {artists.map((item, index) => (
        <View
          key={item.artist}
          className="flex-row items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
        >
          <Text className="w-6 text-base font-bold text-brand-100/50">
            {index + 1}
          </Text>
          <Text className="flex-1 text-base text-white" numberOfLines={1}>
            {item.artist}
          </Text>
          <Text className="text-sm text-brand-100/60">
            {formatNumber(item.plays)} plays
          </Text>
        </View>
      ))}
    </View>
  );
}

function TopSongs({ songs }: { songs: SongCount[] }) {
  const router = useRouter();
  return (
    <View className="gap-2">
      {songs.map((item, index) => (
        <Pressable
          key={item.song.id}
          onPress={() => router.push(`/song/${item.song.id}`)}
          className="flex-row items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 active:bg-white/10"
        >
          <Text className="w-6 text-base font-bold text-brand-100/50">
            {index + 1}
          </Text>
          <View className="flex-1">
            <Text className="text-base text-white" numberOfLines={1}>
              {item.song.title}
            </Text>
            <Text className="text-xs text-brand-100/60" numberOfLines={1}>
              {item.song.artist}
            </Text>
          </View>
          <Text className="text-sm text-brand-100/60">
            {formatNumber(item.plays)} plays
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function TopGenres({ genres }: { genres: GenreCount[] }) {
  return (
    <View className="gap-3">
      {genres.map((item) => (
        <View key={item.genre}>
          <View className="mb-1 flex-row items-center justify-between">
            <Text className="text-sm capitalize text-white">{item.genre}</Text>
            <Text className="text-xs text-brand-100/60">
              {Math.round(item.share * 100)}%
            </Text>
          </View>
          <View className="h-2 overflow-hidden rounded-full bg-white/10">
            <View
              className="h-full rounded-full bg-indigo-400"
              style={{ width: `${Math.max(item.share * 100, 2)}%` }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

function HourChart({ buckets }: { buckets: HourBucket[] }) {
  const max = Math.max(1, ...buckets.map((b) => b.plays));
  return (
    <View className="mb-5 rounded-2xl border border-white/10 bg-white/5 p-4">
      <Text className="mb-3 text-xs text-brand-100/60">By hour of day</Text>
      <View className="h-20 flex-row items-end gap-0.5">
        {buckets.map((bucket) => (
          <View
            key={bucket.hour}
            className="flex-1 rounded-sm bg-indigo-400"
            style={{
              height: `${Math.max((bucket.plays / max) * 100, 3)}%`,
              opacity: bucket.plays > 0 ? 1 : 0.25,
            }}
          />
        ))}
      </View>
      <View className="mt-1 flex-row justify-between">
        {['12a', '6a', '12p', '6p', '11p'].map((label) => (
          <Text key={label} className="text-[10px] text-brand-100/40">
            {label}
          </Text>
        ))}
      </View>
    </View>
  );
}

function WeekdayChart({ buckets }: { buckets: WeekdayBucket[] }) {
  const max = Math.max(1, ...buckets.map((b) => b.plays));
  return (
    <View className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <Text className="mb-3 text-xs text-brand-100/60">By day of week</Text>
      <View className="h-24 flex-row items-end gap-2">
        {buckets.map((bucket) => (
          <View key={bucket.weekday} className="flex-1 items-center gap-1">
            <View className="w-full flex-1 justify-end">
              <View
                className="w-full rounded-md bg-indigo-400"
                style={{
                  height: `${Math.max((bucket.plays / max) * 100, 3)}%`,
                  opacity: bucket.plays > 0 ? 1 : 0.25,
                }}
              />
            </View>
            <Text className="text-[10px] text-brand-100/50">
              {WEEKDAY_LABELS[bucket.weekday]}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function TasteShiftView({ shift }: { shift: TasteShift }) {
  return (
    <View className="gap-2">
      {shift.rising.map((trend) => (
        <View
          key={`up-${trend.genre}`}
          className="flex-row items-center gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-3"
        >
          <Ionicons name="trending-up" size={18} color="#34d399" />
          <Text className="flex-1 text-base capitalize text-white">
            {trend.genre}
          </Text>
          <Text className="text-sm text-emerald-300">
            +{formatNumber(trend.delta)} plays
          </Text>
        </View>
      ))}
      {shift.falling.map((trend) => (
        <View
          key={`down-${trend.genre}`}
          className="flex-row items-center gap-3 rounded-2xl border border-rose-400/20 bg-rose-400/5 px-4 py-3"
        >
          <Ionicons name="trending-down" size={18} color="#fb7185" />
          <Text className="flex-1 text-base capitalize text-white">
            {trend.genre}
          </Text>
          <Text className="text-sm text-rose-300">
            {formatNumber(trend.delta)} plays
          </Text>
        </View>
      ))}
    </View>
  );
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}
