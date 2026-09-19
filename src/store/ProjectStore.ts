import { create } from 'zustand';
import { Project, Template } from '../types/models';
import { ProjectService } from '../database/ProjectService';
import uuid from 'react-native-uuid';

interface ProjectState {
  projects: Project[];
  templates: Template[];
  loadProjects: () => Promise<void>;
  createEmptyProject: () => Promise<Project>;
  createProjectFromTemplate: (template: Template) => Promise<Project>;
  deleteProject: (id: string) => Promise<void>;
}

// Mock Templates for Phase 6
const MOCK_TEMPLATES: Template[] = [
  {
    id: 't1',
    name: 'Cinematic Reel',
    thumbnailUri: 'https://picsum.photos/seed/cine/200/300',
    description: 'Moody, slow transitions, film grain.',
    expectedMediaCount: 3,
    timelineDataBlueprint: {
      duration: 9000,
      tracks: [
        {
          id: 'main',
          type: 'video',
          clips: [
            { id: 'bp1', type: 'video', start: 0, duration: 3000, mediaStart: 0, mediaDuration: 3000, filter: { id: 'Cinematic', name: 'Cinematic', intensity: 1 } },
            { id: 'bp2', type: 'video', start: 3000, duration: 3000, mediaStart: 0, mediaDuration: 3000, transitionIn: { id: 'Fade', name: 'Fade', durationMs: 500 } },
            { id: 'bp3', type: 'video', start: 6000, duration: 3000, mediaStart: 0, mediaDuration: 3000 }
          ]
        }
      ]
    }
  },
  {
    id: 't2',
    name: 'TikTok Fast Cuts',
    thumbnailUri: 'https://picsum.photos/seed/tiktok/200/300',
    description: 'Quick zooms, high energy, flashy.',
    expectedMediaCount: 5,
    timelineDataBlueprint: {
      duration: 5000,
      tracks: [
        {
          id: 'main',
          type: 'video',
          clips: [
            { id: 'bp1', type: 'video', start: 0, duration: 1000, mediaStart: 0, mediaDuration: 1000, speed: 1.5 },
            { id: 'bp2', type: 'video', start: 1000, duration: 1000, mediaStart: 0, mediaDuration: 1000 },
            { id: 'bp3', type: 'video', start: 2000, duration: 1000, mediaStart: 0, mediaDuration: 1000, effect: { id: 'Shake', name: 'Shake', intensity: 1 } },
            { id: 'bp4', type: 'video', start: 3000, duration: 1000, mediaStart: 0, mediaDuration: 1000 },
            { id: 'bp5', type: 'video', start: 4000, duration: 1000, mediaStart: 0, mediaDuration: 1000 }
          ]
        }
      ]
    }
  }
];

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  templates: MOCK_TEMPLATES,
  loadProjects: async () => {
    const projects = await ProjectService.getAllProjects();
    set({ projects });
  },
  createEmptyProject: async () => {
    const newProject: Project = {
      id: uuid.v4() as string,
      name: 'New Project',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      resolution: '1080p',
      fps: 30,
      thumbnailUri: null,
      timelineData: JSON.stringify({ duration: 0, tracks: [] })
    };
    await ProjectService.createProject(newProject);
    const projects = await ProjectService.getAllProjects();
    set({ projects });
    return newProject;
  },
  createProjectFromTemplate: async (template) => {
    const newProject: Project = {
      id: uuid.v4() as string,
      name: `${template.name} Project`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      resolution: '1080p',
      fps: 30,
      thumbnailUri: null,
      timelineData: JSON.stringify(template.timelineDataBlueprint)
    };
    await ProjectService.createProject(newProject);
    const projects = await ProjectService.getAllProjects();
    set({ projects });
    return newProject;
  },
  deleteProject: async (id: string) => {
    await ProjectService.deleteProject(id);
    const projects = await ProjectService.getAllProjects();
    set({ projects });
  }
}));
