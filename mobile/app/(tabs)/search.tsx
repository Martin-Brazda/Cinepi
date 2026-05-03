import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { API_BASE } from '../../src/config';
import { ShowCard } from '../../src/components/ShowCard';
import { Show } from '../../src/types';

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Show[]>([]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(() => {
      fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}&scope=local`)
        .then((res) => res.json())
        .then((rows) => setResults(Array.isArray(rows) ? rows : []))
        .catch(() => undefined);
    }, 350);
    return () => clearTimeout(timeout);
  }, [query]);

  return (
    <View style={styles.page}>
      <Text style={styles.title}>Search</Text>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search titles"
        placeholderTextColor="#737373"
        style={styles.input}
        autoCapitalize="none"
      />
      <ScrollView contentContainerStyle={styles.results}>
        {results.map((show) => (
          <ShowCard key={show.id} show={show} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#080808', padding: 16 },
  title: { color: 'white', fontSize: 26, fontWeight: '700', marginBottom: 10 },
  input: {
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 10,
    color: 'white',
    backgroundColor: '#111',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  results: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
});
