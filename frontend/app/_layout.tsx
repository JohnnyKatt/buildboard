import React from 'react';
import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, gestureEnabled: true }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="refer" />
      <Stack.Screen name="admin" />
      <Stack.Screen name="go/launch" />
    </Stack>
  );
}