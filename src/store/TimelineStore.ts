import { create } from 'zustand';
import { TimelineData, Clip, Track } from '../types/models';
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
}

// Utility to recalculate timeline starts and total duration based on clips lengths in a sequence
const recalculateTrackTiming = (tracks: Track[]) => {
  let maxDuration = 0;

  const updatedTracks = tracks.map(track => {
    let currentStart = 0;
    const updatedClips = track.clips.map(clip => {
      const updatedClip = { ...clip, start: currentStart };
      currentStart += clip.duration;
      return updatedClip;
    });
    if (currentStart > maxDuration) {
      maxDuration = currentStart;
    }
    return { ...track, clips: updatedClips };
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
      // Ensure timings are calculated correctly on load just in case
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
        start: 0, // Will be recalculated
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

  deleteClip: async (clipId: string) => {
    const { timelineData, selectedClipId, saveTimelineToProject } = get();

    const updatedTracks = timelineData.tracks.map(track => ({
      ...track,
      clips: track.clips.filter(c => c.id !== clipId)
    }));

    const { tracks, duration } = recalculateTrackTiming(updatedTracks);

    set({
      timelineData: { tracks, duration },
      selectedClipId: selectedClipId === clipId ? null : selectedClipId
    });

    await saveTimelineToProject();
  },

  splitClip: async (clipId: string, splitTimeAtTimeline: number) => {
    const { timelineData, saveTimelineToProject } = get();

    let modified = false;
    const updatedTracks = timelineData.tracks.map(track => {
      const clipIndex = track.clips.findIndex(c => c.id === clipId);
      if (clipIndex === -1) return track;

      const clip = track.clips[clipIndex];
      // Verify split point is within clip
      if (splitTimeAtTimeline <= clip.start || splitTimeAtTimeline >= clip.start + clip.duration) {
        return track;
      }

      const splitOffset = splitTimeAtTimeline - clip.start;

      const firstHalf: Clip = {
        ...clip,
        duration: splitOffset
      };

      const secondHalf: Clip = {
        ...clip,
        id: uuid.v4() as string,
        mediaStart: clip.mediaStart + splitOffset,
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
    // startTrimAmount > 0 means shaving off from start (e.g. 500ms)
    // endTrimAmount > 0 means shaving off from end
    const { timelineData, saveTimelineToProject } = get();

    const updatedTracks = timelineData.tracks.map(track => {
      const clipIndex = track.clips.findIndex(c => c.id === clipId);
      if (clipIndex === -1) return track;

      const clip = track.clips[clipIndex];
      const newDuration = Math.max(100, clip.duration - startTrimAmount - endTrimAmount); // minimum 100ms
      const actualTrimStart = clip.duration - newDuration - endTrimAmount; // Adjust in case it hit the 100ms floor

      const updatedClip: Clip = {
        ...clip,
        mediaStart: clip.mediaStart + actualTrimStart,
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
      if (track.id !== trackId) return track;

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

    const updatedProject = {
      ...currentProject,
      timelineData: JSON.stringify(timelineData),
      thumbnailUri: currentProject.thumbnailUri ||
                   (timelineData.tracks[0]?.clips[0]?.mediaUri ?? null)
    };

    await ProjectService.updateProject(updatedProject);
    set({ currentProject: updatedProject });
  }
}));
