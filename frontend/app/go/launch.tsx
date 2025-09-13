import { useEffect } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';

export default function LaunchRedirect() {
  useEffect(() => {
    const qs = '?utm_source=ig&utm_campaign=launch&utm_medium=social';
    if (Platform.OS === 'web') {
      window.location.replace('/' + qs);
    } else {
      router.replace('/' + qs);
    }
  }, []);
  return null;
}