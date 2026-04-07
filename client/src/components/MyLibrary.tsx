import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { ShowCard } from './ShowCard';

interface Show {
  id: string;
  title: string;
  description: string;
  categories: string[];
  poster_url: string;
}

interface MyLibraryProps {
  onSelectShow: (id: string) => void;
}

export const MyLibrary: React.FC<MyLibraryProps> = ({ onSelectShow }) => {
  const { token, profileId } = useAuth();
  const [myList, setMyList] = useState<Show[]>([]);
  const [continueWatching, setContinueWatching] = useState<Show[]>([]);
  const [recommendations, setRecommendations] = useState<Show[]>([]);

  const loadAll = () => {
    if (!token || !profileId) return;
    apiFetch(`/profiles/${profileId}/my-list`, token).then(async res => {
      if (res.ok) setMyList(await res.json());
    });
    apiFetch(`/profiles/${profileId}/continue-watching`, token).then(async res => {
      if (!res.ok) return;
      const data = await res.json();
      setContinueWatching(Array.isArray(data) ? data.map((r: any) => r.show).filter(Boolean) : []);
    });
    apiFetch(`/profiles/${profileId}/recommendations`, token).then(async res => {
      if (res.ok) setRecommendations(await res.json());
    });
  };

  useEffect(() => {
    loadAll();
  }, [token, profileId]);

  if (!token || !profileId) {
    return <div className="flex-1 p-12 text-white/50">Sign in and choose a profile in Settings to view My List.</div>;
  }

  const section = (title: string, items: Show[], group: string, rowBase: number) => (
    <section>
      <h2 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4">{title}</h2>
      <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
        {items.map((show, idx) => (
          <ShowCard
            key={`${group}-${show.id}`}
            show={show}
            focusId={`${group}-${show.id}`}
            row={rowBase}
            col={idx + 1}
            groupId={group}
            className="flex-shrink-0 w-40 aspect-[2/3] rounded-lg overflow-hidden border border-white/5 bg-bg2 relative group"
            onSelect={onSelectShow}
          />
        ))}
      </div>
      {items.length === 0 && <div className="text-white/40 text-sm mb-4">No titles yet.</div>}
    </section>
  );

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar pb-32 px-8 py-6 space-y-8">
      <div className="flex gap-2">
        <button
          className="btn-secondary px-3 py-1 text-xs"
          onClick={async () => {
            await apiFetch(`/profiles/${profileId}/recommendations/refresh`, token, { method: 'POST' });
            setTimeout(loadAll, 1000);
          }}
        >
          Refresh Recommendations
        </button>
      </div>
      {section('My List', myList, 'my-list', 1)}
      {section('Continue Watching', continueWatching, 'continue', 2)}
      {section('Recommended For You', recommendations, 'recommend', 3)}
    </div>
  );
};
