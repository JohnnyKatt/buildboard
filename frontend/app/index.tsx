import React, { useMemo, useRef, useState, useEffect } from 'react';
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
  Modal,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as LinkingExpo from 'expo-linking';
import { useForm, Controller } from 'react-hook-form';
import { router } from 'expo-router';
import { trackWaitlistSubmit, trackOutboundInstagram, trackWaitlistSuccessModalShown } from '../src/utils/analytics';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInUp, FadeIn, FadeInRight } from 'react-native-reanimated';

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
  role: 'Enthusiast' | 'Builder' | 'Shop' | 'Brand' | 'Subscriber' | undefined;
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
        prefill_role: sp.get('role') || undefined,
      } as const;
    }
    return { source_url: url, utm_source: undefined, utm_campaign: undefined, utm_medium: undefined, prefill_role: undefined } as const;
  }, [url]);

  return params;
}

function Header({ onNav, navReady, onTop, isMobileSmall, onOpenMenu }: { onNav: (id: keyof typeof SECTION_IDS) => void; navReady: boolean; onTop: () => void; isMobileSmall: boolean; onOpenMenu: () => void; }) {
  if (isMobileSmall) {
    return (
      <View style={styles.headerContainer}>
        <View style={[styles.headerMobile, styles.containerWrap]}>
          <Pressable accessibilityLabel="Go to top" onPress={onTop} hitSlop={8}>
            <Text style={styles.logo}>Buildboard</Text>
          </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Pressable
              accessibilityLabel="Open navigation menu"
              onPress={onOpenMenu}
              style={styles.hamburger}
            >
              <Text style={styles.hamburgerText}>≡</Text>
            </Pressable>
            <Pressable onPress={() => onNav('Signup')} style={[styles.primaryCta, styles.headerBtn]} hitSlop={8} disabled={!navReady}>
              <Text style={styles.primaryCtaText}>Join Beta</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }
  return (
    <View style={styles.headerContainer}>
      <View style={[styles.header, styles.containerWrap]}>
        <Pressable accessibilityLabel="Go to top" onPress={onTop} hitSlop={8}>
          <Text style={styles.logo}>Buildboard</Text>
        </Pressable>
        <View style={styles.nav}>
          <Pressable onPress={() => onNav('Problem')} hitSlop={8} disabled={!navReady}>
            <Text style={[styles.navLink, !navReady && styles.navLinkDisabled]}>Why Buildboard</Text>
          </Pressable>
          <Pressable onPress={() => onNav('Solution')} hitSlop={8} disabled={!navReady}>
            <Text style={[styles.navLink, !navReady && styles.navLinkDisabled]}>Features</Text>
          </Pressable>
          <Pressable onPress={() => onNav('WhoFor')} hitSlop={8} disabled={!navReady}>
            <Text style={[styles.navLink, !navReady && styles.navLinkDisabled]}>Who It’s For</Text>
          </Pressable>
          <Pressable onPress={() => onNav('Community')} hitSlop={8} disabled={!navReady}>
            <Text style={[styles.navLink, !navReady && styles.navLinkDisabled]}>Community</Text>
          </Pressable>
          <Pressable onPress={() => onNav('Signup')} hitSlop={8} disabled={!navReady}>
            <Text style={[styles.navLink, !navReady && styles.navLinkDisabled]}>Join Beta</Text>
          </Pressable>
        </View>
        <Pressable onPress={() => onNav('Signup')} style={styles.primaryCta} hitSlop={8} disabled={!navReady}>
          <Text style={styles.primaryCtaText}>Join the Beta Waitlist</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function Index() {
  const scrollRef = useRef<ScrollView>(null);
  const nameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const [sectionYs, setSectionYs] = useState<Record<string, number>>({});
  const [width, setWidth] = useState(Dimensions.get('window').width);
  const utm = useUTM();

  const isMobile = width < 768;
  const isMobileSmall = width <= 390;

  const targetIds: (keyof typeof SECTION_IDS)[] = ['Problem', 'Solution', 'WhoFor', 'Community', 'Signup'];
  const navReady = Platform.OS === 'web' ? true : targetIds.every((id) => sectionYs[id] != null);

  const { control, handleSubmit, reset, formState, setValue, trigger, formState: { errors, isValid } } = useForm<WaitlistForm>({
    defaultValues: { name: '', email: '', role: undefined, hp: '' },
    mode: 'onTouched',
    reValidateMode: 'onChange',
    criteriaMode: 'all',
  }) as any;

  useEffect(() => {
    const r = (utm.prefill_role || '').toLowerCase();
    const map: Record<string, any> = { enthusiast: 'Enthusiast', builder: 'Builder', shop: 'Shop', brand: 'Brand' };
    if (map[r]) setValue('role', map[r]);
  }, [utm.prefill_role, setValue]);

  useEffect(() => {
    const sub = Dimensions.addEventListener('change', () => {
      setWidth(Dimensions.get('window').width);
      setSectionYs({});
      setTimeout(() => {}, 250);
    });
    return () => {
      // @ts-ignore
      sub?.remove?.();
    };
  }, []);

  const onLayoutSection = (id: string, y: number) => {
    setSectionYs((prev) => ({ ...prev, [id]: y }));
  };

  const onNav = (id: keyof typeof SECTION_IDS) => {
    if (Platform.OS === 'web') {
      const el = document.getElementById(id);
      if (el) {
        const top = (el as any).getBoundingClientRect().top + window.scrollY - 88;
        window.scrollTo({ top, behavior: 'smooth' });
      }
      return;
    }
    const y = sectionYs[id];
    if (y == null) {
      setTimeout(() => {
        const y2 = sectionYs[id];
        if (y2 != null) scrollRef.current?.scrollTo({ y: Math.max(0, y2 - 88), animated: true });
      }, 250);
      return;
    }
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 88), animated: true });
  };

  const onTop = () => {
    if (Platform.OS === 'web') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }
  };

  const [menuVisible, setMenuVisible] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [thankYou, setThankYou] = useState(false);
  const [successModal, setSuccessModal] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const submitWaitlist = async (values: WaitlistForm) => {
    if ((values.hp || '').trim().length > 0) {
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
          source_url: utm.source_url,
          utm_source: utm.utm_source,
          utm_campaign: utm.utm_campaign,
          utm_medium: utm.utm_medium,
        }),
      });
      if (!res.ok) {
        showToast("Couldn’t submit right now. Please try again.");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }
      setThankYou(true);
      setSuccessModal(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      trackWaitlistSubmit({
        role: values.role,
        utm_source: utm.utm_source || null,
        utm_campaign: utm.utm_campaign || null,
        utm_medium: utm.utm_medium || null,
      });
      trackWaitlistSuccessModalShown();
      reset();
    } catch (e) {
      console.error(e);
      showToast("Couldn’t submit right now. Please try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSubmitting(false);
    }
  };

  const onPressJoin = async () => {
    const ok = await trigger();
    if (!ok) {
      onNav('Signup');
      if (errors?.name) {
        nameRef.current?.focus();
      } else if (errors?.email) {
        emailRef.current?.focus();
      }
      showToast('Please correct highlighted fields.');
      return;
    }
    await handleSubmit(submitWaitlist)();
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
          source_url: utm.source_url,
          utm_source: utm.utm_source,
          utm_campaign: utm.utm_campaign,
          utm_medium: utm.utm_medium,
        }),
      });
      trackWaitlistSubmit({ role: 'Subscriber', utm_source: utm.utm_source || null, utm_campaign: utm.utm_campaign || null, utm_medium: utm.utm_medium || null });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {
      console.error(e);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const heroColumns = !isMobile;
  const heroTitleSize = isMobile ? 36 : 58;
  const h2Size = isMobile ? 26 : 34;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <Header onNav={onNav} navReady={navReady} onTop={onTop} isMobileSmall={isMobileSmall} onOpenMenu={() => setMenuVisible(true)} />

        {/* Toast */}
        {toast ? (
          <View style={styles.toast}>
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        ) : null}

        <ScrollView
          ref={scrollRef}
          style={{ flex: 1, backgroundColor: '#000' }}
          contentContainerStyle={{ paddingTop: isMobile ? 72 : 96 }}
          onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.containerWrap}>
            {/* Hero */}
            <Animated.View
              entering={FadeInUp.duration(500).delay(50)}
              nativeID={SECTION_IDS.Hero}
              onLayout={(e) => onLayoutSection(SECTION_IDS.Hero, e.nativeEvent.layout.y)}
              style={[styles.section, isMobile && styles.sectionMobile]}
            >
              <View style={{ flexDirection: heroColumns ? 'row' : 'column', gap: 16, alignItems: 'flex-start' }}>
                <View style={{ flex: heroColumns ? 11 : undefined }}>
                  <Text style={[styles.heroTitle, { fontSize: heroTitleSize, lineHeight: heroTitleSize * 1.1, marginBottom: isMobile ? 12 : 8 }]}>
                    The social marketplace for automotive builds.
                  </Text>
                  <Text style={[styles.heroSubtitle, { marginBottom: isMobile ? 16 : 12 }]}>
                    Document your build. Tag every part. Connect with shops and brands.
                  </Text>
                  <View style={[styles.row, { flexWrap: 'wrap', gap: 12, marginTop: isMobile ? 8 : 8, flexDirection: isMobile ? 'column' : 'row' }]}>
                    <Pressable onPress={() => onNav('Signup')} style={[styles.primaryCtaLg, isMobile && { width: '100%' }]} accessibilityLabel="Join the Beta Waitlist">
                      <Text style={styles.primaryCtaText}>Join the Beta Waitlist</Text>
                    </Pressable>
                    <Pressable onPress={() => router.push('/refer')} style={[styles.secondaryCtaLg, isMobile && { width: '100%' }]} accessibilityLabel="Refer a Shop or Builder">
                      <Text style={styles.secondaryCtaText}>Refer a Shop or Builder</Text>
                    </Pressable>
                  </View>
                  {/* Extra breathing room before media on mobile */}
                  {isMobile ? <View style={{ height: 16 }} /> : null}
                </View>
                <View style={{ flex: heroColumns ? 9 : undefined, width: '100%' }}>
                  <View style={styles.heroMedia}>
                    <Text style={styles.mediaText}>Hero image / looping video placeholder</Text>
                  </View>
                </View>
              </View>
            </Animated.View>

            {/* Problem (two-column on desktop) */}
            <Animated.View entering={FadeIn.duration(600).delay(100)} nativeID={SECTION_IDS.Problem} onLayout={(e) => onLayoutSection(SECTION_IDS.Problem, e.nativeEvent.layout.y)} style={[styles.section, isMobile && styles.sectionMobile]}>
              <View style={{ flexDirection: heroColumns ? 'row' : 'column', gap: 16 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.h2, { fontSize: h2Size }]}>Car culture is scattered. Buildboard organizes it.</Text>
                  <View style={styles.bullets}>
                    <Text style={styles.bullet}>• Finding parts from a build = endless scrolling.</Text>
                    <Text style={styles.bullet}>• Builders/shops get attention, not tools to grow.</Text>
                    <Text style={styles.bullet}>• Brands can’t see where parts end up (no attribution).</Text>
                  </View>
                </View>
                {!isMobile && (
                  <View style={[styles.heroMedia, { flex: 1, height: 220 }]}>
                    <Text style={styles.mediaText}>Visual placeholder</Text>
                  </View>
                )}
              </View>
            </Animated.View>

            {/* Solution (two-column on desktop) */}
            <Animated.View entering={FadeInRight.duration(600).delay(150)} nativeID={SECTION_IDS.Solution} onLayout={(e) => onLayoutSection(SECTION_IDS.Solution, e.nativeEvent.layout.y)} style={[styles.section, isMobile && styles.sectionMobile]}>
              <View style={{ flexDirection: heroColumns ? 'row' : 'column', gap: 16 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.h2, { fontSize: h2Size }]}>Every build has a story. Buildboard makes it searchable, shoppable, and shareable.</Text>
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
                {!isMobile && (
                  <View style={[styles.heroMedia, { flex: 1, height: 260 }]}>
                    <Text style={styles.mediaText}>Feature visual</Text>
                  </View>
                )}
              </View>
            </Animated.View>

            {/* Product */}
            <Animated.View entering={FadeIn.duration(600).delay(200)} nativeID={SECTION_IDS.Product} onLayout={(e) => onLayoutSection(SECTION_IDS.Product, e.nativeEvent.layout.y)} style={[styles.section, isMobile && styles.sectionMobile]}>
              <Text style={[styles.h2, { fontSize: h2Size }]}>Your build. Your story. Your credit.</Text>
              <View style={styles.bullets}>
                {['Profile pages', 'Build pages', 'Tagged parts', 'Clean interface'].map((b) => (
                  <Text key={b} style={styles.bullet}>• {b}</Text>
                ))}
              </View>
              <View style={styles.mockup}>
                <Text style={styles.mediaText}>Product mockup placeholder</Text>
              </View>
            </Animated.View>

            {/* Who It's For */}
            <Animated.View entering={FadeInUp.duration(600).delay(250)} nativeID={SECTION_IDS.WhoFor} onLayout={(e) => onLayoutSection(SECTION_IDS.WhoFor, e.nativeEvent.layout.y)} style={[styles.section, isMobile && styles.sectionMobile]}>
              <Text style={[styles.h2, { fontSize: h2Size }]}>Built for everyone in car culture.</Text>
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
            </Animated.View>

            {/* Community */}
            <Animated.View entering={FadeInRight.duration(600).delay(300)} nativeID={SECTION_IDS.Community} onLayout={(e) => onLayoutSection(SECTION_IDS.Community, e.nativeEvent.layout.y)} style={[styles.section, isMobile && styles.sectionMobile]}>
              <Text style={[styles.h2, { fontSize: h2Size }]}>Built by the community, for the community.</Text>
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
            </Animated.View>

            {/* Signup */}
            <Animated.View entering={FadeIn.duration(600).delay(350)} nativeID={SECTION_IDS.Signup} onLayout={(e) => onLayoutSection(SECTION_IDS.Signup, e.nativeEvent.layout.y)} style={[styles.section, isMobile && styles.sectionMobile]}
            >
              <Text style={[styles.h2, { fontSize: h2Size, marginBottom: isMobile ? 8 : 8 }]}>Be first to the line.</Text>
              <Text style={[styles.subhead, { marginBottom: isMobile ? 12 : 12 }]}>Join the beta waitlist and help shape the future of car culture.</Text>

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
                      ref={nameRef}
                      value={value}
                      onChangeText={onChange}
                      placeholder="Your name"
                      placeholderTextColor="#666"
                      style={styles.input}
                      onSubmitEditing={Keyboard.dismiss}
                    />
                  )}
                />
                {errors?.name ? <Text style={styles.error}>Name is required.</Text> : null}

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
                      ref={emailRef}
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
                <Text style={styles.smallNote}>No spam. We’ll only email about the beta.</Text>
                {errors?.email ? <Text style={styles.error}>Valid email required.</Text> : null}

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
                          accessibilityLabel={`Select role ${r}`}
                        >
                          <Text style={styles.selectOptionText}>{r}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                />
                {errors?.role ? <Text style={styles.error}>Role is required.</Text> : null}

                <Pressable onPress={onPressJoin} style={[styles.primaryCta, { marginTop: 16, opacity: isValid && !submitting ? 1 : 0.5 }, isMobile && { width: '100%', alignSelf: 'stretch', minHeight: 48 }]} disabled={!isValid || submitting}>
                  {submitting ? <ActivityIndicator color="#000" /> : <Text style={styles.primaryCtaText}>Join the Beta Waitlist</Text>}
                </Pressable>
                <Text style={styles.privacy}>By joining, you agree to occasional updates. Unsubscribe anytime.</Text>
              </View>
            </Animated.View>

            {/* Footer */}
            <Animated.View entering={FadeInUp.duration(600).delay(400)} nativeID={SECTION_IDS.Footer} onLayout={(e) => onLayoutSection(SECTION_IDS.Footer, e.nativeEvent.layout.y)} style={[styles.section, styles.footer, isMobile && styles.sectionMobile]}>
              <Text style={styles.footerTagline}>Every car has a story. Every part has a source. Every builder gets credit.</Text>
              <View style={[styles.footerRow, { flexDirection: isMobile ? 'column' : 'row' }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Stay in the loop</Text>
                  <FooterEmail onSubmit={submitFooterEmail} isMobile={isMobile} />
                </View>
                <View style={{ flex: 1, gap: 8 }}>
                  <Pressable onPress={() => {}} hitSlop={8}>
                    <Text style={styles.link}>About</Text>
                  </Pressable>
                  <Pressable onPress={() => LinkingExpo.openURL('mailto:team@buildboard.app')} hitSlop={8}>
                    <Text style={styles.link}>Contact</Text>
                  </Pressable>
                  <Pressable onPress={() => openInstagram('footer')} hitSlop={8}>
                    <Text style={styles.link}>Instagram @thebuildboard</Text>
                  </Pressable>
                </View>
              </View>
              <Text style={styles.copy}>© Buildboard 2025</Text>
            </Animated.View>
          </View>
        </ScrollView>

        {/* Mobile Menu Sheet */}
        <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
          <Pressable style={styles.menuBackdrop} accessibilityLabel="Close menu" onPress={() => setMenuVisible(false)} />
          <View style={styles.menuSheet}>
            <Text style={styles.menuTitle}>Menu</Text>
            {(['Problem','Solution','WhoFor','Community','Signup'] as (keyof typeof SECTION_IDS)[]).map((id) => (
              <Pressable key={id} onPress={() => { setMenuVisible(false); onNav(id); }} style={styles.menuItem} accessibilityLabel={`Go to ${id}`}>
                <Text style={styles.menuItemText}>{id === 'WhoFor' ? 'Who It’s For' : id === 'Signup' ? 'Join Beta' : id}</Text>
              </Pressable>
            ))}
          </View>
        </Modal>

        {/* Success Modal */}
        <Modal visible={successModal} transparent animationType="fade" onRequestClose={() => setSuccessModal(false)}>
          <View style={styles.modalBackdrop} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>You’re on the list.</Text>
            <Text style={styles.modalBody}>We’ll email beta details soon. Follow along @thebuildboard.</Text>
            <View style={{ gap: 12, width: '100%' }}>
              <Pressable onPress={() => { setSuccessModal(false); onTop(); }} style={[styles.primaryCta, { width: '100%', minHeight: 48 }]} accessibilityLabel="Back to Home">
                <Text style={styles.primaryCtaText}>Back to Home</Text>
              </Pressable>
              <Pressable onPress={() => { setSuccessModal(false); router.push('/refer'); }} style={[styles.secondaryCtaLg, { width: '100%', minHeight: 48 }]} accessibilityLabel="Refer a Shop or Builder">
                <Text style={styles.secondaryCtaText}>Refer a Shop or Builder</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FooterEmail({ onSubmit, isMobile }: { onSubmit: (email: string) => void; isMobile: boolean }) {
  const [email, setEmail] = useState('');
  if (isMobile) {
    return (
      <View style={{ gap: 8, marginTop: 8 }}>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor="#666"
          keyboardType="email-address"
          autoCapitalize="none"
          style={[styles.input, { minHeight: 48 }]}
        />
        <Pressable onPress={() => onSubmit(email)} style={[styles.primaryCta, { width: '100%', alignSelf: 'stretch', minHeight: 48 }]} accessibilityLabel="Join the Beta Waitlist">
          <Text style={styles.primaryCtaText}>Join the Beta Waitlist</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <View style={styles.footerEmailRow}>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        placeholderTextColor="#666"
        keyboardType="email-address"
        autoCapitalize="none"
        style={[styles.input, { flex: 1, minHeight: 44 }]} />
      <Pressable onPress={() => onSubmit(email)} style={[styles.primaryCta, { marginLeft: 8, minHeight: 44 }]} accessibilityLabel="Join the Beta Waitlist">
        <Text style={styles.primaryCtaText}>Join the Beta Waitlist</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  containerWrap: { width: '100%', maxWidth: 1140, alignSelf: 'center', paddingHorizontal: 24 },
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
    minHeight: 72,
  },
  headerMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    minHeight: 88,
  },
  logo: { color: '#fff', fontSize: 20, fontWeight: '600' },
  nav: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
  navLink: { color: '#fff', paddingVertical: 8, paddingHorizontal: 4 },
  navLinkDisabled: { color: '#666' },
  primaryCta: { backgroundColor: '#fff', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 8, minHeight: 44, justifyContent: 'center' },
  headerBtn: { paddingVertical: 12, paddingHorizontal: 16 },
  primaryCtaLg: { backgroundColor: '#fff', paddingVertical: 16, paddingHorizontal: 18, borderRadius: 8, minHeight: 48, justifyContent: 'center' },
  primaryCtaText: { color: '#000', fontWeight: '700' },
  secondaryCtaLg: { borderWidth: 1, borderColor: '#fff', paddingVertical: 16, paddingHorizontal: 18, borderRadius: 8, minHeight: 48, justifyContent: 'center' },
  secondaryCtaText: { color: '#fff', fontWeight: '600' },

  hamburger: { borderWidth: 1, borderColor: '#fff', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12 },
  hamburgerText: { color: '#fff', fontSize: 18 },

  section: { paddingHorizontal: 16, paddingVertical: 40, gap: 16 },
  sectionMobile: { paddingVertical: 24 },
  row: { flexDirection: 'row', alignItems: 'center' },
  heroTitle: { color: '#fff', fontWeight: '800' },
  heroSubtitle: { color: '#ccc', fontSize: 18 },
  heroMedia: { height: 260, borderWidth: 1, borderColor: '#333', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  mediaText: { color: '#666' },

  h2: { color: '#fff', fontWeight: '700' },
  h3: { color: '#fff', fontSize: 18, fontWeight: '700' },
  subhead: { color: '#ccc', fontSize: 16 },
  bullets: { gap: 8 },
  bullet: { color: '#ccc', fontSize: 16 },

  grid: { gap: 12 },
  gridRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { borderWidth: 1, borderColor: '#222', borderRadius: 12, padding: 16, backgroundColor: '#0a0a0a' },
  cardTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 4 },
  cardDesc: { color: '#ccc', fontSize: 16 },

  mockup: { height: 220, borderWidth: 1, borderColor: '#333', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  form: { gap: 8 },
  label: { color: '#fff', marginTop: 8 },
  input: { backgroundColor: '#111', color: '#fff', borderWidth: 1, borderColor: '#333', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 12, minHeight: 44 },
  select: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  selectOption: { paddingVertical: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: '#333', borderRadius: 8, minHeight: 44, justifyContent: 'center' },
  selectOptionActive: { backgroundColor: '#fff' },
  selectOptionText: { color: '#fff' },
  smallNote: { color: '#777', marginTop: 4 },
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

  // Toast
  toast: { position: 'absolute', top: 88, left: 0, right: 0, paddingVertical: 10, paddingHorizontal: 16, backgroundColor: '#222', alignItems: 'center', zIndex: 200 },
  toastText: { color: '#fff' },

  // Menu
  menuBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' },
  menuSheet: { position: 'absolute', right: 12, top: 88, backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#333', borderRadius: 12, padding: 12, width: 260, gap: 8 },
  menuTitle: { color: '#fff', fontWeight: '700', marginBottom: 4 },
  menuItem: { paddingVertical: 10, paddingHorizontal: 8, borderRadius: 8 },
  menuItemText: { color: '#fff' },

  // Modal
  modalBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)' },
  modalCard: { position: 'absolute', top: '30%', left: 24, right: 24, backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#333', borderRadius: 16, padding: 20, alignItems: 'center', gap: 12 },
  modalTitle: { color: '#fff', fontSize: 22, fontWeight: '800', textAlign: 'center' },
  modalBody: { color: '#ccc', textAlign: 'center' },
});