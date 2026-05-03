import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { API_BASE } from '../../src/config';
import { ShowCard } from '../../src/components/ShowCard';
import { Show } from '../../src/types';

const PAGE_SIZE = 30;

export default function BrowseScreen() {
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<Show[]>([]);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/shows?genre=All&limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`)
      .then((res) => res.json())
      .then((data) => {
        const next = Array.isArray(data) ? data : [];
        setRows(next);
        setHasMore(next.length === PAGE_SIZE);
      })
      .catch(() => undefined);
  }, [page]);

  return (
    <View style={styles.page}>
      <Text style={styles.title}>Browse</Text>
      <View style={styles.pager}>
        <Pressable style={styles.button} disabled={page === 0} onPress={() => setPage((p) => Math.max(0, p - 1))}>
          <Text style={styles.buttonText}>Prev</Text>
        </Pressable>
        <Text style={styles.meta}>Page {page + 1}</Text>
        <Pressable style={styles.button} disabled={!hasMore} onPress={() => setPage((p) => p + 1)}>
          <Text style={styles.buttonText}>Next</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.results}>
        {rows.map((show) => (
          <ShowCard key={show.id} show={show} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#080808', padding: 16 },
  title: { color: 'white', fontSize: 26, fontWeight: '700', marginBottom: 10 },
  pager: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  button: { backgroundColor: '#1f2937', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  buttonText: { color: '#e5e7eb', fontSize: 12, fontWeight: '600' },
  meta: { color: '#a1a1aa', fontSize: 12 },
  results: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: 16 },
});
