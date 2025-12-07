// Types for TL Map implementation

export interface TLMapData {
  _id?: string;
  name: string;
  snapshot: any; // tldraw snapshot data
  isPrivate: boolean;
  createdAt?: string;
  updatedAt?: string;
  lastSaved?: string;
}

export interface SavedTLMap extends TLMapData {
  _id: string;
  user: {
    _id: string;
    username: string;
    badge?: string;
  };
}
