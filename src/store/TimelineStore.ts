import { create } from 'zustand';
import { TimelineData, Clip, Track, TransitionData, EffectData, KeyframeData, ChromaKeyData, MaskData } from '../types/models';
import uuid from 'react-native-uuid';
import { ProjectService } from '../database/ProjectService';
import { Project } from '../types/models';

interface TimelineState {
  currentProject: Project | null;
  timelineData: TimelineData;
  selectedClipId: string | null;

  // Phase 1
  loadProjectTimeline: (project: Project) => void;
  addClipsToMainTrack: (assets: any[]) => Promise<void>;
  saveTimelineToProject: () => Promise<void>;

  // Phase 2
  selectClip: (clipId: string | null) => void;
  deleteClip: (clipId: string) => Promise<void>;
  splitClip: (clipId: string, splitTimeAtTimeline: number) => Promise<void>;
  trimClip: (clipId: string, startTrimAmount: number, endTrimAmount: number) => Promise<void>;
  reorderClips: (trackId: string, fromIndex: number, toIndex: number) => Promise<void>;

  // Phase 3
  addTextClip: (text: string, startMs: number, durationMs?: number) => Promise<void>;
  addAudioClip: (mediaUri: string, startMs: number, mediaDuration: number) => Promise<void>;
  updateClipProperties: (clipId: string, updates: Partial<Clip>) => Promise<void>;

  // Phase 4
  updateClipSpeed: (clipId: string, speedMultiplier: number) => Promise<void>;
  toggleClipReverse: (clipId: string) => Promise<void>;
  applyTransition: (clipId: string, transition: TransitionData, position: 'in' | 'out') => Promise<void>;
  applyEffect: (clipId: string, effect: EffectData) => Promise<void>;
  insertFreezeFrame: (clipId: string, atTimelineMs: number) => Promise<void>;

  // Phase 5
  addOverlayClip: (mediaUri: string, type: 'video'|'image', startMs: number, durationMs: number) => Promise<void>;
  updateChromaKey: (clipId: string, chromaKey: ChromaKeyData) => Promise<void>;
  updateMask: (clipId: string, mask: MaskData) => Promise<void>;
  addKeyframe: (clipId: string, relativeTimeMs: number, property: KeyframeData['property'], value: KeyframeData['value']) => Promise<void>;
}

const recalculateTrackTiming = (tracks: Track[]) => {
  let maxDuration = 0;

  const updatedTracks = tracks.map(track => {
    if (track.type === 'video' && track.id === 'main' && !track.isOverlay) {
      let currentStart = 0;
      const updatedClips = track.clips.map(clip => {
        let calculatedDuration = clip.duration;
        if (clip.speed && clip.speed !== 1) {
           calculatedDuration = Math.round((clip.mediaDuration - clip.mediaStart) / clip.speed);
        }
        const updatedClip = { ...clip, start: currentStart, duration: calculatedDuration };
        currentStart += calculatedDuration;
        return updatedClip;
      });
      if (currentStart > maxDuration) maxDuration = currentStart;
      return { ...track, clips: updatedClips };
    } else {
      track.clips.forEach(clip => {
        const end = clip.start + clip.duration;
        if (end > maxDuration) maxDuration = end;
      });
      return track;
    }
  });

  return { tracks: updatedTracks, duration: maxDuration };
};

