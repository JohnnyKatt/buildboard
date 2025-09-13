import React, { useMemo, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useEffect } from 'react';
import * as LinkingExpo from 'expo-linking';
import { useForm, Controller } from 'react-hook-form';
import { router } from 'expo-router';

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const SECTION_IDS = {
  Hero: 'Hero',
  Problem: 'Problem',
  Solution: 'Solution',
  Product: 'Product',
  WhoFor: 'WhoFor',
  Community: 'Community',
  Signup: 'Signup',
  Footer: 'Footer',
} as const;

type WaitlistForm = {
  name: string;
  email: string;
  role: 'Enthusiast' | 'Builder' | 'Shop' | 'Brand' | 'Subscriber';
  hp?: string; // honeypot
};

function useUTM() {
  const url = useMemo(() => {
    if (Platform.OS === 'web') {
      return window.location.href;
    }
    try {
      const initial = LinkingExpo.useURL();
      return initial || 'app://buildboard';
    } catch {
      return 'app://buildboard';
    }
  }, []);

  const params = useMemo(() => {
    if (Platform.OS === 'web') {
      const u = new URL(url);
      const sp = u.searchParams;
      return {
        source_url: url,
        utm_source: sp.get('utm_source') || undefined,
        utm_campaign: sp.get('utm_campaign') || undefined,
        utm_medium: sp.get('utm_medium') || undefined,
      };
    }
    return { source_url: url, utm_source: undefined, utm_campaign: undefined, utm_medium: undefined };
  }, [url]);

  return params;
}

