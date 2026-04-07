import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { API_BASE } from '../config';

type Profile = { id: number; name: string; is_kids: boolean; avatar_url?: string };

type AuthContextType = {
  token: string | null;
  userId: number | null;
  profileId: number | null;
  profiles: Profile[];
  setProfileId: (id: number | null) => void;
  login: (email: string, password: string, register?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfiles: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

const tokenKey = 'cinepi_token';
const userIdKey = 'cinepi_user_id';
const profileIdKey = 'cinepi_profile_id';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(tokenKey));
  const [userId, setUserId] = useState<number | null>(() => {
    const raw = localStorage.getItem(userIdKey);
    return raw ? Number(raw) : null;
  });
  const [profileId, setProfileIdState] = useState<number | null>(() => {
    const raw = localStorage.getItem(profileIdKey);
    return raw ? Number(raw) : null;
  });
  const [profiles, setProfiles] = useState<Profile[]>([]);

  const setProfileId = useCallback((id: number | null) => {
    setProfileIdState(id);
    if (id) localStorage.setItem(profileIdKey, String(id));
    else localStorage.removeItem(profileIdKey);
  }, []);

  const setSession = (nextToken: string | null, nextUserId: number | null) => {
    setToken(nextToken);
    setUserId(nextUserId);
    if (nextToken) localStorage.setItem(tokenKey, nextToken);
    else localStorage.removeItem(tokenKey);
    if (nextUserId) localStorage.setItem(userIdKey, String(nextUserId));
    else localStorage.removeItem(userIdKey);
  };

  const refreshProfiles = useCallback(async () => {
    if (!token) {
      setProfiles([]);
      return;
    }
    const res = await fetch(`${API_BASE}/profiles`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const data = await res.json();
    setProfiles(Array.isArray(data) ? data : []);
    if ((!profileId || !data.find((p: Profile) => p.id === profileId)) && data.length > 0) {
      setProfileId(data[0].id);
    }
  }, [token, profileId, setProfileId]);

  const login = useCallback(async (email: string, password: string, register = false) => {
    const endpoint = register ? 'register' : 'login';
    const res = await fetch(`${API_BASE}/auth/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      throw new Error('Authentication failed');
    }
    const data = await res.json();
    setSession(data.token, data.user_id);
  }, []);

  const logout = useCallback(async () => {
    if (token) {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    setSession(null, null);
    setProfileId(null);
    setProfiles([]);
  }, [token, setProfileId]);

  const value = useMemo(
    () => ({ token, userId, profileId, profiles, setProfileId, login, logout, refreshProfiles }),
    [token, userId, profileId, profiles, setProfileId, login, logout, refreshProfiles]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
