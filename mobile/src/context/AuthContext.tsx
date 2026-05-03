import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { apiFetch } from '../lib/api';
import { Profile } from '../types';

type AuthContextType = {
  token: string | null;
  userId: number | null;
  profileId: number | null;
  profiles: Profile[];
  login: (email: string, password: string, register?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  setProfileId: (id: number | null) => Promise<void>;
  refreshProfiles: () => Promise<void>;
  restoreSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = 'cinepi_token';
const USER_ID_KEY = 'cinepi_user_id';
const PROFILE_ID_KEY = 'cinepi_profile_id';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [profileId, setProfileIdState] = useState<number | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  const restoreSession = useCallback(async () => {
    const [savedToken, savedUserId, savedProfileId] = await Promise.all([
      AsyncStorage.getItem(TOKEN_KEY),
      AsyncStorage.getItem(USER_ID_KEY),
      AsyncStorage.getItem(PROFILE_ID_KEY),
    ]);
    setToken(savedToken);
    setUserId(savedUserId ? Number(savedUserId) : null);
    setProfileIdState(savedProfileId ? Number(savedProfileId) : null);
  }, []);

  const setProfileId = useCallback(async (id: number | null) => {
    setProfileIdState(id);
    if (id === null) {
      await AsyncStorage.removeItem(PROFILE_ID_KEY);
      return;
    }
    await AsyncStorage.setItem(PROFILE_ID_KEY, String(id));
  }, []);

  const login = useCallback(async (email: string, password: string, register = false) => {
    const endpoint = register ? '/auth/register' : '/auth/login';
    const res = await apiFetch(endpoint, null, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      throw new Error('Authentication failed');
    }
    const data = await res.json();
    setToken(data.token);
    setUserId(data.user_id);
    await AsyncStorage.setItem(TOKEN_KEY, data.token);
    await AsyncStorage.setItem(USER_ID_KEY, String(data.user_id));
  }, []);

  const logout = useCallback(async () => {
    if (token) {
      await apiFetch('/auth/logout', token, { method: 'POST' }).catch(() => undefined);
    }
    setToken(null);
    setUserId(null);
    setProfileIdState(null);
    setProfiles([]);
    await Promise.all([
      AsyncStorage.removeItem(TOKEN_KEY),
      AsyncStorage.removeItem(USER_ID_KEY),
      AsyncStorage.removeItem(PROFILE_ID_KEY),
    ]);
  }, [token]);

  const refreshProfiles = useCallback(async () => {
    if (!token) {
      setProfiles([]);
      return;
    }
    const res = await apiFetch('/profiles', token);
    if (!res.ok) return;
    const rows = (await res.json()) as Profile[];
    setProfiles(Array.isArray(rows) ? rows : []);
    if (rows.length > 0 && !rows.some((p) => p.id === profileId)) {
      await setProfileId(rows[0].id);
    }
  }, [token, profileId, setProfileId]);

  const value = useMemo(
    () => ({
      token,
      userId,
      profileId,
      profiles,
      login,
      logout,
      setProfileId,
      refreshProfiles,
      restoreSession,
    }),
    [token, userId, profileId, profiles, login, logout, setProfileId, refreshProfiles, restoreSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
