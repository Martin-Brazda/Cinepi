import React, { useState, useEffect } from 'react';
import { useNavigation } from '../context/NavigationContext';
import { API_BASE } from '../config';
import { ShowCard } from './ShowCard';

interface Show {
  id: string;
  title: string;
  description: string;
  categories: string[];
  poster_url: string;
}

interface BrowseProps {
  onSelectShow: (id: string) => void;
}

export const Browse: React.FC<BrowseProps> = ({ onSelectShow }) => {
  const [shows, setShows] = useState<Show[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const pageSize = 60;
  const { setFocus } = useNavigation();

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_BASE}/shows?genre=All&limit=${pageSize}&offset=${page * pageSize}`, { signal: controller.signal })
      .then(res => res.json())
      .then(data => {
        const rows = data || [];
        setShows(rows);
        setHasMore(Array.isArray(rows) && rows.length === pageSize);
        setTimeout(() => {
          if (rows && rows.length > 0) {
            setFocus(`browse-${rows[0].id}`);
          }
        }, 100)
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          console.error(err);
        }
      });
    return () => controller.abort();
  }, [setFocus, page]);


  return (
    <div className="flex-1 flex flex-col p-12 overflow-y-auto h-full no-scrollbar pb-32">
        <h2 className="text-3xl font-bold mb-4 text-white">Full Catalog</h2>
        <p className="text-white/40 mb-12 font-bold uppercase tracking-widest text-xs">
          Page {page + 1} - {shows.length} titles
        </p>
        <div className="flex gap-3 mb-6">
          <button className="btn-secondary px-3 py-1 text-xs disabled:opacity-40" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>Prev</button>
          <button className="btn-secondary px-3 py-1 text-xs disabled:opacity-40" disabled={!hasMore} onClick={() => setPage(p => p + 1)}>Next</button>
        </div>

        <div className="flex flex-wrap gap-6 pt-2 pb-4 overflow-visible">
          {shows.map((show, i) => {
            const cols = 5;
            const r = Math.floor(i / cols);
            const c = i % cols;
            return (
              <ShowCard
                key={show.id}
                show={show}
                focusId={`browse-${show.id}`}
                row={r + 1}
                col={c + 1}
                groupId="browse"
                className="w-48 aspect-[2/3] rounded-lg overflow-hidden border border-white/5 bg-bg2 relative group shrink-0"
                activeClassName="ring-4 ring-white scale-110 z-10"
                detailsOverlayClassName="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
                titleClassName="text-[13px] font-bold truncate tracking-wide"
                categoryClassName="text-[10px] text-white/50"
                onSelect={onSelectShow}
              />
            )
          })}
        </div>
    </div>
  );
};
