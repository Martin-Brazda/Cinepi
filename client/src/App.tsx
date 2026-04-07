import { useState, useEffect } from 'react'
import { NavigationProvider, useNavigation } from './context/NavigationContext'
import { Focusable } from './components/Focusable'
import { Play, Info, Search, Home, Library, ListVideo, Settings as SettingsIcon } from 'lucide-react'
import { ShowDetails } from './components/ShowDetails'
import { VideoPlayer } from './components/VideoPlayer'
import { Search as SearchPage } from './components/Search'
import { Browse } from './components/Browse'
import { Settings } from './components/Settings'
import { MyLibrary } from './components/MyLibrary'
import { API_BASE } from './config'
import { ShowCard } from './components/ShowCard'
import { useAuth } from './context/AuthContext'
import { apiFetch } from './lib/api'

interface Episode {
  id: number;
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
  year?: number;
  seasons?: Season[];
}

const NavItem = ({ id, icon: Icon, label, active, onClick, row, col }: any) => (
  <Focusable
    id={id}
    row={row}
    col={col}
    groupId="nav"
    onEnter={onClick}
    className={`flex flex-col items-center gap-1 py-2 px-4 cursor-pointer transition-colors ${active ? 'text-red' : 'text-white/30'}`}
    activeClassName="text-red scale-110"
  >
    <Icon size={20} />
    <span className="text-[10px] uppercase tracking-wider">{label}</span>
  </Focusable>
)

