import React, { useEffect, useState } from 'react';
import { Focusable } from './Focusable';
import { useNavigation } from '../context/NavigationContext';
import { Activity, HardDrive, Wifi, Shield, Cpu } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { useRemoteControl } from '../context/RemoteControlContext';

interface SettingsProps {}

export const Settings: React.FC<SettingsProps> = () => {
  const { setFocus } = useNavigation();
  const { token, profiles, profileId, setProfileId, refreshProfiles, login, logout } = useAuth();
  const { connected: remoteConnected, pairCode, pairUrl } = useRemoteControl();
  const [autoPlay, setAutoPlay] = useState(true);
  const [highQuality, setHighQuality] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [profileName, setProfileName] = useState('');

  useEffect(() => {
    setTimeout(() => setFocus('settings-t1'), 100);
  }, [setFocus]);

  useEffect(() => {
    if (token) refreshProfiles().catch(() => {});
  }, [token, refreshProfiles]);

  const createProfile = async () => {
    if (!token || !profileName.trim()) return;
    const res = await apiFetch('/profiles', token, {
      method: 'POST',
      body: JSON.stringify({ name: profileName.trim() }),
    });
    if (res.ok) {
      setProfileName('');
      refreshProfiles().catch(() => {});
    }
  };

  return (
    <div className="flex-1 flex p-12 gap-12 overflow-y-auto h-full no-scrollbar pb-32">
        <div className="w-1/2 flex flex-col shrink-0">
            <h2 className="text-3xl font-bold mb-8 text-white">System Settings</h2>
            <div className="mb-6 p-4 border border-white/10 rounded-lg bg-bg2">
              {!token ? (
                <div className="space-y-2">
                  <input className="w-full bg-black/40 border border-white/20 rounded p-2 text-sm" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
                  <input className="w-full bg-black/40 border border-white/20 rounded p-2 text-sm" placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
                  <div className="flex gap-2">
                    <button className="btn-primary px-4 py-2 text-xs" onClick={() => login(email, password, false).then(() => refreshProfiles())}>Login</button>
                    <button className="btn-secondary px-4 py-2 text-xs" onClick={() => login(email, password, true).then(() => refreshProfiles())}>Register</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-xs text-white/60">Signed in. Active profile: {profileId || 'none'}</div>
                  <div className="flex gap-2 flex-wrap">
                    {profiles.map(p => (
                      <button key={p.id} onClick={() => setProfileId(p.id)} className={`px-3 py-1 rounded text-xs border ${p.id === profileId ? 'border-red text-red' : 'border-white/20 text-white/80'}`}>{p.name}</button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input className="flex-1 bg-black/40 border border-white/20 rounded p-2 text-sm" placeholder="New profile name" value={profileName} onChange={e => setProfileName(e.target.value)} />
                    <button className="btn-secondary px-3 py-2 text-xs" onClick={createProfile}>Add</button>
                    <button className="btn-secondary px-3 py-2 text-xs" onClick={() => logout()}>Logout</button>
                    <button className="btn-secondary px-3 py-2 text-xs" onClick={() => token && apiFetch('/auth/logout-all', token, { method: 'POST' })}>Logout All</button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-4 max-w-sm">
                <Focusable 
                    id="settings-t1" 
                    row={1} 
                    col={1} 
                    groupId="settings"
                    onEnter={() => setAutoPlay(!autoPlay)}
                    className="flex items-center justify-between bg-bg2 border border-white/5 p-4 rounded-lg"
                    activeClassName="ring-2 ring-white scale-105 z-10"
                >
                    <div>
                        <div className="font-bold">Auto-Play Next Episode</div>
                        <div className="text-xs text-white/50">Automatically play the next episode when finished</div>
                    </div>
                    <div className={`w-12 h-6 rounded-full p-1 transition-colors ${autoPlay ? 'bg-red' : 'bg-white/10'}`}>
                        <div className={`w-4 h-4 rounded-full bg-white transition-transform ${autoPlay ? 'translate-x-6' : 'translate-x-0'}`} />
                    </div>
                </Focusable>

                <Focusable 
                    id="settings-t2" 
                    row={2} 
                    col={1} 
                    groupId="settings"
                    onEnter={() => setHighQuality(!highQuality)}
                    className="flex items-center justify-between bg-bg2 border border-white/5 p-4 rounded-lg"
                    activeClassName="ring-2 ring-white scale-105 z-10"
                >
                    <div>
                        <div className="font-bold">Stream High Quality</div>
                        <div className="text-xs text-white/50">Always fetch highest available variant M3U8</div>
                    </div>
                    <div className={`w-12 h-6 rounded-full p-1 transition-colors ${highQuality ? 'bg-red' : 'bg-white/10'}`}>
                        <div className={`w-4 h-4 rounded-full bg-white transition-transform ${highQuality ? 'translate-x-6' : 'translate-x-0'}`} />
                    </div>
                </Focusable>

                <Focusable 
                    id="settings-t3" 
                    row={3} 
                    col={1} 
                    groupId="settings"
                    onEnter={() => alert("Cache Cleared!")}
                    className="flex justify-center items-center bg-black/40 border border-white/5 p-4 rounded-lg mt-8"
                    activeClassName="ring-2 ring-white scale-105 z-10 bg-white/10"
                >
                    <span className="font-bold text-red uppercase tracking-widest text-sm">Clear Application Cache</span>
                </Focusable>
            </div>
        </div>

        <div className="w-1/2 flex flex-col pt-16">
            <h3 className="text-white/40 mb-6 font-bold uppercase tracking-widest text-xs">Device Information</h3>
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-bg2 border border-white/5 p-4 rounded-lg flex gap-4 items-center">
                    <Cpu size={24} className="text-indigo-400" />
                    <div>
                        <div className="text-xs text-white/50">Processor</div>
                        <div className="font-bold text-sm tracking-widest">BCM2837B0</div>
                    </div>
                </div>
                <div className="bg-bg2 border border-white/5 p-4 rounded-lg flex gap-4 items-center">
                    <Activity size={24} className="text-emerald-400" />
                    <div>
                        <div className="text-xs text-white/50">Temperature</div>
                        <div className="font-bold text-sm tracking-widest">48.2 °C</div>
                    </div>
                </div>
                <div className="bg-bg2 border border-white/5 p-4 rounded-lg flex gap-4 items-center">
                    <Wifi size={24} className="text-blue-400" />
                    <div>
                        <div className="text-xs text-white/50">Network</div>
                        <div className="font-bold text-sm tracking-widest">Connected (5GHz)</div>
                    </div>
                </div>
                <div className="bg-bg2 border border-white/5 p-4 rounded-lg flex gap-4 items-center">
                    <HardDrive size={24} className="text-pink-400" />
                    <div>
                        <div className="text-xs text-white/50">Storage</div>
                        <div className="font-bold text-sm tracking-widest">14.2 GB Free</div>
                    </div>
                </div>
                <div className="bg-bg2 border border-white/5 p-4 rounded-lg flex gap-4 items-center col-span-2">
                    <Shield size={24} className="text-orange-400" />
                    <div>
                        <div className="text-xs text-white/50">Firmware Version</div>
                        <div className="font-bold text-sm tracking-widest">CINEPI-OS v1.4.2 stable</div>
                    </div>
                </div>
                <div className="bg-bg2 border border-white/5 p-4 rounded-lg flex gap-4 items-center col-span-2">
                    <Wifi size={24} className={remoteConnected ? "text-emerald-400" : "text-red"} />
                    <div>
                        <div className="text-xs text-white/50">Mobile Remote Pairing</div>
                        <div className="font-bold text-sm tracking-widest">
                          {remoteConnected ? `Bridge connected${pairCode ? ` - Code ${pairCode}` : ''}` : 'Bridge offline (run npm run remote:bridge)'}
                        </div>
                        {pairUrl && (
                          <div className="mt-2">
                            <div className="text-[11px] text-white/60 break-all">{pairUrl}{pairCode ? `?code=${pairCode}` : ''}</div>
                            {pairCode && (
                              <img
                                alt="Remote Pair QR"
                                className="mt-2 w-24 h-24 rounded border border-white/20 bg-white p-1"
                                src={`https://quickchart.io/qr?size=160&text=${encodeURIComponent(`${pairUrl}?code=${pairCode}`)}`}
                              />
                            )}
                          </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};