function Header({ onNav }: { onNav: (id: keyof typeof SECTION_IDS) => void }) {
  return (
    <View style={styles.headerContainer}>
      <View style={styles.header}>
        <Text style={styles.logo}>Buildboard</Text>
        <View style={styles.nav}>
          <Pressable onPress={() => onNav('Problem')} hitSlop={8}>
            <Text style={styles.navLink}>Why Buildboard</Text>
          </Pressable>
          <Pressable onPress={() => onNav('Solution')} hitSlop={8}>
            <Text style={styles.navLink}>Features</Text>
          </Pressable>
          <Pressable onPress={() => onNav('Community')} hitSlop={8}>
            <Text style={styles.navLink}>Community</Text>
          </Pressable>
          <Pressable onPress={() => onNav('Signup')} hitSlop={8}>
            <Text style={styles.navLink}>Join Beta</Text>
          </Pressable>
        </View>
        <Pressable onPress={() => onNav('Signup')} style={styles.primaryCta} hitSlop={8}>
          <Text style={styles.primaryCtaText}>Join the Beta Waitlist</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function Index() {
  const scrollRef = useRef<ScrollView>(null);
  const [sectionYs, setSectionYs] = useState<Record<string, number>>({});
  const [width, setWidth] = useState(Dimensions.get('window').width);
  const utm = useUTM();

  const onLayoutSection = (id: string, y: number) => {
    setSectionYs((prev) => ({ ...prev, [id]: y }));
  };

  const onNav = (id: keyof typeof SECTION_IDS) => {
    const y = sectionYs[id];
    if (y != null) {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 88), animated: true });
    }
  };

  const openInstagram = async () => {
    const url = 'https://instagram.com/thebuildboard';
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      await WebBrowser.openBrowserAsync(url);
    }
  };

  const { control, handleSubmit, reset, formState } = useForm<WaitlistForm>({
    defaultValues: { name: '', email: '', role: undefined as any, hp: '' },
    mode: 'onTouched',
  });
  const [submitting, setSubmitting] = useState(false);
  const [thankYou, setThankYou] = useState(false);
  const isMobile = width < 768;

  const submitWaitlist = async (values: WaitlistForm) => {
    if ((values.hp || '').trim().length > 0) {
      // Honeypot filled: silently drop
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${BASE_URL}/api/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: values.name.trim(),
          email: values.email.trim(),
          role: values.role,
          ...utm,
        }),
      });
      if (!res.ok) throw new Error('Failed to join waitlist');
      setThankYou(true);
      reset();
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const submitFooterEmail = async (email: string) => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    try {
      await fetch(`${BASE_URL}/api/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: email,
          email,
          role: 'Subscriber',
          ...utm,
        }),
      });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <Header onNav={onNav} />
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1, backgroundColor: '#000' }}
          contentContainerStyle={{ paddingTop: 96 }}
          onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
          keyboardShouldPersistTaps="handled"
        >
          {/* Hero */}
          <View
            onLayout={(e) => onLayoutSection(SECTION_IDS.Hero, e.nativeEvent.layout.y)}
            style={styles.section}
          >
            <Text style={styles.heroTitle}>The social marketplace for automotive builds.</Text>
            <Text style={styles.heroSubtitle}>
              Where every build is documented, shared, and connected to the parts and shops that made it.
            </Text>
            <View style={[styles.row, { flexWrap: 'wrap', gap: 12 }]}>
              <Pressable onPress={() => onNav('Signup')} style={styles.primaryCtaLg}>
                <Text style={styles.primaryCtaText}>Join the Beta Waitlist</Text>
              </Pressable>
              <Pressable onPress={() => router.push('/refer')} style={styles.secondaryCtaLg}>
                <Text style={styles.secondaryCtaText}>Refer a Shop or Builder</Text>
              </Pressable>
            </View>
            <View style={styles.heroMedia}>
              <Text style={styles.mediaText}>Hero image / looping video placeholder</Text>
            </View>
          </View>

          {/* Problem */}
          <View onLayout={(e) => onLayoutSection(SECTION_IDS.Problem, e.nativeEvent.layout.y)} style={styles.section}>
            <Text style={styles.h2}>Car culture is scattered. Buildboard organizes it.</Text>
            <View style={styles.bullets}>
              <Text style={styles.bullet}>• Instagram and forums are scattered — builds get lost.</Text>
              <Text style={styles.bullet}>• Shops and builders rarely get attribution or monetization.</Text>
              <Text style={styles.bullet}>• Brands lack clear attribution from real-world installs.</Text>
            </View>
          </View>

          {/* Solution */}
          <View onLayout={(e) => onLayoutSection(SECTION_IDS.Solution, e.nativeEvent.layout.y)} style={styles.section}>
            <Text style={styles.h2}>Every build has a story. Buildboard makes it searchable, shoppable, and shareable.</Text>
            <View style={[styles.grid, isMobile ? undefined : styles.gridRow]}>
              {[
                { title: 'Document', desc: 'Capture parts, steps, and credits for every build.' },
                { title: 'Discover', desc: 'Search builds by model, parts, brands, and shops.' },
                { title: 'Earn', desc: 'Get attribution and affiliate opportunities for contributions.' },
              ].map((c) => (
                <View key={c.title} style={[styles.card, { flex: 1, minWidth: isMobile ? '100%' : '30%' }]}>
                  <Text style={styles.cardTitle}>{c.title}</Text>
                  <Text style={styles.cardDesc}>{c.desc}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Product */}
          <View onLayout={(e) => onLayoutSection(SECTION_IDS.Product, e.nativeEvent.layout.y)} style={styles.section}>
            <Text style={styles.h2}>Your build. Your story. Your credit.</Text>
            <View style={styles.bullets}>
              {['Profile pages', 'Build pages', 'Tagged parts', 'Clean interface'].map((b) => (
                <Text key={b} style={styles.bullet}>• {b}</Text>
              ))}
            </View>
            <View style={styles.mockup}>
              <Text style={styles.mediaText}>Product mockup placeholder</Text>
            </View>
          </View>

          {/* Who It's For */}
          <View onLayout={(e) => onLayoutSection(SECTION_IDS.WhoFor, e.nativeEvent.layout.y)} style={styles.section}>
            <Text style={styles.h2}>Built for everyone in car culture.</Text>
            <View style={[styles.grid, isMobile ? undefined : styles.gridRow]}>
              {[
                { title: 'Enthusiasts', desc: 'Track your build and discover proven parts.' },
                { title: 'Builders', desc: 'Showcase work and get proper credit.' },
                { title: 'Shops', desc: 'Document installs and generate leads.' },
                { title: 'Brands', desc: 'See real-world usage and attribution.' },
              ].map((c) => (
                <View key={c.title} style={[styles.card, { flex: 1, minWidth: isMobile ? '100%' : '45%' }]}>
                  <Text style={styles.cardTitle}>{c.title}</Text>
                  <Text style={styles.cardDesc}>{c.desc}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Community */}
          <View onLayout={(e) => onLayoutSection(SECTION_IDS.Community, e.nativeEvent.layout.y)} style={styles.section}>
            <Text style={styles.h2}>Built by the community, for the community.</Text>
            <View style={[styles.grid, isMobile ? undefined : styles.gridRow]}>
              {[
                '“Finally, a place to see complete builds with sources.”',
                '“I can tag every part and credit shops properly.”',
                '“Brands can find real installs and reward creators.”',
              ].map((q, idx) => (
                <View key={idx} style={[styles.card, { flex: 1, minWidth: isMobile ? '100%' : '30%' }]}>
                  <Text style={styles.cardDesc}>{q}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Signup */}
          <View onLayout={(e) => onLayoutSection(SECTION_IDS.Signup, e.nativeEvent.layout.y)} style={styles.section}>
            <Text style={styles.h2}>Be first to the line.</Text>
            <Text style={styles.subhead}>Join the beta waitlist and help shape the future of car culture.</Text>

            {thankYou ? (
              <View style={styles.thanksBox}>
                <Text style={styles.h3}>You’re on the list. We’ll be in touch soon. Follow along @thebuildboard.</Text>
                <Pressable onPress={openInstagram} style={styles.primaryCta} hitSlop={8}>
                  <Text style={styles.primaryCtaText}>Open Instagram</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.form}>
                {/* Honeypot */}
                <Controller
                  control={control}
                  name="hp"
                  render={({ field: { onChange, value } }) => (
                    <TextInput value={value} onChangeText={onChange} style={styles.honeypot} accessibilityElementsHidden accessibilityLabel="Do not fill" />
                  )}
                />
                <Text style={styles.label}>Name</Text>
                <Controller
                  control={control}
                  name="name"
                  rules={{ required: true, minLength: 2 }}
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      value={value}
                      onChangeText={onChange}
                      placeholder="Your name"
                      placeholderTextColor="#666"
                      style={styles.input}
                      onSubmitEditing={Keyboard.dismiss}
                    />
                  )}
                />
                {formState.errors.name ? <Text style={styles.error}>Name is required.</Text> : null}

                <Text style={styles.label}>Email</Text>
                <Controller
                  control={control}
                  name="email"
                  rules={{
                    required: true,
                    pattern: /[^\s@]+@[^\s@]+\.[^\s@]+/,
                  }}
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      value={value}
                      onChangeText={onChange}
                      placeholder="name@example.com"
                      placeholderTextColor="#666"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      style={styles.input}
                    />
                  )}
                />
                {formState.errors.email ? <Text style={styles.error}>Valid email required.</Text> : null}

                <Text style={styles.label}>Role</Text>
                <Controller
                  control={control}
                  name="role"
                  rules={{ required: true }}
                  render={({ field: { onChange, value } }) => (
                    <View style={styles.select}>
                      {['Enthusiast', 'Builder', 'Shop', 'Brand'].map((r) => (
                        <Pressable
                          key={r}
                          onPress={() => onChange(r as any)}
                          style={[styles.selectOption, value === r && styles.selectOptionActive]}
                        >
                          <Text style={styles.selectOptionText}>{r}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                />
                {formState.errors.role ? <Text style={styles.error}>Role is required.</Text> : null}

                <Pressable onPress={handleSubmit(submitWaitlist)} style={[styles.primaryCta, { marginTop: 16 }]} disabled={submitting}>
                  {submitting ? <ActivityIndicator color="#000" /> : <Text style={styles.primaryCtaText}>Join the Beta Waitlist</Text>}
                </Pressable>
                <Text style={styles.privacy}>By joining, you agree to receive occasional updates. Unsubscribe anytime.</Text>
              </View>
            )}
          </View>

          {/* Footer */}
          <View onLayout={(e) => onLayoutSection(SECTION_IDS.Footer, e.nativeEvent.layout.y)} style={[styles.section, styles.footer]}>
            <Text style={styles.footerTagline}>Every car has a story. Every part has a source. Every builder gets credit.</Text>
            <View style={[styles.footerRow, { flexDirection: isMobile ? 'column' : 'row' }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Stay in the loop</Text>
                <FooterEmail onSubmit={submitFooterEmail} />
              </View>
              <View style={{ flex: 1, gap: 8 }}>
                <Pressable onPress={() => {}} hitSlop={8}>
                  <Text style={styles.link}>About</Text>
                </Pressable>
                <Pressable onPress={() => LinkingExpo.openURL('mailto:team@buildboard.app')} hitSlop={8}>
                  <Text style={styles.link}>Contact</Text>
                </Pressable>
                <Pressable onPress={openInstagram} hitSlop={8}>
                  <Text style={styles.link}>Instagram @thebuildboard</Text>
                </Pressable>
              </View>
            </View>
            <Text style={styles.copy}>© Buildboard 2025</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FooterEmail({ onSubmit }: { onSubmit: (email: string) => void }) {
  const [email, setEmail] = useState('');
  return (
    <View style={styles.footerEmailRow}>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        placeholderTextColor="#666"
        keyboardType="email-address"
        autoCapitalize="none"
        style={[styles.input, { flex: 1 }]} />
      <Pressable onPress={() => onSubmit(email)} style={[styles.primaryCta, { marginLeft: 8 }]}>
        <Text style={styles.primaryCtaText}>Join the Beta Waitlist</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: 'rgba(0,0,0,0.9)'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  logo: { color: '#fff', fontSize: 20, fontWeight: '600' },
  nav: { flexDirection: 'row', gap: 16 },
  navLink: { color: '#fff' },
  primaryCta: { backgroundColor: '#fff', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8 },
  primaryCtaLg: { backgroundColor: '#fff', paddingVertical: 14, paddingHorizontal: 18, borderRadius: 10 },
  primaryCtaText: { color: '#000', fontWeight: '700' },
  secondaryCtaLg: { borderWidth: 1, borderColor: '#fff', paddingVertical: 14, paddingHorizontal: 18, borderRadius: 10 },
  secondaryCtaText: { color: '#fff', fontWeight: '600' },

  section: { paddingHorizontal: 16, paddingVertical: 32, gap: 16 },
  row: { flexDirection: 'row', alignItems: 'center' },
  heroTitle: { color: '#fff', fontSize: 28, fontWeight: '800' },
  heroSubtitle: { color: '#ccc', fontSize: 16 },
  heroMedia: { height: 200, borderWidth: 1, borderColor: '#333', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  mediaText: { color: '#666' },

  h2: { color: '#fff', fontSize: 22, fontWeight: '700' },
  h3: { color: '#fff', fontSize: 18, fontWeight: '700' },
  subhead: { color: '#ccc' },
  bullets: { gap: 8 },
  bullet: { color: '#ccc' },

  grid: { gap: 12 },
  gridRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { borderWidth: 1, borderColor: '#222', borderRadius: 12, padding: 16, backgroundColor: '#0a0a0a' },
  cardTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 4 },
  cardDesc: { color: '#ccc' },

  mockup: { height: 180, borderWidth: 1, borderColor: '#333', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  form: { gap: 8 },
  label: { color: '#fff', marginTop: 8 },
  input: { backgroundColor: '#111', color: '#fff', borderWidth: 1, borderColor: '#333', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 12 },
  select: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  selectOption: { paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: '#333', borderRadius: 8 },
  selectOptionActive: { backgroundColor: '#fff' },
  selectOptionText: { color: '#fff' },
  error: { color: '#ff6b6b' },
  privacy: { color: '#777', marginTop: 8 },
  thanksBox: { borderWidth: 1, borderColor: '#333', padding: 16, borderRadius: 12, gap: 12 },

  footer: { borderTopWidth: 1, borderTopColor: '#111' },
  footerTagline: { color: '#fff', fontSize: 16, marginBottom: 8 },
  footerRow: { gap: 16, alignItems: 'flex-start' },
  footerEmailRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  link: { color: '#fff' },
  copy: { color: '#666', marginTop: 16 },
  honeypot: { height: 0, width: 0, opacity: 0 },
});