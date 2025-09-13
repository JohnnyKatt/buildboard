import React, { useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import * as LinkingExpo from 'expo-linking';
import { router } from 'expo-router';
import { trackReferralSubmit } from '../src/utils/analytics';

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

type ReferralForm = {
  referrer_name: string;
  referrer_email: string;
  referral_type: 'Shop' | 'Builder' | undefined;
  referral_name: string;
  referral_contact?: string;
  notes?: string;
  hp?: string;
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

export default function Refer() {
  const { control, handleSubmit, reset, formState } = useForm<ReferralForm>({
    defaultValues: {
      referrer_name: '',
      referrer_email: '',
      referral_type: undefined,
      referral_name: '',
      referral_contact: '',
      notes: '',
      hp: '',
    },
    mode: 'onTouched',
  });
  const utm = useUTM();
  const [submitting, setSubmitting] = useState(false);
  const [thanks, setThanks] = useState(false);

  const submit = async (values: ReferralForm) => {
    if ((values.hp || '').trim().length > 0) return; // honeypot
    setSubmitting(true);
    try {
      const res = await fetch(`${BASE_URL}/api/referrals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...utm,
          referrer_name: values.referrer_name.trim(),
          referrer_email: values.referrer_email.trim(),
          referral_type: values.referral_type,
          referral_name: values.referral_name.trim(),
          referral_contact: values.referral_contact?.trim() || undefined,
          notes: values.notes?.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      setThanks(true);
      // analytics
      trackReferralSubmit({ referral_type: values.referral_type, utm_source: utm.utm_source || null, utm_campaign: utm.utm_campaign || null, utm_medium: utm.utm_medium || null });
      reset();
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.logo}>Buildboard</Text>
          <Text style={styles.h2}>Refer a Shop or Builder</Text>

          {thanks ? (
            <View style={styles.thanksBox}>
              <Text style={styles.h3}>Thanks—your referral was submitted. We’ll reach out and keep you posted.</Text>
              <Pressable onPress={() => router.replace('/')} style={styles.primaryCta} hitSlop={8}>
                <Text style={styles.primaryCtaText}>Back to Home</Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {/* honeypot */}
              <Controller control={control} name="hp" render={({ field: { onChange, value } }) => (
                <TextInput value={value} onChangeText={onChange} style={styles.honeypot} accessibilityElementsHidden accessibilityLabel="Do not fill" />
              )} />

              <Text style={styles.label}>Your Name</Text>
              <Controller
                control={control}
                name="referrer_name"
                rules={{ required: true, minLength: 2 }}
                render={({ field: { onChange, value } }) => (
                  <TextInput value={value} onChangeText={onChange} placeholder="Your name" placeholderTextColor="#666" style={styles.input} />
                )}
              />
              {formState.errors.referrer_name ? <Text style={styles.error}>Name is required.</Text> : null}

              <Text style={styles.label}>Your Email</Text>
              <Controller
                control={control}
                name="referrer_email"
                rules={{ required: true, pattern: /[^\s@]+@[^\s@]+\.[^\s@]+/ }}
                render={({ field: { onChange, value } }) => (
                  <TextInput value={value} onChangeText={onChange} placeholder="you@example.com" placeholderTextColor="#666" style={styles.input} autoCapitalize="none" keyboardType="email-address" />
                )}
              />
              <Text style={styles.smallNote}>No spam. We’ll only email about the beta.</Text>
              {formState.errors.referrer_email ? <Text style={styles.error}>Valid email required.</Text> : null}

              <Text style={styles.label}>Referral Type</Text>
              <Controller
                control={control}
                name="referral_type"
                rules={{ required: true }}
                render={({ field: { onChange, value } }) => (
                  <View style={styles.select}>
                    {['Shop', 'Builder'].map((r) => (
                      <Pressable key={r} onPress={() => onChange(r as any)} style={[styles.selectOption, value === r && styles.selectOptionActive]}>
                        <Text style={styles.selectOptionText}>{r}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              />
              {formState.errors.referral_type ? <Text style={styles.error}>Type is required.</Text> : null}

              <Text style={styles.label}>Referral Name</Text>
              <Controller
                control={control}
                name="referral_name"
                rules={{ required: true, minLength: 2 }}
                render={({ field: { onChange, value } }) => (
                  <TextInput value={value} onChangeText={onChange} placeholder="Shop/Builder name" placeholderTextColor="#666" style={styles.input} />
                )}
              />
              {formState.errors.referral_name ? <Text style={styles.error}>Referral name is required.</Text> : null}

              <Text style={styles.label}>Instagram / Website (optional)</Text>
              <Controller control={control} name="referral_contact" render={({ field: { onChange, value } }) => (
                <TextInput value={value} onChangeText={onChange} placeholder="@handle or https://" placeholderTextColor="#666" style={styles.input} />
              )} />

              <Text style={styles.label}>Notes (optional)</Text>
              <Controller control={control} name="notes" render={({ field: { onChange, value } }) => (
                <TextInput value={value} onChangeText={onChange} placeholder="Anything we should know" placeholderTextColor="#666" style={[styles.input, { height: 100, textAlignVertical: 'top' }]} multiline />
              )} />

              <Pressable onPress={handleSubmit(submit)} style={[styles.primaryCta, { marginTop: 16 }]} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#000" /> : <Text style={styles.primaryCtaText}>Submit</Text>}
              </Pressable>
              <Text style={styles.privacy}>By joining, you agree to occasional updates. Unsubscribe anytime.</Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  logo: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 12 },
  h2: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 8 },
  h3: { color: '#fff', fontSize: 18, fontWeight: '700' },
  label: { color: '#fff', marginTop: 8 },
  input: { backgroundColor: '#111', color: '#fff', borderWidth: 1, borderColor: '#333', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 12 },
  select: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  selectOption: { paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: '#333', borderRadius: 8 },
  selectOptionActive: { backgroundColor: '#fff' },
  selectOptionText: { color: '#fff' },
  primaryCta: { backgroundColor: '#fff', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, alignSelf: 'flex-start' },
  primaryCtaText: { color: '#000', fontWeight: '700' },
  smallNote: { color: '#777', marginTop: 4 },
  error: { color: '#ff6b6b' },
  privacy: { color: '#777', marginTop: 8 },
  thanksBox: { borderWidth: 1, borderColor: '#333', padding: 16, borderRadius: 12, gap: 12 },
  honeypot: { height: 0, width: 0, opacity: 0 },
});