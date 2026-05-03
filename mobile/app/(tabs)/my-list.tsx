import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ShowCard } from '../../src/components/ShowCard';
import { useAuth } from '../../src/context/AuthContext';
import { apiFetch } from '../../src/lib/api';
import { Show } from '../../src/types';

export default function MyListScreen() {
  const { token, profileId } = useAuth();
  const [myList, setMyList] = useState<Show[]>([]);
  const [continueRows, setContinueRows] = useState<Show[]>([]);
  const [recommendations, setRecommendations] = useState<Show[]>([]);

  const loadData = () => {
    if (!token || !profileId) return;
    apiFetch(`/profiles/${profileId}/my-list`, token).then(async (res) => {
      if (res.ok) setMyList(await res.json());
    });
    apiFetch(`/profiles/${profileId}/continue-watching`, token).then(async (res) => {
      if (!res.ok) return;
      const data = await res.json();
      setContinueRows(Array.isArray(data) ? data.map((r: any) => r.show).filter(Boolean) : []);
    });
    apiFetch(`/profiles/${profileId}/recommendations`, token).then(async (res) => {
      if (res.ok) setRecommendations(await res.json());
    });
  };

  useEffect(() => {
    loadData();
  }, [token, profileId]);

  if (!token || !profileId) {
    return (
      <View style={styles.page}>
        <Text style={styles.emptyText}>Sign in and choose a profile in Settings to view My List.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Pressable
        style={styles.refreshBtn}
        onPress={async () => {
          await apiFetch(`/profiles/${profileId}/recommendations/refresh`, token, { method: 'POST' });
          setTimeout(loadData, 800);
        }}
      >
        <Text style={styles.refreshTxt}>Refresh Recommendations</Text>
      </Pressable>

      <Section title="My List" rows={myList} />
      <Section title="Continue Watching" rows={continueRows} />
      <Section title="Recommended For You" rows={recommendations} />
    </ScrollView>
  );
}

function Section({ title, rows }: { title: string; rows: Show[] }) {
  return (
    <View>
      <Text style={styles.sectionTitle}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {rows.map((show) => (
          <ShowCard key={`${title}-${show.id}`} show={show} />
        ))}
      </ScrollView>
      {rows.length === 0 && <Text style={styles.emptyText}>No titles yet.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#080808' },
  content: { padding: 16, gap: 12, paddingBottom: 24 },
  refreshBtn: { alignSelf: 'flex-start', backgroundColor: '#1f2937', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  refreshTxt: { color: '#e5e7eb', fontWeight: '600', fontSize: 12 },
  sectionTitle: { color: '#e5e7eb', fontWeight: '700', fontSize: 13, marginBottom: 8, marginTop: 6 },
  emptyText: { color: '#a1a1aa', fontSize: 12, marginTop: 8 },
});
