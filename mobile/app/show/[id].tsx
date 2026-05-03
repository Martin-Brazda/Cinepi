import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { API_BASE } from '../../src/config';
import { useAuth } from '../../src/context/AuthContext';
import { apiFetch } from '../../src/lib/api';
import { Episode, Show } from '../../src/types';

export default function ShowDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token, profileId } = useAuth();
  const [show, setShow] = useState<Show | null>(null);
  const [isInList, setIsInList] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`${API_BASE}/shows/${id}`)
      .then((res) => res.json())
      .then((data) => setShow(data))
      .catch(() => undefined);
  }, [id]);

  useEffect(() => {
    if (!token || !profileId || !id) return;
    apiFetch(`/profiles/${profileId}/my-list`, token)
      .then((res) => (res.ok ? res.json() : []))
      .then((rows) => setIsInList(Array.isArray(rows) && rows.some((x: Show) => x.id === id)))
      .catch(() => undefined);
  }, [token, profileId, id]);

  const toggleMyList = async () => {
    if (!show || !token || !profileId) return;
    const method = isInList ? 'DELETE' : 'POST';
    const res = await apiFetch(`/profiles/${profileId}/my-list/${show.id}`, token, { method });
    if (res.ok) setIsInList((x) => !x);
  };

  const openEpisode = (episode: Episode) => {
    if (!episode.scrape_url) return;
    router.push({
      pathname: '/player',
      params: {
        showId: show?.id,
        episodeId: String(episode.id),
        title: `${show?.title || 'Show'} - E${episode.number}`,
        scrapeUrl: episode.scrape_url,
      },
    });
  };

  if (!show) return <View style={styles.page} />;

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>Back</Text>
      </Pressable>
      <Text style={styles.title}>{show.title}</Text>
      <Text style={styles.meta}>{show.year || '-'} • {(show.categories || []).join(', ')}</Text>
      <Text style={styles.description}>{show.description}</Text>
      {!!token && !!profileId && (
        <Pressable style={styles.myListBtn} onPress={toggleMyList}>
          <Text style={styles.myListTxt}>{isInList ? 'Remove from My List' : 'Add to My List'}</Text>
        </Pressable>
      )}

      {(show.seasons || []).map((season) => (
        <View key={season.number} style={styles.season}>
          <Text style={styles.seasonTitle}>Season {season.number}</Text>
          {season.episodes.map((ep) => (
            <Pressable key={ep.id} style={styles.episode} onPress={() => openEpisode(ep)}>
              <Text style={styles.episodeTitle}>
                {ep.number}. {ep.title}
              </Text>
              <Text style={styles.duration}>{ep.duration}</Text>
            </Pressable>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#080808' },
  content: { padding: 16, paddingBottom: 30 },
  back: { color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  title: { color: 'white', fontSize: 28, fontWeight: '700' },
  meta: { color: '#a1a1aa', marginTop: 8 },
  description: { color: '#d4d4d8', marginTop: 8, marginBottom: 12, lineHeight: 20 },
  myListBtn: { alignSelf: 'flex-start', backgroundColor: '#27272a', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 14 },
  myListTxt: { color: 'white', fontWeight: '600' },
  season: { marginTop: 10 },
  seasonTitle: { color: 'white', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  episode: { backgroundColor: '#121212', borderWidth: 1, borderColor: '#2d2d2d', borderRadius: 8, padding: 10, marginBottom: 8 },
  episodeTitle: { color: '#e5e7eb', fontWeight: '600' },
  duration: { color: '#9ca3af', marginTop: 4, fontSize: 12 },
});
