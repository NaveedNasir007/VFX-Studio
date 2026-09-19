import { create } from 'zustand';
import { TimelineData, Clip } from '../types/models';
import uuid from 'react-native-uuid';
import { ProjectService } from '../database/ProjectService';
import { Project } from '../types/models';

interface TimelineState {
  currentProject: Project | null;
  timelineData: TimelineData;
  loadProjectTimeline: (project: Project) => void;
  addClipsToMainTrack: (assets: any[]) => Promise<void>;
  saveTimelineToProject: () => Promise<void>;
}

export const useTimelineStore = create<TimelineState>((set, get) => ({
  currentProject: null,
  timelineData: { duration: 0, tracks: [] },

  loadProjectTimeline: (project) => {
    try {
      const parsedData = JSON.parse(project.timelineData);
      set({ currentProject: project, timelineData: parsedData });
    } catch (e) {
      set({ currentProject: project, timelineData: { duration: 0, tracks: [] } });
    }
  },

  addClipsToMainTrack: async (assets) => {
    const { timelineData, currentProject, saveTimelineToProject } = get();
    if (!currentProject) return;

    let mainTrack = timelineData.tracks.find(t => t.type === 'video' && t.id === 'main');

    if (!mainTrack) {
      mainTrack = { id: 'main', type: 'video', clips: [] };
      timelineData.tracks.unshift(mainTrack);
    }

    let currentStart = mainTrack.clips.reduce((acc, clip) => acc + clip.duration, 0);

    const newClips: Clip[] = assets.map(asset => {
      // expo-image-picker asset duration is in ms if it's a video
      const duration = asset.type === 'video' && asset.duration ? asset.duration : 3000; // 3 seconds default for images

      const clip: Clip = {
        id: uuid.v4() as string,
        mediaUri: asset.uri,
        type: asset.type === 'video' ? 'video' : 'image',
        start: currentStart,
        duration: duration,
        mediaStart: 0,
        mediaDuration: duration
      };

      currentStart += duration;
      return clip;
    });

    mainTrack.clips.push(...newClips);

    // Update total timeline duration
    const newTotalDuration = Math.max(timelineData.duration, currentStart);

    const updatedTimelineData = {
      ...timelineData,
      duration: newTotalDuration
    };

    set({ timelineData: updatedTimelineData });
    await saveTimelineToProject();
  },

  saveTimelineToProject: async () => {
    const { currentProject, timelineData } = get();
    if (!currentProject) return;

    const updatedProject = {
      ...currentProject,
      timelineData: JSON.stringify(timelineData),
      // Update thumbnail if main track has clips and no thumbnail exists
      thumbnailUri: currentProject.thumbnailUri ||
                   (timelineData.tracks[0]?.clips[0]?.mediaUri ?? null)
    };

    await ProjectService.updateProject(updatedProject);
    set({ currentProject: updatedProject });
  }
}));
