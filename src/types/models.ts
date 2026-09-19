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
  isOverlay?: boolean; // True if it's a PIP track
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

export interface EffectData {
  id: string;
  name: string;
  intensity: number; // 0 to 1
  duration?: number;
}

export interface TransitionData {
  id: string;
  name: string;
  durationMs: number;
}

// Phase 5
export interface KeyframeData {
  id: string;
  timeMs: number; // Relative to clip start
  property: 'position' | 'scale' | 'rotation' | 'opacity' | 'effect_intensity';
  value: number | { x: number; y: number };
}

export interface ChromaKeyData {
  enabled: boolean;
  colorHex: string;
  intensity: number; // 0 to 1
  shadow: number; // 0 to 1
}

export interface MaskData {
  type: 'none' | 'rectangle' | 'circle' | 'linear';
  feather: number;
  invert: boolean;
  // Specific geometry params could be added here
}

export interface Clip {
  id: string;
  mediaUri?: string;
  type: 'video' | 'image' | 'audio' | 'text' | 'sticker';
  start: number;
  duration: number;
  mediaStart: number;
  mediaDuration: number;

  // Phase 3
  textData?: TextData;
  filter?: FilterData;
  adjustments?: Adjustments;

  // Phase 4
  speed?: number;
  isReversed?: boolean;
  effect?: EffectData;
  transitionIn?: TransitionData;
  transitionOut?: TransitionData;

  // Phase 5
  keyframes?: KeyframeData[];
  chromaKey?: ChromaKeyData;
  mask?: MaskData;

  // Base transform for PIP overlays (if no keyframes)
  scale?: number;
  positionX?: number; // percentage (-1 to 1)
  positionY?: number; // percentage (-1 to 1)
}
