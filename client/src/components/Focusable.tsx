import React, { useEffect, useRef } from 'react';
import { useNavigation } from '../context/NavigationContext';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface FocusableProps {
  id: string;
  onEnter?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onLeft?: () => boolean | void;
  onRight?: () => boolean | void;
  onUp?: () => boolean | void;
  onDown?: () => boolean | void;
  row: number;
  col: number;
  groupId: string;
  children: React.ReactNode;
  className?: string;
  activeClassName?: string;
}

export const Focusable: React.FC<FocusableProps> = ({
  id,
  onEnter,
  onFocus,
  onBlur,
  onLeft,
  onRight,
  onUp,
  onDown,
  row,
  col,
  groupId,
  children,
  className,
  activeClassName = 'focused',
}) => {
  const { focusedId, register, unregister } = useNavigation();
  const isFocused = focusedId === id;
  const prevFocused = useRef(isFocused);
  const elRef = useRef<HTMLDivElement | null>(null);

  const callbacksRef = useRef({ onEnter, onFocus, onBlur, onLeft, onRight, onUp, onDown });
  useEffect(() => {
    callbacksRef.current = { onEnter, onFocus, onBlur, onLeft, onRight, onUp, onDown };
  }, [onEnter, onFocus, onBlur, onLeft, onRight, onUp, onDown]);

  useEffect(() => {
    register({ 
      id, 
      row, 
      col, 
      groupId,
      onEnter: () => callbacksRef.current.onEnter?.(),
      onFocus: () => callbacksRef.current.onFocus?.(),
      onBlur: () => callbacksRef.current.onBlur?.(),
      onLeft: () => callbacksRef.current.onLeft?.(),
      onRight: () => callbacksRef.current.onRight?.(),
      onUp: () => callbacksRef.current.onUp?.(),
      onDown: () => callbacksRef.current.onDown?.(),
    });
    return () => unregister(id);
  }, [id, row, col, groupId, register, unregister]);

  useEffect(() => {
    if (isFocused && !prevFocused.current) {
      // Keep focused card visible in horizontal/vertical scroll containers.
      elRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
      onFocus?.();
    } else if (!isFocused && prevFocused.current) {
      onBlur?.();
    }
    prevFocused.current = isFocused;
  }, [isFocused, onFocus, onBlur]);

  return (
    <div
      id={id}
      ref={elRef}
      className={cn(className, 'card-focus-scale', isFocused && activeClassName)}
      onClick={onEnter}
    >
      {children}
    </div>
  );
};
