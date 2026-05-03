import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

type Direction = 'up' | 'down' | 'left' | 'right';

interface NavNode {
  id: string;
  onEnter?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onLeft?: () => boolean | void;
  onRight?: () => boolean | void;
  onUp?: () => boolean | void;
  onDown?: () => boolean | void;
  // Spatial coordinates for navigation
  row: number;
  col: number;
  groupId: string;
}

interface NavigationContextType {
  focusedId: string | null;
  register: (node: NavNode) => void;
  unregister: (id: string) => void;
  setFocus: (id: string) => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<Map<string, NavNode>>(new Map());

  const register = useCallback((node: NavNode) => {
    setNodes((prev) => {
      const next = new Map(prev);
      next.set(node.id, node);
      return next;
    });
  }, []);

  const unregister = useCallback((id: string) => {
    setNodes((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const setFocus = useCallback((id: string) => {
    setFocusedId(id);
  }, []);

  const moveFocus = useCallback((direction: Direction) => {
    if (!focusedId) {
      const firstId = nodes.keys().next().value;
      if (typeof firstId === 'string') setFocusedId(firstId);
      return;
    }

    const current = nodes.get(focusedId);
    if (!current) return;

    let bestNext: NavNode | null = null;
    let minScore = Infinity;

    nodes.forEach((node) => {
      if (node.id === focusedId) return;

      const dx = node.col - current.col;
      const dy = node.row - current.row;
      let isCandidate = false;
      let primary = 0;
      let secondary = 0;

      switch (direction) {
        case 'up':
          if (dy < 0) {
            isCandidate = true;
            primary = Math.abs(dy);
            secondary = Math.abs(dx);
          }
          break;
        case 'down':
          if (dy > 0) {
            isCandidate = true;
            primary = Math.abs(dy);
            secondary = Math.abs(dx);
          }
          break;
        case 'left':
          if (dx < 0) {
            isCandidate = true;
            primary = Math.abs(dx);
            secondary = Math.abs(dy);
          }
          break;
        case 'right':
          if (dx > 0) {
            isCandidate = true;
            primary = Math.abs(dx);
            secondary = Math.abs(dy);
          }
          break;
      }

      if (!isCandidate) return;
      // Heavily prioritize direction axis, then proximity on cross-axis.
      const score = primary * 100 + secondary;
      if (score < minScore) {
        minScore = score;
        bestNext = node;
      }
    });

    if (bestNext) {
      setFocusedId((bestNext as NavNode).id);
    }
  }, [focusedId, nodes]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const current = focusedId ? nodes.get(focusedId) : null;
      switch (e.key) {
        case 'ArrowUp': 
          if (current?.onUp?.()) break;
          moveFocus('up'); 
          break;
        case 'ArrowDown': 
          if (current?.onDown?.()) break;
          moveFocus('down'); 
          break;
        case 'ArrowLeft': 
          if (current?.onLeft?.()) break;
          moveFocus('left'); 
          break;
        case 'ArrowRight': 
          if (current?.onRight?.()) break;
          moveFocus('right'); 
          break;
        case 'Enter': 
          if (current) current.onEnter?.();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [moveFocus, focusedId, nodes]);

  return (
    <NavigationContext.Provider value={{ focusedId, register, unregister, setFocus }}>
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) throw new Error('useNavigation must be used within NavigationProvider');
  return context;
};
