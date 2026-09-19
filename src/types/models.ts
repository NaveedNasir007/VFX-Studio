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
  type: 'video' | 'audio' | 'text' | 'sticker' | 'effect';
  clips: Clip[];
}

export interface TextData {
  text: string;
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  alignment?: 'left' | 'center' | 'right';
  backgroundColor?: string;
}

export interface FilterData {
  id: string;
  name: string;
  intensity: number; // 0 to 1
}

export interface Adjustments {
  brightness?: number; // -1 to 1
  contrast?: number; // -1 to 1
  saturation?: number; // -1 to 1
  exposure?: number; // -1 to 1
  temperature?: number; // -1 to 1
}

// Phase 4
export interface EffectData {
  id: string;
  name: string;
  intensity: number; // 0 to 1
  duration?: number; // optionally limit effect to part of the clip
}

export interface TransitionData {
  id: string;
  name: string;
  durationMs: number;
}

export interface Clip {
  id: string;
  mediaUri?: string; // Optional for text/stickers
  type: 'video' | 'image' | 'audio' | 'text' | 'sticker';
  start: number;
  duration: number;
  mediaStart: number;
  mediaDuration: number;

  // Phase 3 additions
  textData?: TextData;
  filter?: FilterData;
  adjustments?: Adjustments;

  // Phase 4 additions
  speed?: number; // e.g. 0.5 for half speed, 2.0 for double speed (default is undefined or 1)
  isReversed?: boolean; // defaults to false
  effect?: EffectData;
  transitionIn?: TransitionData;
  transitionOut?: TransitionData;
}
