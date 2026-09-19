import { create } from 'zustand';
import { TimelineData, Clip, Track, TextData, FilterData, Adjustments } from '../types/models';
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
}

const recalculateTrackTiming = (tracks: Track[]) => {
  let maxDuration = 0;

  const updatedTracks = tracks.map(track => {
    // Only auto-sequence clips on the main video track
    // Audio and Text layers are typically freely positioned (absolute timing)
    if (track.type === 'video' && track.id === 'main') {
      let currentStart = 0;
      const updatedClips = track.clips.map(clip => {
        const updatedClip = { ...clip, start: currentStart };
        currentStart += clip.duration;
        return updatedClip;
      });
      if (currentStart > maxDuration) maxDuration = currentStart;
      return { ...track, clips: updatedClips };
    } else {
      // Free positioning tracks (text, audio, overlay video)
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
      tracks.unshift({ id: 'main', type: 'video', clips: [] });
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
      // Create new text track
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
      const firstHalf: Clip = { ...clip, duration: splitOffset };
      const secondHalf: Clip = {
        ...clip,
        id: uuid.v4() as string,
        mediaStart: clip.mediaStart + splitOffset,
        start: clip.start + splitOffset, // Needed for freely positioned clips
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
      const newDuration = Math.max(100, clip.duration - startTrimAmount - endTrimAmount);
      const actualTrimStart = clip.duration - newDuration - endTrimAmount;

      const updatedClip: Clip = {
        ...clip,
        mediaStart: clip.mediaStart + actualTrimStart,
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
      if (track.id !== trackId || track.id !== 'main') return track; // Only reorder on sequenced track for now
      const newClips = [...track.clips];
      const [movedClip] = newClips.splice(fromIndex, 1);
      newClips.splice(toIndex, 0, movedClip);
      return { ...track, clips: newClips };
    });

    const { tracks, duration } = recalculateTrackTiming(updatedTracks);
    set({ timelineData: { tracks, duration } });
    await saveTimelineToProject();
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
