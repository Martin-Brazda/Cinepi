import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';

export const ProfilePicker: React.FC = () => {
  const { token, profileId, profiles, setProfileId } = useAuth();
  const visible = !!token && !profileId && profiles.length > 0;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.panel}>
          <Text style={styles.title}>Choose Profile</Text>
          {profiles.map((profile) => (
            <Pressable key={profile.id} style={styles.profileBtn} onPress={() => setProfileId(profile.id)}>
              <Text style={styles.profileName}>{profile.name}</Text>
              <Text style={styles.profileType}>{profile.is_kids ? 'Kids Profile' : 'Standard Profile'}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.86)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  panel: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 12,
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    padding: 16,
    gap: 10,
  },
  title: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  profileBtn: {
    backgroundColor: '#1d1d1d',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    padding: 12,
  },
  profileName: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  profileType: {
    color: '#9ca3af',
    marginTop: 3,
    fontSize: 12,
  },
});
