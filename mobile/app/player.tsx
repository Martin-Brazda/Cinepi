import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { API_BASE } from '../src/config';

export default function PlayerScreen() {
  const router = useRouter();
  const { title, scrapeUrl } = useLocalSearchParams<{ title: string; scrapeUrl: string }>();
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!scrapeUrl) return;
    setLoading(true);
    fetch(`${API_BASE}/scrape?url=${encodeURIComponent(scrapeUrl)}`)
      .then((res) => res.json())
      .then((data) => {
        const url = typeof data.m3u8 === 'string' ? data.m3u8 : Array.isArray(data.m3u8) ? data.m3u8[0] : null;
        setStreamUrl(url);
      })
      .catch(() => setStreamUrl(null))
      .finally(() => setLoading(false));
  }, [scrapeUrl]);

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>Back</Text>
      </Pressable>
      <Text style={styles.title}>{title || 'Player'}</Text>
      {loading && <ActivityIndicator color="#ef4444" size="large" style={{ marginTop: 20 }} />}
      {!loading && (
        <View style={styles.placeholder}>
          <Text style={styles.label}>Resolved stream URL</Text>
          <Text style={styles.url}>{streamUrl || 'Unable to resolve stream URL'}</Text>
          <Text style={styles.note}>
            This scaffold resolves the stream with `/scrape`; wire your preferred React Native video player next.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#080808' },
  content: { padding: 16 },
  back: { color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  title: { color: 'white', fontSize: 24, fontWeight: '700' },
  placeholder: { marginTop: 16, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#303030', backgroundColor: '#121212' },
  label: { color: '#e5e7eb', fontWeight: '700', marginBottom: 8 },
  url: { color: '#93c5fd', fontSize: 12 },
  note: { color: '#a1a1aa', marginTop: 10 },
});
