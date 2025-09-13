import React, { useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, TextInput, Pressable, StyleSheet, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

export default function Admin() {
  const [key, setKey] = useState('');
  const [type, setType] = useState<'waitlist' | 'referrals'>('waitlist');
  const [start, setStart] = useState(''); // YYYY-MM-DD
  const [end, setEnd] = useState('');
  const url = useMemo(() => {
    const params = new URLSearchParams();
    if (start) params.set('start_date', start);
    if (end) params.set('end_date', end);
    if (key) params.set('key', key);
    const path = type === 'waitlist' ? '/api/admin/export/waitlist' : '/api/admin/export/referrals';
    return `${BASE_URL}${path}?${params.toString()}`;
  }, [key, type, start, end]);

  const download = async () => {
    if (!key) {
      alert('Enter Admin Key');
      return;
    }
    if (Platform.OS === 'web') {
      try {
        const res = await fetch(url, { headers: { 'x-admin-key': key } });
        if (!res.ok) throw new Error('Download failed');
        const blob = await res.blob();
        const link = document.createElement('a');
        const dlUrl = window.URL.createObjectURL(blob);
        link.href = dlUrl;
        const now = new Date();
        link.download = `${type}_${start || 'all'}_${end || 'all'}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(dlUrl);
      } catch (e) {
        console.error(e);
        alert('Download failed');
      }
    } else {
      await WebBrowser.openBrowserAsync(url);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
      <View style={styles.container}>
        <Text style={styles.title}>Admin CSV Export</Text>
        <Text style={styles.label}>Admin Key</Text>
        <TextInput value={key} onChangeText={setKey} placeholder="Enter key" placeholderTextColor="#666" style={styles.input} secureTextEntry />

        <Text style={styles.label}>Dataset</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['waitlist', 'referrals'] as const).map((d) => (
            <Pressable key={d} onPress={() => setType(d)} style={[styles.chip, type === d && styles.chipActive]}>
              <Text style={styles.chipText}>{d}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Start Date (YYYY-MM-DD)</Text>
        <TextInput value={start} onChangeText={setStart} placeholder="2025-07-01" placeholderTextColor="#666" style={styles.input} />
        <Text style={styles.label}>End Date (YYYY-MM-DD)</Text>
        <TextInput value={end} onChangeText={setEnd} placeholder="2025-07-31" placeholderTextColor="#666" style={styles.input} />

        <Pressable onPress={download} style={styles.primaryCta}>
          <Text style={styles.primaryCtaText}>Download CSV</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 8 },
  title: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 8 },
  label: { color: '#fff', marginTop: 8 },
  input: { backgroundColor: '#111', color: '#fff', borderWidth: 1, borderColor: '#333', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 12 },
  primaryCta: { backgroundColor: '#fff', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 8, marginTop: 16, alignSelf: 'flex-start' },
  primaryCtaText: { color: '#000', fontWeight: '700' },
  chip: { paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: '#333', borderRadius: 8 },
  chipActive: { backgroundColor: '#fff' },
  chipText: { color: '#fff' },
});