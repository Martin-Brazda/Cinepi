import React, { useEffect, useState } from 'react';
import { Focusable } from './Focusable';
import { useNavigation } from '../context/NavigationContext';
import { API_BASE } from '../config';
import { apiFetch } from '../lib/api';

interface Episode {
  id: number; // added
  number: number;
  title: string;
  description: string;
  duration: string;
  watched: boolean;
  progress: number;
  scrape_url?: string;
}

interface Season {
  number: number;
  episodes: Episode[];
}

interface Show {
  id: string;
  title: string;
  description: string;
  categories: string[];
  poster_url: string;
  hero_url: string;
  year: number;
  seasons?: Season[];
}

interface ShowDetailsProps {
  showId: string;
  onBack: () => void;
  onPlayEpisode: (show: Show, episode: Episode) => void;
  token?: string | null;
  profileId?: number | null;
}

export const ShowDetails: React.FC<ShowDetailsProps> = ({ showId, onBack, onPlayEpisode, token, profileId }) => {
  const [show, setShow] = useState<Show | null>(null);
  const [isInList, setIsInList] = useState(false);
  const { setFocus } = useNavigation();

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_BASE}/shows/${showId}`, { signal: controller.signal })
      .then(res => res.json())
      .then(data => {
        setShow(data);
        setTimeout(() => setFocus('details-back'), 100);
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          console.error('Failed to fetch show details:', err);
        }
      });
    return () => controller.abort();
  }, [showId, setFocus]);

  useEffect(() => {
    if (!token || !profileId || !showId) return;
    apiFetch(`/profiles/${profileId}/my-list`, token)
      .then(res => res.ok ? res.json() : [])
      .then((data) => {
        if (Array.isArray(data)) setIsInList(data.some((s: Show) => s.id === showId));
      })
      .catch(() => {});
  }, [token, profileId, showId]);

  const toggleMyList = async () => {
    if (!token || !profileId || !show) return;
    const method = isInList ? 'DELETE' : 'POST';
    const res = await apiFetch(`/profiles/${profileId}/my-list/${show.id}`, token, { method });
    if (res.ok) setIsInList(!isInList);
  };

  if (!show) {
    return (
      <div className="flex-1 flex items-center justify-center text-white/50">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      <div className="absolute inset-0 bg-cover bg-center opacity-30" style={{ backgroundImage: `url(${show.hero_url || 'https://www.transparenttextures.com/patterns/carbon-fibre.png'})` }} />
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/80 to-transparent" />
      <div className="relative z-10 flex-1 flex flex-col p-12 overflow-y-auto no-scrollbar">
        <Focusable
          id="details-back"
          row={1}
          col={1}
          groupId="details"
          onEnter={onBack}
          className="text-white/50 bg-black/40 px-4 py-2 rounded mb-8 self-start text-sm uppercase tracking-widest text-[10px]"
          activeClassName="text-white scale-110 border border-white"
        >
          Back
        </Focusable>

        <h1 className="text-5xl font-bold mb-4">{show.title}</h1>
        <div className="flex items-center gap-4 text-sm text-white/60 mb-6 font-mono">
          <span>{show.year}</span>
          <span>•</span>
          <div className="flex gap-2">
            {show.categories?.map(cat => (
              <span key={cat} className="px-2 py-0.5 rounded border border-white/20">{cat}</span>
            ))}
          </div>
        </div>
        <p className="max-w-2xl text-lg text-white/80 leading-relaxed mb-12">
          {show.description}
        </p>
        {token && profileId && (
          <Focusable
            id="details-mylist"
            row={1}
            col={2}
            groupId="details"
            onEnter={toggleMyList}
            className="text-white bg-black/50 px-4 py-2 rounded mb-8 self-start text-xs uppercase tracking-widest"
            activeClassName="scale-105 ring-2 ring-white"
          >
            {isInList ? 'Remove from My List' : 'Add to My List'}
          </Focusable>
        )}

        {show.seasons && show.seasons.length > 0 && (
          <div className="space-y-8">
            {show.seasons.map((season, sIdx) => (
              <div key={season.number}>
                <h3 className="text-xl font-bold mb-4 border-b border-white/10 pb-2">Season {season.number}</h3>
                <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                  {season.episodes.map((ep, eIdx) => (
                    <Focusable
                      key={ep.number}
                      id={`ep-${season.number}-${ep.number}`}
                      row={2 + sIdx}
                      col={eIdx + 1}
                      groupId="details"
                      onEnter={() => onPlayEpisode(show, ep)}
                      className="flex-shrink-0 w-64 bg-black/40 rounded-lg border border-white/5 p-4 flex flex-col gap-2 relative group"
                      activeClassName="scale-105 border-white bg-white/10"
                    >
                      <div className="flex justify-between items-start">
                        <span className="text-sm font-bold text-white/80">{ep.number}. {ep.title}</span>
                        <span className="text-xs text-white/40">{ep.duration}</span>
                      </div>
                      
                      {ep.progress > 0 && (
                        <div className="h-1 bg-white/10 rounded-full overflow-hidden mt-auto">
                          <div className="h-full bg-red" style={{ width: `${ep.progress}%` }} />
                        </div>
                      )}
                    </Focusable>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