const HomePage = ({
  onSelectShow,
  token,
  profileId,
}: {
  onSelectShow: (id: string) => void;
  token: string | null;
  profileId: number | null;
}) => {
  const [shows, setShows] = useState<Show[]>([])
  const [groupedShows, setGroupedShows] = useState<{ category: string; items: Show[] }[]>([])
  const [recommendations, setRecommendations] = useState<Show[]>([])
  const [continueRows, setContinueRows] = useState<Show[]>([])
  const { setFocus } = useNavigation()

  useEffect(() => {
    const controller = new AbortController()
    fetch(`${API_BASE}/shows?genre=All&limit=60`, { signal: controller.signal })
      .then(res => res.json())
      .then(data => setShows(data))
      .catch(err => {
        if (err.name !== 'AbortError') {
          console.error('Failed to fetch shows:', err)
        }
      })

    // Initial focus
    setFocus('hero-play')
    return () => controller.abort()
  }, [setFocus])

  useEffect(() => {
    if (!token || !profileId) return
    apiFetch(`/profiles/${profileId}/recommendations`, token).then(async res => {
      if (res.ok) setRecommendations(await res.json())
    })
    apiFetch(`/profiles/${profileId}/continue-watching`, token).then(async res => {
      if (!res.ok) return
      const data = await res.json()
      const rows = Array.isArray(data) ? data.map((r: any) => r.show).filter(Boolean) : []
      setContinueRows(rows)
    })
  }, [token, profileId])

  useEffect(() => {
    const controller = new AbortController()
    fetch(`${API_BASE}/home-rows?per_category=12&categories=12`, { signal: controller.signal })
      .then(res => res.json())
      .then((rows) => {
        if (Array.isArray(rows)) setGroupedShows(rows)
      })
      .catch(() => {})
    return () => controller.abort()
  }, [])

  const featured = shows.length > 0 ? shows[0] : null

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar pb-32">
      {/* Hero Section */}
      <div className="relative h-[45vh] shrink-0 overflow-hidden">
        {featured?.hero_url && (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-40 transition-all duration-1000"
            style={{ backgroundImage: `url(${featured.hero_url})` }}
          />
        )}
        <div className="absolute inset-0 hero-bg-gradient" />
        <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
        <div className="absolute inset-0 hero-content-gradient" />

        <div className="absolute bottom-0 left-0 right-0 p-8 space-y-4">
          <div className="inline-block text-[10px] font-bold text-red border border-red px-2 py-0.5 rounded tracking-widest uppercase">
            Featured
          </div>
          <h1 className="text-4xl font-bold">{featured?.title || 'Loading...'}</h1>
          <p className="text-sm text-white/60 max-w-xl leading-relaxed">
            {featured?.description || ''}
          </p>

          <div className="flex gap-3">
            <Focusable id="hero-play" row={1} col={1} groupId="hero" className="btn-primary" onEnter={() => featured && onSelectShow(featured.id)}>
              <Play size={16} fill="currentColor" /> Resume
            </Focusable>
            <Focusable id="hero-info" row={1} col={2} groupId="hero" className="btn-secondary" onEnter={() => featured && onSelectShow(featured.id)}>
              <Info size={16} /> Details
            </Focusable>
          </div>
        </div>
      </div>

      {/* Dynamic Category Rows */}
      <div className="px-8 py-6 space-y-8">
        {continueRows.length > 0 && (
          <section>
            <h2 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4">Continue Watching</h2>
            <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
              {continueRows.map((show, colIdx) => (
                <ShowCard key={`cw-${show.id}`} show={show} focusId={`cw-${show.id}`} row={2} col={colIdx + 1} groupId="continue" className="flex-shrink-0 w-40 aspect-[2/3] rounded-lg overflow-hidden border border-white/5 bg-bg2 relative group" onSelect={onSelectShow} />
              ))}
            </div>
          </section>
        )}
        {recommendations.length > 0 && (
          <section>
            <h2 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4">Recommended For You</h2>
            <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
              {recommendations.map((show, colIdx) => (
                <ShowCard key={`rec-${show.id}`} show={show} focusId={`rec-${show.id}`} row={3} col={colIdx + 1} groupId="recommendations" className="flex-shrink-0 w-40 aspect-[2/3] rounded-lg overflow-hidden border border-white/5 bg-bg2 relative group" onSelect={onSelectShow} />
              ))}
            </div>
          </section>
        )}
        {groupedShows.map((group, rowIdx) => (
          <section key={group.category}>
            <h2 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4">{group.category}</h2>
            <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
              {group.items.map((show, colIdx) => (
                <ShowCard
                  key={show.id}
                  show={show}
                  focusId={`cat-${group.category}-${show.id}`}
                  row={rowIdx + 2} // start from row 2
                  col={colIdx + 1}
                  groupId={`category-${group.category}`}
                  className="flex-shrink-0 w-40 aspect-[2/3] rounded-lg overflow-hidden border border-white/5 bg-bg2 relative group"
                  onSelect={onSelectShow}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

const AppContent = () => {
  const { token, profileId, profiles, setProfileId, refreshProfiles } = useAuth()
  const [activePage, setActivePage] = useState('home')
  useEffect(() => {
    refreshProfiles().catch(() => {})
  }, [refreshProfiles])

  const [selectedShowId, setSelectedShowId] = useState<string | null>(null)

  // Player state
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [playingEpisodeMeta, setPlayingEpisodeMeta] = useState<{ title: string, subtitle: string } | null>(null)
  const [isScraping, setIsScraping] = useState(false)

  const handleSelectShow = (id: string) => {
    setSelectedShowId(id)
    setActivePage('details')
  }

  const [playingEpisode, setPlayingEpisode] = useState<Episode | null>(null);
  const [playingShow, setPlayingShow] = useState<Show | null>(null);

  const handlePlayEpisode = async (show: Show, episode: Episode) => {
    if (!episode.scrape_url) return;
    setPlayingEpisodeMeta({ title: `Episode ${episode.number}: ${episode.title}`, subtitle: show.title })
    setPlayingEpisode(episode)
    setPlayingShow(show)
    setIsScraping(true)
    try {
      const res = await fetch(`${API_BASE}/scrape?url=${encodeURIComponent(episode.scrape_url)}`)
      const data = await res.json()
      const streamUrl = typeof data.m3u8 === 'string'
        ? data.m3u8
        : Array.isArray(data.m3u8)
          ? data.m3u8[0]
          : ''

      if (streamUrl) {
        setVideoUrl(streamUrl)
        setIsScraping(false)
        setActivePage('player')
      } else {
        alert("Failed to find stream.")
        setIsScraping(false)
      }
    } catch (err) {
      console.error(err)
      setIsScraping(false)
    }
  }

  const handlePlayNext = () => {
    if (!playingShow || !playingEpisode) return;
    let foundCurrent = false;
    let nextEp: Episode | null = null;

    for (const season of playingShow.seasons || []) {
      for (const ep of season.episodes) {
        if (foundCurrent) {
          nextEp = ep;
          break;
        }
        if (ep.id === playingEpisode.id) {
          foundCurrent = true;
        }
      }
      if (nextEp) break;
    }

    if (nextEp) {
      handlePlayEpisode(playingShow, nextEp);
    } else {
      // no next episode
      setVideoUrl(null);
      setActivePage('details');
    }
  };

  let hasNextEpisode = false;
  if (playingShow && playingEpisode) {
    let foundCurrent = false;
    for (const season of playingShow.seasons || []) {
      for (const ep of season.episodes) {
        if (foundCurrent) { hasNextEpisode = true; break; }
        if (ep.id === playingEpisode.id) { foundCurrent = true; }
      }
      if (hasNextEpisode) break;
    }
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-bg relative">
      {/* Top Nav */}
      <div className="flex items-center px-8 h-14 border-b border-white/5 bg-bg/80 backdrop-blur-md sticky top-0 z-50">
      <span className="text-red font-bold tracking-widest text-sm mr-8">CINEPI</span>
        <div className="flex-1" />
        <div className="flex items-center gap-2 bg-bg2 border border-white/5 px-3 py-1 rounded-full">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span className="text-[10px] text-white/60">Pi 3A+ Online</span>
        </div>
      </div>

      {/* Main Container */}
      <main className="flex-1 flex overflow-hidden">
        {activePage === 'home' && <HomePage onSelectShow={handleSelectShow} token={token} profileId={profileId} />}
        {activePage === 'search' && <SearchPage onSelectShow={handleSelectShow} />}
        {activePage === 'browse' && <Browse onSelectShow={handleSelectShow} />}
        {activePage === 'my-list' && <MyLibrary onSelectShow={handleSelectShow} />}
        {activePage === 'settings' && <Settings />}
        {activePage === 'details' && selectedShowId && (
          <ShowDetails
            showId={selectedShowId}
            onBack={() => setActivePage('home')}
            onPlayEpisode={handlePlayEpisode}
            token={token}
            profileId={profileId}
          />
        )}
      </main>

      {/* Bottom Nav */}
      {activePage !== 'details' && activePage !== 'player' && (
        <nav className="flex justify-center border-t border-white/5 bg-bg pb-safe">
          <div className="flex gap-4">
            <NavItem id="nav-home" icon={Home} label="Home" active={activePage === 'home'} onClick={() => setActivePage('home')} row={100} col={1} />
            <NavItem id="nav-search" icon={Search} label="Search" active={activePage === 'search'} onClick={() => setActivePage('search')} row={100} col={2} />
            <NavItem id="nav-browse" icon={Library} label="Browse" active={activePage === 'browse'} onClick={() => setActivePage('browse')} row={100} col={3} />
            <NavItem id="nav-mylist" icon={ListVideo} label="My List" active={activePage === 'my-list'} onClick={() => setActivePage('my-list')} row={100} col={4} />
            <NavItem id="nav-settings" icon={SettingsIcon} label="Settings" active={activePage === 'settings'} onClick={() => setActivePage('settings')} row={100} col={5} />
          </div>
        </nav>
      )}

      {/* Scraping Overlay */}
      {isScraping && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
          <div className="w-12 h-12 border-4 border-red border-t-transparent rounded-full animate-spin" />
          <p className="text-xl font-bold tracking-widest animate-pulse">LOADING STREAM...</p>
          <p className="text-white/50 text-sm">this may take a few seconds</p>
        </div>
      )}

      {/* Startup Profile Picker */}
      {token && !profileId && profiles.length > 0 && activePage !== 'player' && (
        <div className="fixed inset-0 z-[220] bg-black/85 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-bg2 border border-white/10 rounded-xl p-6 w-[560px]">
            <h2 className="text-xl font-bold mb-2">Choose Profile</h2>
            <p className="text-white/60 text-sm mb-6">Select a profile to personalize recommendations and progress.</p>
            <div className="grid grid-cols-2 gap-3">
              {profiles.map((p, idx) => (
                <Focusable
                  key={p.id}
                  id={`profile-pick-${p.id}`}
                  row={idx + 1}
                  col={1}
                  groupId="profile-picker"
                  onEnter={() => setProfileId(p.id)}
                  className="p-4 rounded-lg border border-white/10 bg-black/40 text-left"
                  activeClassName="ring-2 ring-white scale-[1.02]"
                >
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-xs text-white/50">{p.is_kids ? 'Kids Profile' : 'Standard Profile'}</div>
                </Focusable>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Video Player */}
      {activePage === 'player' && videoUrl && (
        <VideoPlayer
          url={videoUrl}
          title={playingEpisodeMeta?.title || "Episode"}
          subtitle={playingEpisodeMeta?.subtitle || "Playing stream..."}
          episodeId={playingEpisode?.id}
          showId={playingShow?.id}
          profileId={profileId || undefined}
          token={token}
          hasNextEpisode={hasNextEpisode}
          onPlayNext={handlePlayNext}
          onClose={() => {
            setVideoUrl(null)
            setActivePage('details')
          }}
        />
      )}
    </div>
  )
}

export default function App() {
  return (
    <NavigationProvider>
      <AppContent />
    </NavigationProvider>
  )
}
