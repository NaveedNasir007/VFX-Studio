export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  resolution: string;
  fps: number;
  thumbnailUri: string | null;
  timelineData: string; // JSON string of TimelineData
}

export interface TimelineData {
  duration: number;
  tracks: Track[];
}

export interface Track {
  id: string;
  type: 'video' | 'audio' | 'text' | 'effect';
  clips: Clip[];
}

export interface Clip {
  id: string;
  mediaUri: string;
  type: 'video' | 'image' | 'audio';
  start: number;
  duration: number;
  mediaStart: number;
  mediaDuration: number;
}
