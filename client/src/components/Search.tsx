import React, { useState, useEffect } from 'react';
import { Focusable } from './Focusable';
import { useNavigation } from '../context/NavigationContext';
import { API_BASE } from '../config';
import { ShowCard } from './ShowCard';

const QWERTY = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']
];

interface Show {
  id: string;
  title: string;
  description: string;
  categories: string[];
  poster_url: string;
}

interface SearchProps {
  onSelectShow: (id: string) => void;
}

export const Search: React.FC<SearchProps> = ({ onSelectShow }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Show[]>([]);
  const [isSearchingExternal, setIsSearchingExternal] = useState(false);
  const { setFocus } = useNavigation();

  useEffect(() => {
    setTimeout(() => setFocus('key-Q'), 100);
  }, [setFocus]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}&scope=local`, { signal: controller.signal })
        .then(res => res.json())
        .then(data => setResults(data || []))
        .catch(err => {
          if (err.name !== 'AbortError') {
            console.error(err);
          }
        });
    }, 700);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const runExternalSearch = () => {
    if (query.trim().length < 2) return;
    const controller = new AbortController();
    setIsSearchingExternal(true);
    fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}&scope=external`, { signal: controller.signal })
      .then(res => res.json())
      .then(data => setResults(data || []))
      .catch(err => {
        if (err.name !== 'AbortError') {
          console.error(err);
        }
      })
      .finally(() => setIsSearchingExternal(false));
  };

  const handleKeyPress = (key: string) => {
    if (key === 'SPACE') setQuery(prev => prev + ' ');
    else if (key === 'BACKSPACE') setQuery(prev => prev.slice(0, -1));
    else if (key === 'CLEAR') setQuery('');
    else setQuery(prev => prev + key);
  };

  return (
    <div className="flex-1 flex p-12 gap-12 overflow-hidden h-full">
      {/* OSK Left Panel */}
      <div className="w-[450px] flex flex-col pt-12 shrink-0">
        <h2 className="text-3xl font-bold mb-4 text-white">Search</h2>

        {/* Synthetic Input display */}
        <div className="bg-bg2 border border-white/10 rounded-lg p-4 mb-8 flex items-center h-16 pointer-events-none">
          <span className="text-xl font-mono text-white tracking-widest">{query}</span>
          <span className="w-[2px] h-6 bg-red ml-1 animate-pulse" />
        </div>

        <div className="flex flex-col gap-2">
          {QWERTY.map((rowArr, rowIndex) => (
            <div key={rowIndex} className="flex gap-2 justify-center">
              {rowArr.map((key, colIndex) => (
                <Focusable
                  key={key}
                  id={`key-${key}`}
                  row={rowIndex + 1}
                  col={colIndex + 1}
                  groupId="search"
                  onEnter={() => handleKeyPress(key)}
                  className="w-10 h-10 flex items-center justify-center bg-black/40 border border-white/10 rounded font-bold text-lg"
                  activeClassName="bg-white/20 border-white scale-110 shadow-lg z-10 text-white"
                >
                  {key}
                </Focusable>
              ))}
            </div>
          ))}

          <div className="flex gap-2 justify-center mt-4">
            <Focusable
              id="key-SPACE"
              row={5}
              col={1}
              groupId="search"
              onEnter={() => handleKeyPress('SPACE')}
              className="w-40 h-10 flex items-center justify-center bg-black/40 border border-white/10 rounded font-bold text-sm tracking-widest"
              activeClassName="bg-white/20 border-white scale-105 shadow-lg z-10 text-white"
            >
              SPACE
            </Focusable>
            <Focusable
              id="key-BACKSPACE"
              row={5}
              col={2}
              groupId="search"
              onEnter={() => handleKeyPress('BACKSPACE')}
              className="w-24 h-10 flex items-center justify-center bg-black/40 border border-white/10 rounded font-bold text-sm bg-red/20 text-red"
              activeClassName="bg-red border-white scale-105 shadow-lg z-10"
            >
              DEL
            </Focusable>
            <Focusable
              id="key-CLEAR"
              row={5}
              col={3}
              groupId="search"
              onEnter={() => handleKeyPress('CLEAR')}
              className="w-24 h-10 flex items-center justify-center bg-black/40 border border-white/10 rounded font-bold text-sm text-white/50"
              activeClassName="bg-white/20 border-white scale-105 shadow-lg z-10 text-white"
            >
              CLEAR
            </Focusable>
            <Focusable
              id="key-SEARCH"
              row={5}
              col={4}
              groupId="search"
              onEnter={runExternalSearch}
              className="w-28 h-10 flex items-center justify-center bg-red/20 border border-white/10 rounded font-bold text-sm tracking-widest"
              activeClassName="bg-red border-white scale-105 shadow-lg z-10 text-white"
            >
              SEARCH
            </Focusable>
          </div>
        </div>
      </div>

      {/* Results Right Panel */}
      <div className="flex-1 border-l border-white/10 pl-12 overflow-y-auto pt-16 no-scrollbar pb-32">
        <p className="text-white/40 mb-6 font-bold uppercase tracking-widest text-xs">
          {query.length < 2
            ? "Type at least 2 characters..."
            : isSearchingExternal
              ? "Searching web + local..."
              : `${results.length} Results Found`}
        </p>

        <div className="flex flex-wrap gap-6">
          {results.map((show, i) => {
            const r = Math.floor(i / 4);
            const c = i % 4;
            return (
              <ShowCard
                key={show.id}
                show={show}
                focusId={`res-${show.id}`}
                row={r + 1}
                col={c + 1}
                groupId="search-results"
                className="w-40 aspect-[2/3] rounded-lg overflow-hidden border border-white/5 bg-bg2 relative group shrink-0"
                activeClassName="ring-2 ring-white scale-105 z-10"
                detailsOverlayClassName="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-100"
                detailsWrapClassName="absolute bottom-0 left-0 right-0 p-3"
                onSelect={onSelectShow}
              />
            )
          })}
        </div>
      </div>
    </div>
  );
};
