import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Play, Pause, Rewind, FastForward, Maximize, Volume2 } from 'lucide-react';
import { Focusable } from './Focusable';
import { useNavigation } from '../context/NavigationContext';
import { API_BASE } from '../config';

interface VideoPlayerProps {
  url: string;
  title: string;
  subtitle?: string;
  episodeId?: number;
  profileId?: number;
  token?: string | null;
  showId?: string;
  hasNextEpisode?: boolean;
  onPlayNext?: () => void;
  onClose?: () => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ url, title, subtitle, episodeId, profileId, token, showId, hasNextEpisode, onPlayNext, onClose }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [showUpNext, setShowUpNext] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [quality, setQuality] = useState('auto');
  const [subtitleLang, setSubtitleLang] = useState('off');
  const [playbackLoaded, setPlaybackLoaded] = useState(false);
  const controlsTimeout = useRef<any>(null);

  const { setFocus } = useNavigation();

  useEffect(() => {
    setTimeout(() => setFocus('player-play'), 100);
  }, [setFocus]);

  const resetControlsTimeout = () => {
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    if (isPlaying) {
      controlsTimeout.current = setTimeout(() => setShowControls(false), 4000);
    }
  };

  useEffect(() => {
    const handleKeyDown = () => {
      setShowControls(true);
      resetControlsTimeout();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying]);

  useEffect(() => {
    if (!isPlaying) {
      setShowControls(true);
      if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    } else {
      resetControlsTimeout();
    }
    return () => clearTimeout(controlsTimeout.current);
  }, [isPlaying]);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  useEffect(() => {
    if (!showId) return;
    fetch(`${API_BASE}/shows/${showId}/playback-options`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!data) return;
        if (data.default_quality) setQuality(data.default_quality);
        if (Array.isArray(data.subtitles) && data.subtitles.length > 0) setSubtitleLang(data.subtitles[0]);
      })
      .finally(() => setPlaybackLoaded(true));
  }, [showId]);

  // Periodic watch progress sync
  useEffect(() => {
    if (!episodeId || !profileId || !token) return;

    const syncProgress = (isBeacon = false) => {
      const video = videoRef.current;
      if (video && video.duration > 0 && video.duration !== Infinity) {
        const prog = Math.round((video.currentTime / video.duration) * 100);
        const fetchUrl = `${API_BASE}/profiles/${profileId}/progress`;
        const body = JSON.stringify({ episode_id: episodeId, progress: prog });
        
        if (isBeacon && navigator.sendBeacon) {
          const blob = new Blob([body], { type: 'application/json' });
          navigator.sendBeacon(fetchUrl, blob);
        } else {
          fetch(fetchUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body
          }).catch(() => {});
        }
      }
    };

    const interval = setInterval(() => syncProgress(false), 10000);
    return () => {
      clearInterval(interval);
      syncProgress(true);
    };
  }, [episodeId, profileId, token]);

  useEffect(() => {
    if (!videoRef.current || !url) return;

    let hls: Hls | null = null;

    if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
      videoRef.current.src = url;
    } else if (Hls.isSupported()) {
      hls = new Hls();
      hls.loadSource(url);
      hls.attachMedia(videoRef.current);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        videoRef.current?.play().catch(e => console.error("Auto-play prevented", e));
      });
    }

    return () => {
      if (hls) hls.destroy();
    };
  }, [url]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) videoRef.current.pause();
    else videoRef.current.play();
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const skip = (amount: number) => {
    if (videoRef.current) {
      const dur = isNaN(videoRef.current.duration) || videoRef.current.duration === Infinity ? Number.MAX_SAFE_INTEGER : videoRef.current.duration;
      videoRef.current.currentTime = Math.min(Math.max(videoRef.current.currentTime + amount, 0), dur);
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || duration <= 0 || duration === Infinity) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    videoRef.current.currentTime = pos * duration;
  };

  const onTimeUpdate = () => {
    if (!videoRef.current) return;
    const cTime = videoRef.current.currentTime;
    setCurrentTime(cTime);
    
    const dur = videoRef.current.duration;
    if (dur && !isNaN(dur) && dur !== Infinity && dur > 0) {
      setProgress((cTime / dur) * 100);
      setDuration(dur);
      if (dur - cTime < 30 && hasNextEpisode) {
        setShowUpNext(true);
      } else {
        setShowUpNext(false);
      }
    } else {
      setProgress(0);
      setShowUpNext(false);
    }
  };

  useEffect(() => {
    const detail = {
      title,
      progress: Math.round(progress),
      isPlaying,
    };
    window.dispatchEvent(new CustomEvent('cinepi-tv-status', { detail }));
  }, [title, progress, isPlaying]);

  const onLoadedMetadata = () => {
    if (!videoRef.current) return;
    const dur = videoRef.current.duration;
    if (dur && !isNaN(dur) && dur !== Infinity) {
      setDuration(dur);
    }
  };

  const onEnded = () => {
    if (hasNextEpisode && onPlayNext) {
      onPlayNext();
    } else if (onClose) {
      onClose();
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h > 0 ? h + ':' : ''}${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;
  };

  return (
    <div ref={containerRef} className="fixed inset-0 bg-black z-[100] flex flex-col">
      <div className="relative flex-1 flex items-center justify-center">
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          onTimeUpdate={onTimeUpdate}
          onLoadedMetadata={onLoadedMetadata}
          onEnded={onEnded}
          onClick={togglePlay}
          autoPlay
        />

        {showUpNext && (
          <div className="absolute bottom-32 right-12 z-[110] flex flex-col items-end gap-4 animate-in fade-in slide-in-from-right-8 pointer-events-auto">
            <Focusable 
              id="player-up-next" 
              row={0} 
              col={5} 
              groupId="player" 
              onEnter={() => onPlayNext && onPlayNext()}
              className="bg-red text-white px-6 py-3 rounded-lg flex items-center gap-2 shadow-xl hover:bg-white hover:text-red transition-colors"
              activeClassName="scale-110 ring-4 ring-white/30 drop-shadow-[0_0_15px_rgba(229,56,59,0.5)]"
            >
              <FastForward size={20} fill="currentColor" />
              <span className="font-bold tracking-widest uppercase text-sm">Play Next Episode</span>
            </Focusable>
          </div>
        )}

        {/* Player Overlay */}
        <div className={`absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent p-12 flex flex-col justify-end gap-6 duration-500 pointer-events-none ${showControls ? 'opacity-100 z-[120]' : 'opacity-0 z-0 delay-500'}`}>
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-white shadow-black drop-shadow-md">{title}</h2>
            <p className="text-sm text-white/70 shadow-black drop-shadow-md">{subtitle}</p>
          </div>

          <div className="space-y-4 pointer-events-auto">
            {/* Progress Bar */}
            <Focusable
              id="player-progress"
              row={0}
              col={3}
              groupId="player"
              onLeft={() => { skip(-10); return true; }}
              onRight={() => { skip(10); return true; }}
              onEnter={togglePlay}
              className="py-2 cursor-pointer group"
              activeClassName="scale-[1.01]"
            >
              <div 
                className="h-2 bg-white/20 rounded-full overflow-hidden relative"
                onClick={handleProgressClick}
              >
                <div 
                  className="absolute inset-y-0 left-0 bg-red transition-all duration-100 ease-linear group-[.focused]:bg-white" 
                  style={{ width: `${progress}%` }} 
                />
              </div>
            </Focusable>

            {/* Controls */}
            <div className="flex items-center gap-8 translate-y-2">
              <Focusable 
                id="player-close" 
                row={1} 
                col={1} 
                groupId="player" 
                onEnter={onClose}
                className="text-white/70"
                activeClassName="text-white scale-110"
              >
                <div className="border border-white/30 px-3 py-1 rounded text-sm uppercase tracking-widest bg-black/50">Back</div>
              </Focusable>
              
              <Focusable 
                id="player-rw" 
                row={1} 
                col={2} 
                groupId="player" 
                onEnter={() => skip(-10)}
                className="text-white/70"
                activeClassName="text-white scale-110 drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]"
              >
                <Rewind size={28} />
              </Focusable>
              <Focusable 
                id="player-play" 
                row={1} 
                col={3} 
                groupId="player" 
                onEnter={togglePlay}
                className="bg-white text-black p-4 rounded-full"
                activeClassName="scale-110 ring-4 ring-white/30"
              >
                {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" />}
              </Focusable>
              <Focusable 
                id="player-ff" 
                row={1} 
                col={4} 
                groupId="player" 
                onEnter={() => skip(10)}
                className="text-white/70"
                activeClassName="text-white scale-110 drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]"
              >
                <FastForward size={28} />
              </Focusable>

              <span className="text-sm font-mono text-white/70 shadow-black drop-shadow-md bg-black/50 px-2 py-1 rounded">
                {formatTime(currentTime)} / {duration > 0 && duration !== Infinity ? formatTime(duration) : 'Live'}
              </span>

              <div className="flex-1" />
              <span className="text-xs text-white/60 bg-black/50 px-2 py-1 rounded">{playbackLoaded ? `Q: ${quality} | Sub: ${subtitleLang}` : 'Loading playback options...'}</span>

              <Focusable 
                id="player-vol" 
                row={1} 
                col={5} 
                groupId="player" 
                onEnter={toggleMute}
                className={`text-white/70 ${isMuted ? 'text-red/70' : ''}`}
                activeClassName="text-white scale-110 drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]"
              >
                <div className="relative">
                  <Volume2 size={24} />
                  {isMuted && <div className="absolute -inset-1 border-t-2 border-red rotate-45 transform origin-center" />}
                </div>
              </Focusable>

              <Focusable 
                id="player-fs" 
                row={1} 
                col={6} 
                groupId="player" 
                onEnter={toggleFullscreen}
                className={`text-white/70 ${isFullscreen ? 'text-red' : ''}`}
                activeClassName="text-white scale-110 drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]"
              >
                <Maximize size={24} />
              </Focusable>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
