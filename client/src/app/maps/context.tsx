'use client';

import { createContext, useContext } from 'react';
import { MapElement, Connection } from './types';

export interface MapStateContextValue {
  elements: MapElement[];
  setElements: React.Dispatch<React.SetStateAction<MapElement[]>>;
  connections: Connection[];
  setConnections: React.Dispatch<React.SetStateAction<Connection[]>>;
}

export const MapStateContext = createContext<MapStateContextValue | null>(null);

export const useMapState = () => {
  const context = useContext(MapStateContext);
  if (!context) {
    throw new Error('useMapState must be used within a MapStateContext provider');
  }
  return context;
};