export const useTimelineStore = create<TimelineState>((set, get) => ({
  currentProject: null,
  timelineData: { duration: 0, tracks: [] },
  selectedClipId: null,

  loadProjectTimeline: (project) => {
    try {
      const parsedData = JSON.parse(project.timelineData);
      const { tracks, duration } = recalculateTrackTiming(parsedData.tracks || []);
      set({ currentProject: project, timelineData: { tracks, duration }, selectedClipId: null });
    } catch (e) {
      set({ currentProject: project, timelineData: { duration: 0, tracks: [] }, selectedClipId: null });
    }
  },

  selectClip: (clipId) => set({ selectedClipId: clipId }),

  addClipsToMainTrack: async (assets) => {
    const { timelineData, saveTimelineToProject } = get();
    let mainTrackIndex = timelineData.tracks.findIndex(t => t.type === 'video' && t.id === 'main');
    let tracks = [...timelineData.tracks];

    if (mainTrackIndex === -1) {
      tracks.unshift({ id: 'main', type: 'video', clips: [], isOverlay: false });
      mainTrackIndex = 0;
    }

    const mainTrack = { ...tracks[mainTrackIndex] };
    const newClips: Clip[] = assets.map(asset => {
      const duration = asset.type === 'video' && asset.duration ? asset.duration : 3000;
      return {
        id: uuid.v4() as string,
        mediaUri: asset.uri,
        type: asset.type === 'video' ? 'video' : 'image',
        start: 0,
        duration: duration,
        mediaStart: 0,
        mediaDuration: duration
      };
    });

    mainTrack.clips = [...mainTrack.clips, ...newClips];
    tracks[mainTrackIndex] = mainTrack;

    const { tracks: recalculatedTracks, duration } = recalculateTrackTiming(tracks);
    set({ timelineData: { tracks: recalculatedTracks, duration } });
    await saveTimelineToProject();
  },

  addTextClip: async (text, startMs, durationMs = 3000) => {
    const { timelineData, saveTimelineToProject } = get();
    let textTrackIndex = timelineData.tracks.findIndex(t => t.type === 'text');
    let tracks = [...timelineData.tracks];

    if (textTrackIndex === -1) {
      tracks.push({ id: `text_${uuid.v4()}`, type: 'text', clips: [] });
      textTrackIndex = tracks.length - 1;
    }

    const textClip: Clip = {
      id: uuid.v4() as string,
      type: 'text',
      start: startMs,
      duration: durationMs,
      mediaStart: 0,
      mediaDuration: durationMs,
      textData: {
        text,
        color: '#FFFFFF',
        fontSize: 32,
        alignment: 'center'
      }
    };

    const textTrack = { ...tracks[textTrackIndex] };
    textTrack.clips = [...textTrack.clips, textClip];
    tracks[textTrackIndex] = textTrack;

    const { tracks: recalculatedTracks, duration } = recalculateTrackTiming(tracks);
    set({ timelineData: { tracks: recalculatedTracks, duration } });
    await saveTimelineToProject();
  },

  addAudioClip: async (mediaUri, startMs, mediaDuration) => {
    const { timelineData, saveTimelineToProject } = get();
    let audioTrackIndex = timelineData.tracks.findIndex(t => t.type === 'audio');
    let tracks = [...timelineData.tracks];

    if (audioTrackIndex === -1) {
      tracks.push({ id: `audio_${uuid.v4()}`, type: 'audio', clips: [] });
      audioTrackIndex = tracks.length - 1;
    }

    const audioClip: Clip = {
      id: uuid.v4() as string,
      mediaUri,
      type: 'audio',
      start: startMs,
      duration: mediaDuration,
      mediaStart: 0,
      mediaDuration: mediaDuration,
    };

    const audioTrack = { ...tracks[audioTrackIndex] };
    audioTrack.clips = [...audioTrack.clips, audioClip];
    tracks[audioTrackIndex] = audioTrack;

    const { tracks: recalculatedTracks, duration } = recalculateTrackTiming(tracks);
    set({ timelineData: { tracks: recalculatedTracks, duration } });
    await saveTimelineToProject();
  },

  updateClipProperties: async (clipId, updates) => {
    const { timelineData, saveTimelineToProject } = get();
    let modified = false;
    const updatedTracks = timelineData.tracks.map(track => {
      const clipIndex = track.clips.findIndex(c => c.id === clipId);
      if (clipIndex === -1) return track;
      const newClips = [...track.clips];
      newClips[clipIndex] = { ...newClips[clipIndex], ...updates };
      modified = true;
      return { ...track, clips: newClips };
    });

    if (modified) {
      const { tracks, duration } = recalculateTrackTiming(updatedTracks);
      set({ timelineData: { tracks, duration } });
      await saveTimelineToProject();
    }
  },

  deleteClip: async (clipId: string) => {
    const { timelineData, selectedClipId, saveTimelineToProject } = get();
    const updatedTracks = timelineData.tracks.map(track => ({
      ...track,
      clips: track.clips.filter(c => c.id !== clipId)
    }));
    const { tracks, duration } = recalculateTrackTiming(updatedTracks);
    set({ timelineData: { tracks, duration }, selectedClipId: selectedClipId === clipId ? null : selectedClipId });
    await saveTimelineToProject();
  },

  splitClip: async (clipId: string, splitTimeAtTimeline: number) => {
    const { timelineData, saveTimelineToProject } = get();
    let modified = false;
    const updatedTracks = timelineData.tracks.map(track => {
      const clipIndex = track.clips.findIndex(c => c.id === clipId);
      if (clipIndex === -1) return track;

      const clip = track.clips[clipIndex];
      if (splitTimeAtTimeline <= clip.start || splitTimeAtTimeline >= clip.start + clip.duration) {
        return track;
      }

      const splitOffset = splitTimeAtTimeline - clip.start;
      const speed = clip.speed || 1;
      const splitMediaOffset = splitOffset * speed;

      const firstHalf: Clip = { ...clip, duration: splitOffset };
      const secondHalf: Clip = {
        ...clip,
        id: uuid.v4() as string,
        mediaStart: clip.mediaStart + splitMediaOffset,
        start: clip.start + splitOffset,
        duration: clip.duration - splitOffset
      };

      const newClips = [...track.clips];
      newClips.splice(clipIndex, 1, firstHalf, secondHalf);
      modified = true;
      return { ...track, clips: newClips };
    });

    if (modified) {
      const { tracks, duration } = recalculateTrackTiming(updatedTracks);
      set({ timelineData: { tracks, duration } });
      await saveTimelineToProject();
    }
  },

  trimClip: async (clipId: string, startTrimAmount: number, endTrimAmount: number) => {
    const { timelineData, saveTimelineToProject } = get();
    const updatedTracks = timelineData.tracks.map(track => {
      const clipIndex = track.clips.findIndex(c => c.id === clipId);
      if (clipIndex === -1) return track;

      const clip = track.clips[clipIndex];
      const speed = clip.speed || 1;
      const newDuration = Math.max(100, clip.duration - startTrimAmount - endTrimAmount);
      const actualTrimStart = clip.duration - newDuration - endTrimAmount;

      const updatedClip: Clip = {
        ...clip,
        mediaStart: clip.mediaStart + (actualTrimStart * speed),
        start: track.id !== 'main' ? clip.start + startTrimAmount : clip.start,
        duration: newDuration
      };

      const newClips = [...track.clips];
      newClips[clipIndex] = updatedClip;
      return { ...track, clips: newClips };
    });

    const { tracks, duration } = recalculateTrackTiming(updatedTracks);
    set({ timelineData: { tracks, duration } });
    await saveTimelineToProject();
  },

  reorderClips: async (trackId: string, fromIndex: number, toIndex: number) => {
    const { timelineData, saveTimelineToProject } = get();
    const updatedTracks = timelineData.tracks.map(track => {
      if (track.id !== trackId || track.id !== 'main') return track;
      const newClips = [...track.clips];
      const [movedClip] = newClips.splice(fromIndex, 1);
      newClips.splice(toIndex, 0, movedClip);
      return { ...track, clips: newClips };
    });

    const { tracks, duration } = recalculateTrackTiming(updatedTracks);
    set({ timelineData: { tracks, duration } });
    await saveTimelineToProject();
  },

  updateClipSpeed: async (clipId: string, speedMultiplier: number) => {
    const { updateClipProperties } = get();
    await updateClipProperties(clipId, { speed: speedMultiplier });
  },

  toggleClipReverse: async (clipId: string) => {
    const { timelineData, updateClipProperties } = get();
    let current = false;
    timelineData.tracks.forEach(t => t.clips.forEach(c => { if(c.id === clipId) current = !!c.isReversed }));
    await updateClipProperties(clipId, { isReversed: !current });
  },

  applyTransition: async (clipId: string, transition: TransitionData, position: 'in' | 'out') => {
    const { updateClipProperties } = get();
    if (position === 'in') {
      await updateClipProperties(clipId, { transitionIn: transition });
    } else {
      await updateClipProperties(clipId, { transitionOut: transition });
    }
  },

  applyEffect: async (clipId: string, effect: EffectData) => {
    const { updateClipProperties } = get();
    await updateClipProperties(clipId, { effect });
  },

  insertFreezeFrame: async (clipId: string, atTimelineMs: number) => {
    const { timelineData, splitClip, saveTimelineToProject } = get();
    await splitClip(clipId, atTimelineMs);
    const currentData = get().timelineData;
    let modified = false;
    const updatedTracks = currentData.tracks.map(track => {
      if (track.id !== 'main') return track;
      const secondHalfIndex = track.clips.findIndex(c => c.start === atTimelineMs && c.type === 'video');
      if (secondHalfIndex > 0) {
        const firstHalf = track.clips[secondHalfIndex - 1];
        const freezeClip: Clip = {
          id: uuid.v4() as string,
          mediaUri: firstHalf.mediaUri,
          type: 'image',
          start: atTimelineMs,
          duration: 3000,
          mediaStart: firstHalf.mediaStart + (firstHalf.duration * (firstHalf.speed || 1)),
          mediaDuration: 3000
        };
        const newClips = [...track.clips];
        newClips.splice(secondHalfIndex, 0, freezeClip);
        modified = true;
        return { ...track, clips: newClips };
      }
      return track;
    });

    if (modified) {
      const { tracks, duration } = recalculateTrackTiming(updatedTracks);
      set({ timelineData: { tracks, duration } });
      await saveTimelineToProject();
    }
  },

  // Phase 5 Methods
  addOverlayClip: async (mediaUri, type, startMs, durationMs) => {
    const { timelineData, saveTimelineToProject } = get();
    let overlayTrackIndex = timelineData.tracks.findIndex(t => t.isOverlay);
    let tracks = [...timelineData.tracks];

    if (overlayTrackIndex === -1) {
      tracks.push({ id: `overlay_${uuid.v4()}`, type: 'video', isOverlay: true, clips: [] });
      overlayTrackIndex = tracks.length - 1;
    }

    const overlayClip: Clip = {
      id: uuid.v4() as string,
      mediaUri,
      type,
      start: startMs,
      duration: durationMs,
      mediaStart: 0,
      mediaDuration: durationMs,
      scale: 0.5, // Start overlays at 50% scale
      positionX: 0,
      positionY: 0
    };

    const overlayTrack = { ...tracks[overlayTrackIndex] };
    overlayTrack.clips = [...overlayTrack.clips, overlayClip];
    tracks[overlayTrackIndex] = overlayTrack;

    const { tracks: recalculatedTracks, duration } = recalculateTrackTiming(tracks);
    set({ timelineData: { tracks: recalculatedTracks, duration } });
    await saveTimelineToProject();
  },

  updateChromaKey: async (clipId, chromaKey) => {
    await get().updateClipProperties(clipId, { chromaKey });
  },

  updateMask: async (clipId, mask) => {
    await get().updateClipProperties(clipId, { mask });
  },

  addKeyframe: async (clipId, relativeTimeMs, property, value) => {
    const { timelineData, updateClipProperties } = get();
    let currentKeyframes: KeyframeData[] = [];

    // Find existing keyframes
    for (const track of timelineData.tracks) {
      const clip = track.clips.find(c => c.id === clipId);
      if (clip && clip.keyframes) {
        currentKeyframes = [...clip.keyframes];
        break;
      }
    }

    // Replace if exact time/prop exists, else push
    const existingIndex = currentKeyframes.findIndex(k => k.timeMs === relativeTimeMs && k.property === property);
    const newKeyframe: KeyframeData = { id: uuid.v4() as string, timeMs: relativeTimeMs, property, value };

    if (existingIndex >= 0) {
      currentKeyframes[existingIndex] = newKeyframe;
    } else {
      currentKeyframes.push(newKeyframe);
    }

    // Sort chronological
    currentKeyframes.sort((a, b) => a.timeMs - b.timeMs);

    await updateClipProperties(clipId, { keyframes: currentKeyframes });
  },

  saveTimelineToProject: async () => {
    const { currentProject, timelineData } = get();
    if (!currentProject) return;

    const mainTrack = timelineData.tracks.find(t => t.id === 'main');
    const updatedProject = {
      ...currentProject,
      timelineData: JSON.stringify(timelineData),
      thumbnailUri: currentProject.thumbnailUri ||
                   (mainTrack?.clips[0]?.mediaUri ?? null)
    };

    await ProjectService.updateProject(updatedProject);
    set({ currentProject: updatedProject });
  }
}));
