import { useCallback, useRef, useState } from 'react';
import { LayoutAnimation, Platform, UIManager, StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { theme } from '@/constants/Colors';
import { apiRequest } from '@/lib/api';
import { getUserId } from '@/lib/auth';
import { STAGE_META } from '@/lib/tree';
import { TreeScene } from '@/components/tree/TreeScene';
import { paletteForDate } from '@/components/tree/palette';
import { CheckinCard } from '@/components/CheckinCard';
import type { Checkin, CheckinStats } from '@/lib/types';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function getDateString(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

interface Me {
  fullName: string;
  checkinTimes: string[];
}

export default function HomeScreen() {
  const router = useRouter();
  const greeting = getGreeting();
  const dateString = getDateString();

  const [userName, setUserName] = useState('');
  const [latest, setLatest] = useState<Checkin | null>(null);
  const [checkinTimes, setCheckinTimes] = useState<string[]>([]);
  const [heroExpanded, setHeroExpanded] = useState(true);
  const [stats, setStats] = useState<CheckinStats | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [sunshineBanner, setSunshineBanner] = useState<string | null>(null);

  const hydratedRef = useRef(false);

  const toggleHero = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setHeroExpanded((v) => !v);
  };

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const uid = await getUserId();

          // Hydrate from cache once so the tree never flashes back to seed
          if (uid && !hydratedRef.current) {
            hydratedRef.current = true;
            const cached = await AsyncStorage.getItem(`tree_cache_${uid}`);
            if (cached && !cancelled) {
              try { setStats(JSON.parse(cached) as CheckinStats); } catch {}
            }
          }

          const [me, last, freshStats] = await Promise.all([
            apiRequest<Me>('/auth/me'),
            apiRequest<Checkin | null>('/checkins/latest'),
            apiRequest<CheckinStats>('/checkins/stats'),
          ]);
          if (cancelled) return;
          setUserName(me.fullName || '');
          setCheckinTimes(me.checkinTimes ?? []);
          setLatest(last);
          setStats(freshStats);
          setCelebrate(false);

          if (uid) {
            await AsyncStorage.setItem(`tree_cache_${uid}`, JSON.stringify(freshStats));

            // Growth celebration: stage increased since last seen
            const storedStage = await AsyncStorage.getItem(`tree_stage_${uid}`);
            if (storedStage && freshStats.treeStage > parseInt(storedStage, 10)) {
              setCelebrate(true);
            }
            await AsyncStorage.setItem(`tree_stage_${uid}`, String(freshStats.treeStage));

            // Sunshine banner: anything newer than last seen
            const seen = (await AsyncStorage.getItem(`sunshine_seen_${uid}`)) ?? '';
            const fresh = freshStats.sunshines.find((s) => s.createdAt > seen);
            if (fresh) {
              setSunshineBanner(fresh.fromName.split(' ')[0]);
              await AsyncStorage.setItem(
                `sunshine_seen_${uid}`,
                freshStats.sunshines[0].createdAt
              );
            } else {
              setSunshineBanner(null);
            }
          }
        } catch {
          // Silent — auth guard handles 401s; other errors leave stale state.
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const todaysCheckin = latest && isToday(latest.createdAt) ? latest : null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Green hero header — tap chevron to collapse */}
        {(() => {
          const pal = paletteForDate();
          const streak = stats?.currentStreak ?? 0;
          const weekDots = stats?.weekDots ?? [];
          return (
            <View style={[styles.hero, heroExpanded && { backgroundColor: pal.sky }]}>
              {heroExpanded ? (
                <>
                  <View style={styles.heroTop}>
                    <View>
                      <Text style={[styles.dateText, { color: pal.textSoft }]}>{dateString}</Text>
                      <Text style={[styles.greeting, { color: pal.text }]}>{greeting},</Text>
                      <Text style={[styles.name, { color: pal.text }]}>{userName || 'Friend'} 👋</Text>
                    </View>
                    <View style={styles.avatarCircle}>
                      <FontAwesome name="user" size={28} color={theme.primary} />
                    </View>
                  </View>

                  {sunshineBanner && (
                    <View style={styles.sunshineBanner}>
                      <Text style={styles.sunshineBannerText}>
                        ☀️ {sunshineBanner} sent you sunshine
                      </Text>
                    </View>
                  )}

                  <TreeScene
                    stage={stats?.treeStage ?? 1}
                    fruitCount={stats?.fruitCount ?? 0}
                    streak={streak}
                    sunshines={stats?.sunshines ?? []}
                    size="hero"
                    celebrate={celebrate}
                    onTreePress={() => setShowProgress((v) => !v)}
                    accessibilityLabel={`Your tree: ${STAGE_META[stats?.treeStage ?? 1].name}, ${stats?.totalCheckins ?? 0} check-ins, ${streak}-day streak`}
                  />

                  {stats?.totalCheckins === 0 ? (
                    <Text style={[styles.treeHint, { color: pal.textSoft }]}>
                      Your tree is waiting for its first check-in 🌱
                    </Text>
                  ) : showProgress && stats ? (
                    <Text style={[styles.treeHint, { color: pal.textSoft }]}>
                      {STAGE_META[stats.treeStage].emoji} {STAGE_META[stats.treeStage].name} · {stats.totalCheckins} check-ins
                      {stats.toNextStage !== null
                        ? ` · ${stats.toNextStage} more to ${STAGE_META[(stats.treeStage + 1) as CheckinStats['treeStage']].name}`
                        : ''}
                    </Text>
                  ) : null}

                  {weekDots.length === 7 && (
                    <View style={styles.consistencyRow}>
                      <View style={styles.dotsRow}>
                        {weekDots.map((filled, i) => (
                          <View
                            key={i}
                            style={[
                              styles.dot,
                              filled
                                ? { backgroundColor: pal.night ? '#FFFFFF' : theme.primary }
                                : { borderWidth: 1.5, borderColor: pal.textSoft },
                            ]}
                          />
                        ))}
                      </View>
                      {streak > 0 && (
                        <Text style={[styles.streakText, { color: pal.text }]}>
                          🔥 {streak} day{streak !== 1 ? 's' : ''}
                        </Text>
                      )}
                    </View>
                  )}
                </>
              ) : (
                <View style={styles.heroCompact}>
                  <Text style={styles.heroCompactName}>{greeting}, {userName || 'Friend'} 👋</Text>
                  {streak > 0 && <Text style={styles.streakText}>🔥 {streak}</Text>}
                </View>
              )}
              <Pressable
                style={styles.heroChevron}
                onPress={toggleHero}
                hitSlop={16}
                accessibilityRole="button"
                accessibilityLabel={heroExpanded ? 'Collapse header' : 'Expand header'}
              >
                <FontAwesome
                  name={heroExpanded ? 'chevron-up' : 'chevron-down'}
                  size={11}
                  color={heroExpanded ? paletteForDate().textSoft : 'rgba(255,255,255,0.6)'}
                />
              </Pressable>
            </View>
          );
        })()}

        <View style={styles.body}>
          {checkinTimes.length > 0 && (
            <View style={styles.timesRow}>
              <FontAwesome name="bell-o" size={13} color={theme.textSecondary} />
              <Text style={styles.timesText}>{checkinTimes.join(' · ')}</Text>
            </View>
          )}

          <CheckinCard
            todaysCheckin={todaysCheckin}
            checkinTimes={checkinTimes}
            onStartCheckin={() => router.push('/checkin')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  hero: {
    backgroundColor: theme.primary,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  heroCompact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  heroCompactName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  heroChevron: {
    alignItems: 'center',
    marginTop: 10,
  },
  consistencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  sunshineBanner: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginTop: 8,
  },
  sunshineBannerText: { fontSize: 13, fontWeight: '700', color: '#B45309' },
  treeHint: { fontSize: 13, fontWeight: '600', textAlign: 'center', marginTop: 6 },
  streakText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  dateText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '600',
    marginBottom: 4,
  },
  greeting: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  name: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    marginTop: -12,
  },
  timesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  timesText: {
    fontSize: 13,
    color: theme.textSecondary,
    fontWeight: '500',
  },
});
