import { useRouter } from 'expo-router';
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Show } from '../types';

export const ShowCard: React.FC<{ show: Show }> = ({ show }) => {
  const router = useRouter();
  return (
    <Pressable onPress={() => router.push(`/show/${show.id}`)} style={styles.card}>
      <Image source={{ uri: show.poster_url }} style={styles.poster} />
      <View style={styles.overlay}>
        <Text numberOfLines={1} style={styles.title}>
          {show.title}
        </Text>
        <Text numberOfLines={1} style={styles.category}>
          {show.categories?.[0] || 'Series'}
        </Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    width: 140,
    height: 210,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#171717',
    marginRight: 12,
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  title: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  category: {
    color: '#b3b3b3',
    fontSize: 10,
    marginTop: 2,
  },
});
