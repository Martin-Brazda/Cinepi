import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../../src/context/AuthContext';

export default function SettingsScreen() {
  const { token, userId, profiles, profileId, setProfileId, login, logout, refreshProfiles } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [registerMode, setRegisterMode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Settings</Text>
      {!token ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{registerMode ? 'Create account' : 'Sign in'}</Text>
          <TextInput value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor="#737373" style={styles.input} />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor="#737373"
            secureTextEntry
            style={styles.input}
          />
          {!!error && <Text style={styles.error}>{error}</Text>}
          <Pressable
            style={styles.button}
            onPress={async () => {
              try {
                setError(null);
                await login(email, password, registerMode);
                await refreshProfiles();
              } catch (e) {
                setError((e as Error).message || 'Authentication failed');
              }
            }}
          >
            <Text style={styles.buttonText}>{registerMode ? 'Register' : 'Login'}</Text>
          </Pressable>
          <Pressable onPress={() => setRegisterMode((x) => !x)}>
            <Text style={styles.link}>{registerMode ? 'Have an account? Sign in' : 'Need an account? Register'}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Signed In</Text>
          <Text style={styles.meta}>User ID: {userId}</Text>
          <Text style={styles.meta}>Profiles:</Text>
          {profiles.map((profile) => (
            <Pressable key={profile.id} style={styles.profile} onPress={() => setProfileId(profile.id)}>
              <Text style={styles.profileTxt}>
                {profile.name} {profileId === profile.id ? '(selected)' : ''}
              </Text>
            </Pressable>
          ))}
          <Pressable style={styles.button} onPress={async () => logout()}>
            <Text style={styles.buttonText}>Logout</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#080808' },
  content: { padding: 16 },
  title: { color: 'white', fontSize: 26, fontWeight: '700', marginBottom: 12 },
  card: { borderWidth: 1, borderColor: '#262626', borderRadius: 12, backgroundColor: '#101010', padding: 12 },
  cardTitle: { color: 'white', fontSize: 16, fontWeight: '700', marginBottom: 10 },
  input: {
    borderWidth: 1,
    borderColor: '#2e2e2e',
    borderRadius: 8,
    color: 'white',
    backgroundColor: '#171717',
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginBottom: 10,
  },
  button: { backgroundColor: '#ef4444', borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginTop: 4 },
  buttonText: { color: 'white', fontWeight: '700' },
  link: { color: '#93c5fd', marginTop: 10, fontSize: 12 },
  error: { color: '#f87171', marginBottom: 8 },
  meta: { color: '#a1a1aa', marginBottom: 8 },
  profile: { borderWidth: 1, borderColor: '#333', borderRadius: 8, padding: 10, marginBottom: 8, backgroundColor: '#181818' },
  profileTxt: { color: '#e5e7eb' },
});
