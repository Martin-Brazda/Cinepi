export interface Episode {
  id: number;
  number: number;
  title: string;
  description: string;
  duration: string;
  watched: boolean;
  progress: number;
  scrape_url?: string;
}

export interface Season {
  number: number;
  episodes: Episode[];
}

export interface Show {
  id: string;
  title: string;
  description: string;
  categories: string[];
  poster_url: string;
  hero_url?: string;
  year?: number;
  seasons?: Season[];
}

export interface Profile {
  id: number;
  name: string;
  is_kids: boolean;
  avatar_url?: string;
}
