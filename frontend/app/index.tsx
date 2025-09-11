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
  Linking,
  ActivityIndicator,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as LinkingExpo from 'expo-linking';
import { useForm, Controller } from 'react-hook-form';

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

function Header({ onNav }: { onNav: (id: keyof typeof SECTION_IDS) =&gt; void }) {
  return (
    &lt;View style={styles.headerContainer}&gt;
      &lt;View style={styles.header}&gt;
        &lt;Text style={styles.logo}&gt;Buildboard&lt;/Text&gt;
        &lt;View style={styles.nav}&gt;
          &lt;Pressable onPress={() =&gt; onNav('Problem')} hitSlop={8}&gt;
            &lt;Text style={styles.navLink}&gt;Why Buildboard&lt;/Text&gt;
          &lt;/Pressable&gt;
          &lt;Pressable onPress={() =&gt; onNav('Solution')} hitSlop={8}&gt;
            &lt;Text style={styles.navLink}&gt;Features&lt;/Text&gt;
          &lt;/Pressable&gt;
          &lt;Pressable onPress={() =&gt; onNav('Community')} hitSlop={8}&gt;
            &lt;Text style={styles.navLink}&gt;Community&lt;/Text&gt;
          &lt;/Pressable&gt;
          &lt;Pressable onPress={() =&gt; onNav('Signup')} hitSlop={8}&gt;
            &lt;Text style={styles.navLink}&gt;Join Beta&lt;/Text&gt;
          &lt;/Pressable&gt;
        &lt;/View&gt;
        &lt;Pressable onPress={() =&gt; onNav('Signup')} style={styles.primaryCta} hitSlop={8}&gt;
          &lt;Text style={styles.primaryCtaText}&gt;Join the Beta Waitlist&lt;/Text&gt;
        &lt;/Pressable&gt;
      &lt;/View&gt;
    &lt;/View&gt;
  );
}

