import React from 'react';
import { Focusable } from './Focusable';

interface ShowCardData {
  id: string;
  title: string;
  categories: string[];
  poster_url: string;
}

interface ShowCardProps {
  show: ShowCardData;
  focusId: string;
  row: number;
  col: number;
  groupId: string;
  className: string;
  activeClassName?: string;
  detailsOverlayClassName?: string;
  detailsWrapClassName?: string;
  titleClassName?: string;
  categoryClassName?: string;
  onSelect: (id: string) => void;
  onUp?: () => boolean | void;
  onDown?: () => boolean | void;
  onLeft?: () => boolean | void;
  onRight?: () => boolean | void;
}

const isImagePoster = (posterUrl?: string) =>
  !!posterUrl && (posterUrl.startsWith('http') || posterUrl.startsWith('/'));

export const ShowCard: React.FC<ShowCardProps> = React.memo(({
  show,
  focusId,
  row,
  col,
  groupId,
  className,
  activeClassName,
  detailsOverlayClassName = 'absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity',
  detailsWrapClassName = 'absolute bottom-0 left-0 right-0 p-3 translate-y-4 group-hover:translate-y-0 focus:translate-y-0 transition-transform',
  titleClassName = 'text-[11px] font-bold truncate',
  categoryClassName = 'text-[9px] text-white/40',
  onSelect,
  onUp,
  onDown,
  onLeft,
  onRight,
}) => {
  return (
    <Focusable
      id={focusId}
      row={row}
      col={col}
      groupId={groupId}
      className={className}
      activeClassName={activeClassName}
      onEnter={() => onSelect(show.id)}
      onUp={onUp}
      onDown={onDown}
      onLeft={onLeft}
      onRight={onRight}
    >
      {isImagePoster(show.poster_url) ? (
        <img src={show.poster_url} alt={show.title} className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className={`absolute inset-0 ${show.poster_url || 'th-purple'}`} />
      )}
      <div className={detailsOverlayClassName} />
      <div className={detailsWrapClassName}>
        <div className={titleClassName}>{show.title}</div>
        <div className={categoryClassName}>{(show.categories && show.categories[0]) || 'Uncategorized'}</div>
      </div>
    </Focusable>
  );
});
