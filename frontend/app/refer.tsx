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
  Modal,
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import * as LinkingExpo from 'expo-linking';
import { router } from 'expo-router';
import { trackReferralSubmit, trackReferralSuccessModalShown } from '../src/utils/analytics';
import * as Haptics from 'expo-haptics';

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
  const { control, handleSubmit, reset, formState, trigger } = useForm<ReferralForm>({
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
    reValidateMode: 'onChange',
    criteriaMode: 'all',
  });
  const utm = useUTM();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [thanks, setThanks] = useState(false);
  const [successModal, setSuccessModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const canSubmit = formState.isValid && !submitting;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const submit = async (values: ReferralForm) => {
    if ((values.hp || '').trim().length > 0) return; // honeypot
    if (values.referral_type !== 'Shop' && values.referral_type !== 'Builder') {
      setSubmitError('Please select a valid referral type.');
      return;
    }
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
      if (!res.ok) {
        let msg = 'Couldn’t submit right now. Please try again.';
        try {
          const err = await res.json();
          if (err?.detail) msg = typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail);
        } catch {}
        setSubmitError(msg);
        showToast(msg);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }
      setThanks(true);
      setSuccessModal(true);
      trackReferralSubmit({ referral_type: values.referral_type, utm_source: utm.utm_source || null, utm_campaign: utm.utm_campaign || null, utm_medium: utm.utm_medium || null });
      trackReferralSuccessModalShown();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      reset();
    } catch (e) {
      console.error(e);
      const msg = 'Couldn’t submit right now. Please try again.';
      setSubmitError(msg);
      showToast(msg);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSubmitting(false);
    }
  };

  const onBackHome = () => router.replace('/');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        {toast ? (
          <View style={styles.toast}>
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        ) : null}
        <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          <View style={styles.containerWrap}>
            <Pressable onPress={onBackHome} accessibilityLabel="Back to Home" hitSlop={8}>
              <Text style={styles.backLink}>← Back to Home</Text>
            </Pressable>
            <Text style={styles.logo}>Buildboard</Text>
            <Text style={styles.h2}>Refer a Shop or Builder</Text>

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
                      <Pressable key={r} onPress={() => onChange(r as any)} style={[styles.selectOption, value === r && styles.selectOptionActive]} accessibilityLabel={`Select referral type ${r}`}>
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

              <Pressable onPress={handleSubmit(submit)} style={[styles.primaryCta, { marginTop: 16, opacity: canSubmit ? 1 : 0.5 }]} disabled={!canSubmit} accessibilityLabel="Submit referral">
                {submitting ? <ActivityIndicator color="#000" /> : <Text style={styles.primaryCtaText}>Submit</Text>}
              </Pressable>
              {submitError ? <Text style={styles.error}>{submitError}</Text> : null}
              <Text style={styles.privacy}>By joining, you agree to occasional updates. Unsubscribe anytime.</Text>
            </View>
          </View>
        </ScrollView>

        {/* Success Modal */}
        <Modal visible={successModal} transparent animationType="fade" onRequestClose={() => setSuccessModal(false)}>
          <View style={styles.modalBackdrop} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Thanks for the referral.</Text>
            <Text style={styles.modalBody}>We’ll reach out and keep you posted.</Text>
            <View style={{ gap: 12, width: '100%' }}>
              <Pressable onPress={() => { setSuccessModal(false); router.replace('/'); }} style={[styles.primaryCta, { width: '100%', minHeight: 48 }]} accessibilityLabel="Back to Home">
                <Text style={styles.primaryCtaText}>Back to Home</Text>
              </Pressable>
              <Pressable onPress={() => { setSuccessModal(false); reset(); }} style={[styles.secondaryCta, { width: '100%', minHeight: 48 }]} accessibilityLabel="Submit another referral">
                <Text style={styles.secondaryCtaText}>Submit another referral</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  containerWrap: { width: '100%', maxWidth: 1140, alignSelf: 'center', paddingHorizontal: 24 },
  backLink: { color: '#fff', marginBottom: 8 },
  logo: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 12 },
  h2: { color: '#fff', fontSize: 26, fontWeight: '700', marginBottom: 8 },
  h3: { color: '#fff', fontSize: 18, fontWeight: '700' },
  label: { color: '#fff', marginTop: 8 },
  input: { backgroundColor: '#111', color: '#fff', borderWidth: 1, borderColor: '#333', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 12, minHeight: 44 },
  select: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  selectOption: { paddingVertical: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: '#333', borderRadius: 8, minHeight: 44, justifyContent: 'center' },
  selectOptionActive: { backgroundColor: '#fff' },
  selectOptionText: { color: '#fff' },
  primaryCta: { backgroundColor: '#fff', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 8, alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  secondaryCta: { borderWidth: 1, borderColor: '#fff', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 8, alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  primaryCtaText: { color: '#000', fontWeight: '700' },
  smallNote: { color: '#777', marginTop: 4 },
  error: { color: '#ff6b6b' },
  privacy: { color: '#777', marginTop: 8 },
  thanksBox: { borderWidth: 1, borderColor: '#333', padding: 16, borderRadius: 12, gap: 12 },
  honeypot: { height: 0, width: 0, opacity: 0 },
  // Toast
  toast: { position: 'absolute', top: 12, left: 24, right: 24, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#222', alignItems: 'center', borderRadius: 8, zIndex: 200 },
  toastText: { color: '#fff' },
  // Modal
  modalBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)' },
  modalCard: { position: 'absolute', top: '30%', left: 24, right: 24, backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#333', borderRadius: 16, padding: 20, alignItems: 'center', gap: 12 },
  modalTitle: { color: '#fff', fontSize: 22, fontWeight: '800', textAlign: 'center' },
  modalBody: { color: '#ccc', textAlign: 'center' },
});