export default function Index() {
  const scrollRef = useRef&lt;ScrollView&gt;(null);
  const [sectionYs, setSectionYs] = useState&lt;Record&lt;string, number&gt;&gt;({});
  const [width, setWidth] = useState(Dimensions.get('window').width);
  const utm = useUTM();

  const onLayoutSection = (id: string, y: number) =&gt; {
    setSectionYs((prev) =&gt; ({ ...prev, [id]: y }));
  };

  const onNav = (id: keyof typeof SECTION_IDS) =&gt; {
    const y = sectionYs[id];
    if (y != null) {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 88), animated: true });
    }
  };

  const openInstagram = async () =&gt; {
    const url = 'https://instagram.com/thebuildboard';
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      await WebBrowser.openBrowserAsync(url);
    }
  };

  const { control, handleSubmit, reset, formState } = useForm&lt;WaitlistForm&gt;({
    defaultValues: { name: '', email: '', role: undefined as any, hp: '' },
    mode: 'onTouched',
  });
  const [submitting, setSubmitting] = useState(false);
  const [thankYou, setThankYou] = useState(false);
  const isMobile = width &lt; 768;

  const submitWaitlist = async (values: WaitlistForm) =&gt; {
    if ((values.hp || '').trim().length &gt; 0) {
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

  const submitFooterEmail = async (email: string) =&gt; {
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
    &lt;SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}&gt;
      &lt;KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}&gt;
        &lt;Header onNav={onNav} /&gt;
        &lt;ScrollView
          ref={scrollRef}
          style={{ flex: 1, backgroundColor: '#000' }}
          contentContainerStyle={{ paddingTop: 96 }}
          onLayout={(e) =&gt; setWidth(e.nativeEvent.layout.width)}
          keyboardShouldPersistTaps="handled"
        &gt;
          {/* Hero */}
          &lt;View
            onLayout={(e) =&gt; onLayoutSection(SECTION_IDS.Hero, e.nativeEvent.layout.y)}
            style={styles.section}
          &gt;
            &lt;Text style={styles.heroTitle}&gt;The social marketplace for automotive builds.&lt;/Text&gt;
            &lt;Text style={styles.heroSubtitle}&gt;
              Where every build is documented, shared, and connected to the parts and shops that made it.
            &lt;/Text&gt;
            &lt;View style={[styles.row, { flexWrap: 'wrap', gap: 12 }]}&gt;
              &lt;Pressable onPress={() =&gt; onNav('Signup')} style={styles.primaryCtaLg}&gt;
                &lt;Text style={styles.primaryCtaText}&gt;Join the Beta Waitlist&lt;/Text&gt;
              &lt;/Pressable&gt;
              &lt;Pressable onPress={() =&gt; Linking.openURL('/refer')} style={styles.secondaryCtaLg}&gt;
                &lt;Text style={styles.secondaryCtaText}&gt;Refer a Shop or Builder&lt;/Text&gt;
              &lt;/Pressable&gt;
            &lt;/View&gt;
            &lt;View style={styles.heroMedia}&gt;
              &lt;Text style={styles.mediaText}&gt;Hero image / looping video placeholder&lt;/Text&gt;
            &lt;/View&gt;
          &lt;/View&gt;

          {/* Problem */}
          &lt;View onLayout={(e) =&gt; onLayoutSection(SECTION_IDS.Problem, e.nativeEvent.layout.y)} style={styles.section}&gt;
            &lt;Text style={styles.h2}&gt;Car culture is scattered. Buildboard organizes it.&lt;/Text&gt;
            &lt;View style={styles.bullets}&gt;
              &lt;Text style={styles.bullet}&gt;• Instagram and forums are scattered — builds get lost.&lt;/Text&gt;
              &lt;Text style={styles.bullet}&gt;• Shops and builders rarely get attribution or monetization.&lt;/Text&gt;
              &lt;Text style={styles.bullet}&gt;• Brands lack clear attribution from real-world installs.&lt;/Text&gt;
            &lt;/View&gt;
          &lt;/View&gt;

          {/* Solution */}
          &lt;View onLayout={(e) =&gt; onLayoutSection(SECTION_IDS.Solution, e.nativeEvent.layout.y)} style={styles.section}&gt;
            &lt;Text style={styles.h2}&gt;Every build has a story. Buildboard makes it searchable, shoppable, and shareable.&lt;/Text&gt;
            &lt;View style={[styles.grid, isMobile ? undefined : styles.gridRow]}&gt;
              {[
                { title: 'Document', desc: 'Capture parts, steps, and credits for every build.' },
                { title: 'Discover', desc: 'Search builds by model, parts, brands, and shops.' },
                { title: 'Earn', desc: 'Get attribution and affiliate opportunities for contributions.' },
              ].map((c) =&gt; (
                &lt;View key={c.title} style={[styles.card, { flex: 1, minWidth: isMobile ? '100%' : '30%' }]}&gt;
                  &lt;Text style={styles.cardTitle}&gt;{c.title}&lt;/Text&gt;
                  &lt;Text style={styles.cardDesc}&gt;{c.desc}&lt;/Text&gt;
                &lt;/View&gt;
              ))}
            &lt;/View&gt;
          &lt;/View&gt;

          {/* Product */}
          &lt;View onLayout={(e) =&gt; onLayoutSection(SECTION_IDS.Product, e.nativeEvent.layout.y)} style={styles.section}&gt;
            &lt;Text style={styles.h2}&gt;Your build. Your story. Your credit.&lt;/Text&gt;
            &lt;View style={styles.bullets}&gt;
              {['Profile pages', 'Build pages', 'Tagged parts', 'Clean interface'].map((b) =&gt; (
                &lt;Text key={b} style={styles.bullet}&gt;• {b}&lt;/Text&gt;
              ))}
            &lt;/View&gt;
            &lt;View style={styles.mockup}&gt;
              &lt;Text style={styles.mediaText}&gt;Product mockup placeholder&lt;/Text&gt;
            &lt;/View&gt;
          &lt;/View&gt;

          {/* Who It's For */}
          &lt;View onLayout={(e) =&gt; onLayoutSection(SECTION_IDS.WhoFor, e.nativeEvent.layout.y)} style={styles.section}&gt;
            &lt;Text style={styles.h2}&gt;Built for everyone in car culture.&lt;/Text&gt;
            &lt;View style={[styles.grid, isMobile ? undefined : styles.gridRow]}&gt;
              {[
                { title: 'Enthusiasts', desc: 'Track your build and discover proven parts.' },
                { title: 'Builders', desc: 'Showcase work and get proper credit.' },
                { title: 'Shops', desc: 'Document installs and generate leads.' },
                { title: 'Brands', desc: 'See real-world usage and attribution.' },
              ].map((c) =&gt; (
                &lt;View key={c.title} style={[styles.card, { flex: 1, minWidth: isMobile ? '100%' : '45%' }]}&gt;
                  &lt;Text style={styles.cardTitle}&gt;{c.title}&lt;/Text&gt;
                  &lt;Text style={styles.cardDesc}&gt;{c.desc}&lt;/Text&gt;
                &lt;/View&gt;
              ))}
            &lt;/View&gt;
          &lt;/View&gt;

          {/* Community */}
          &lt;View onLayout={(e) =&gt; onLayoutSection(SECTION_IDS.Community, e.nativeEvent.layout.y)} style={styles.section}&gt;
            &lt;Text style={styles.h2}&gt;Built by the community, for the community.&lt;/Text&gt;
            &lt;View style={[styles.grid, isMobile ? undefined : styles.gridRow]}&gt;
              {[
                '“Finally, a place to see complete builds with sources.”',
                '“I can tag every part and credit shops properly.”',
                '“Brands can find real installs and reward creators.”',
              ].map((q, idx) =&gt; (
                &lt;View key={idx} style={[styles.card, { flex: 1, minWidth: isMobile ? '100%' : '30%' }]}&gt;
                  &lt;Text style={styles.cardDesc}&gt;{q}&lt;/Text&gt;
                &lt;/View&gt;
              ))}
            &lt;/View&gt;
          &lt;/View&gt;

          {/* Signup */}
          &lt;View onLayout={(e) =&gt; onLayoutSection(SECTION_IDS.Signup, e.nativeEvent.layout.y)} style={styles.section}&gt;
            &lt;Text style={styles.h2}&gt;Be first to the line.&lt;/Text&gt;
            &lt;Text style={styles.subhead}&gt;Join the beta waitlist and help shape the future of car culture.&lt;/Text&gt;

            {thankYou ? (
              &lt;View style={styles.thanksBox}&gt;
                &lt;Text style={styles.h3}&gt;You’re on the list. We’ll be in touch soon. Follow along @thebuildboard.&lt;/Text&gt;
                &lt;Pressable onPress={openInstagram} style={styles.primaryCta} hitSlop={8}&gt;
                  &lt;Text style={styles.primaryCtaText}&gt;Open Instagram&lt;/Text&gt;
                &lt;/Pressable&gt;
              &lt;/View&gt;
            ) : (
              &lt;View style={styles.form}&gt;
                {/* Honeypot */}
                &lt;Controller
                  control={control}
                  name="hp"
                  render={({ field: { onChange, value } }) =&gt; (
                    &lt;TextInput value={value} onChangeText={onChange} style={styles.honeypot} accessibilityElementsHidden accessibilityLabel="Do not fill" /&gt;
                  )}
                /&gt;
                &lt;Text style={styles.label}&gt;Name&lt;/Text&gt;
                &lt;Controller
                  control={control}
                  name="name"
                  rules={{ required: true, minLength: 2 }}
                  render={({ field: { onChange, value } }) =&gt; (
                    &lt;TextInput
                      value={value}
                      onChangeText={onChange}
                      placeholder="Your name"
                      placeholderTextColor="#666"
                      style={styles.input}
                      onSubmitEditing={Keyboard.dismiss}
                    /&gt;
                  )}
                /&gt;
                {formState.errors.name ? &lt;Text style={styles.error}&gt;Name is required.&lt;/Text&gt; : null}

                &lt;Text style={styles.label}&gt;Email&lt;/Text&gt;
                &lt;Controller
                  control={control}
                  name="email"
                  rules={{
                    required: true,
                    pattern: /[^\s@]+@[^\s@]+\.[^\s@]+/,
                  }}
                  render={({ field: { onChange, value } }) =&gt; (
                    &lt;TextInput
                      value={value}
                      onChangeText={onChange}
                      placeholder="name@example.com"
                      placeholderTextColor="#666"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      style={styles.input}
                    /&gt;
                  )}
                /&gt;
                {formState.errors.email ? &lt;Text style={styles.error}&gt;Valid email required.&lt;/Text&gt; : null}

                &lt;Text style={styles.label}&gt;Role&lt;/Text&gt;
                &lt;Controller
                  control={control}
                  name="role"
                  rules={{ required: true }}
                  render={({ field: { onChange, value } }) =&gt; (
                    &lt;View style={styles.select}&gt;
                      {['Enthusiast', 'Builder', 'Shop', 'Brand'].map((r) =&gt; (
                        &lt;Pressable
                          key={r}
                          onPress={() =&gt; onChange(r as any)}
                          style={[styles.selectOption, value === r &amp;&amp; styles.selectOptionActive]}
                        &gt;
                          &lt;Text style={styles.selectOptionText}&gt;{r}&lt;/Text&gt;
                        &lt;/Pressable&gt;
                      ))}
                    &lt;/View&gt;
                  )}
                /&gt;
                {formState.errors.role ? &lt;Text style={styles.error}&gt;Role is required.&lt;/Text&gt; : null}

                &lt;Pressable onPress={handleSubmit(submitWaitlist)} style={[styles.primaryCta, { marginTop: 16 }]} disabled={submitting}&gt;
                  {submitting ? &lt;ActivityIndicator color="#000" /&gt; : &lt;Text style={styles.primaryCtaText}&gt;Join the Beta Waitlist&lt;/Text&gt;}
                &lt;/Pressable&gt;
                &lt;Text style={styles.privacy}&gt;By joining, you agree to receive occasional updates. Unsubscribe anytime.&lt;/Text&gt;
              &lt;/View&gt;
            )}
          &lt;/View&gt;

          {/* Footer */}
          &lt;View onLayout={(e) =&gt; onLayoutSection(SECTION_IDS.Footer, e.nativeEvent.layout.y)} style={[styles.section, styles.footer]}&gt;
            &lt;Text style={styles.footerTagline}&gt;Every car has a story. Every part has a source. Every builder gets credit.&lt;/Text&gt;
            &lt;View style={[styles.footerRow, { flexDirection: isMobile ? 'column' : 'row' }]}&gt;
              &lt;View style={{ flex: 1 }}&gt;
                &lt;Text style={styles.label}&gt;Stay in the loop&lt;/Text&gt;
                &lt;FooterEmail onSubmit={submitFooterEmail} /&gt;
              &lt;/View&gt;
              &lt;View style={{ flex: 1, gap: 8 }}&gt;
                &lt;Pressable onPress={() =&gt; {}} hitSlop={8}&gt;
                  &lt;Text style={styles.link}&gt;About&lt;/Text&gt;
                &lt;/Pressable&gt;
                &lt;Pressable onPress={() =&gt; Linking.openURL('mailto:team@buildboard.app')} hitSlop={8}&gt;
                  &lt;Text style={styles.link}&gt;Contact&lt;/Text&gt;
                &lt;/Pressable&gt;
                &lt;Pressable onPress={openInstagram} hitSlop={8}&gt;
                  &lt;Text style={styles.link}&gt;Instagram @thebuildboard&lt;/Text&gt;
                &lt;/Pressable&gt;
              &lt;/View&gt;
            &lt;/View&gt;
            &lt;Text style={styles.copy}&gt;© Buildboard 2025&lt;/Text&gt;
          &lt;/View&gt;
        &lt;/ScrollView&gt;
      &lt;/KeyboardAvoidingView&gt;
    &lt;/SafeAreaView&gt;
  );
}

function FooterEmail({ onSubmit }: { onSubmit: (email: string) =&gt; void }) {
  const [email, setEmail] = useState('');
  return (
    &lt;View style={styles.footerEmailRow}&gt;
      &lt;TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        placeholderTextColor="#666"
        keyboardType="email-address"
        autoCapitalize="none"
        style={[styles.input, { flex: 1 }]} /&gt;
      &lt;Pressable onPress={() =&gt; onSubmit(email)} style={[styles.primaryCta, { marginLeft: 8 }]}&gt;
        &lt;Text style={styles.primaryCtaText}&gt;Join the Beta Waitlist&lt;/Text&gt;
      &lt;/Pressable&gt;
    &lt;/View&gt;
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