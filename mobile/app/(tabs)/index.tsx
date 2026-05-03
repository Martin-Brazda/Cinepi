import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { API_BASE } from '../../src/config';
import { ShowCard } from '../../src/components/ShowCard';
import { useAuth } from '../../src/context/AuthContext';
import { apiFetch } from '../../src/lib/api';
import { Show } from '../../src/types';

export default function HomeScreen() {
  const { token, profileId } = useAuth();
  const [shows, setShows] = useState<Show[]>([]);
  const [recommendations, setRecommendations] = useState<Show[]>([]);
  const [continueRows, setContinueRows] = useState<Show[]>([]);

  useEffect(() => {
    fetch(`${API_BASE}/shows?genre=All&limit=20`)
      .then((res) => res.json())
      .then((rows) => setShows(Array.isArray(rows) ? rows : []))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!token || !profileId) return;
    apiFetch(`/profiles/${profileId}/recommendations`, token).then(async (res) => {
      if (res.ok) setRecommendations(await res.json());
    });
    apiFetch(`/profiles/${profileId}/continue-watching`, token).then(async (res) => {
      if (!res.ok) return;
      const data = await res.json();
      const rows = Array.isArray(data) ? data.map((x: any) => x.show).filter(Boolean) : [];
      setContinueRows(rows);
    });
  }, [token, profileId]);

  const featured = shows[0];
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      {featured && (
        <View style={styles.hero}>
          <Text style={styles.heroKicker}>Featured</Text>
          <Text style={styles.heroTitle}>{featured.title}</Text>
          <Text style={styles.heroDescription} numberOfLines={3}>
            {featured.description}
          </Text>
        </View>
      )}
      <Text style={styles.header}>Continue Watching</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {continueRows.map((show) => (
          <ShowCard key={`continue-${show.id}`} show={show} />
        ))}
      </ScrollView>
      <Text style={styles.header}>Recommended For You</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {recommendations.map((show) => (
          <ShowCard key={`recommend-${show.id}`} show={show} />
        ))}
      </ScrollView>
      <Text style={styles.header}>Catalog</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {shows.map((show) => (
          <ShowCard key={show.id} show={show} />
        ))}
      </ScrollView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#080808' },
  content: { padding: 16, gap: 12, paddingBottom: 28 },
  hero: {
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#262626',
    borderRadius: 12,
    padding: 14,
  },
  heroKicker: { color: '#ef4444', fontSize: 12, textTransform: 'uppercase', fontWeight: '700' },
  heroTitle: { color: 'white', fontSize: 24, fontWeight: '700', marginTop: 8 },
  heroDescription: { color: '#d4d4d8', marginTop: 8 },
  header: { color: '#d4d4d8', fontWeight: '700', fontSize: 13, marginTop: 8, marginBottom: 6 },
});
