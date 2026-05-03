import { Stack } from 'expo-router';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { ProfilePicker } from '../src/components/ProfilePicker';
import { AuthProvider, useAuth } from '../src/context/AuthContext';

function RootStack() {
  const { restoreSession, refreshProfiles } = useAuth();

  useEffect(() => {
    restoreSession().catch(() => undefined);
  }, [restoreSession]);

  useEffect(() => {
    refreshProfiles().catch(() => undefined);
  }, [refreshProfiles]);

  return (
    <View style={{ flex: 1, backgroundColor: '#080808' }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="show/[id]" />
        <Stack.Screen name="player" />
      </Stack>
      <ProfilePicker />
    </View>
  );
}

export default function Layout() {
  return (
    <AuthProvider>
      <RootStack />
    </AuthProvider>
  );
}
