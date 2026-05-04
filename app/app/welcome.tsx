import { StyleSheet, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { theme } from '@/constants/Colors';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.hero}>
        <FontAwesome name="heartbeat" size={72} color="#FFFFFF" />
        <Text style={styles.appName}>Sihaty</Text>
        <Text style={styles.tagline}>
          Tell the people who love you{'\n'}how you're doing today.
        </Text>
      </View>

      <View style={styles.body}>
        <View style={styles.features}>
          <FeatureRow icon="check-circle" text="Daily check-in in under 10 seconds" />
          <FeatureRow icon="bell" text="Loved ones notified when it matters" />
          <FeatureRow icon="lock" text="Private — no tracking, no sharing" />
        </View>

        <Pressable
          style={({ pressed }) => [styles.signUpButton, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
          accessibilityLabel="Create account"
          onPress={() => router.push('/register')}>
          <Text style={styles.signUpText}>Get Started</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.signInButton, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
          accessibilityLabel="Sign in"
          onPress={() => router.push('/login')}>
          <Text style={styles.signInText}>
            Already have an account?{' '}
            <Text style={styles.signInBold}>Sign In</Text>
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function FeatureRow({ icon, text }: { icon: React.ComponentProps<typeof FontAwesome>['name']; text: string }) {
  return (
    <View style={styles.featureRow}>
      <FontAwesome name={icon} size={20} color={theme.primary} style={styles.featureIcon} />
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  hero: {
    backgroundColor: theme.primary,
    paddingTop: 60,
    paddingBottom: 56,
    paddingHorizontal: 32,
    alignItems: 'center',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  appName: {
    fontSize: 48,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 16,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 26,
  },
  body: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 36,
    justifyContent: 'space-between',
    paddingBottom: 24,
  },
  features: {
    gap: 20,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  featureIcon: {
    width: 28,
    textAlign: 'center',
  },
  featureText: {
    fontSize: 17,
    color: theme.textPrimary,
    flex: 1,
    lineHeight: 24,
  },
  signUpButton: {
    backgroundColor: theme.cta,
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: 'center',
    marginTop: 32,
  },
  signUpText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  signInButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  signInText: {
    fontSize: 16,
    color: theme.textSecondary,
  },
  signInBold: {
    color: theme.primary,
    fontWeight: '700',
  },
});
