import { create } from 'zustand';
import { Project } from '../types/models';
import { ProjectService } from '../database/ProjectService';
import uuid from 'react-native-uuid';

interface ProjectState {
  projects: Project[];
  loadProjects: () => Promise<void>;
  createEmptyProject: () => Promise<Project>;
  deleteProject: (id: string) => Promise<void>;
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
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
  deleteProject: async (id: string) => {
    await ProjectService.deleteProject(id);
    const projects = await ProjectService.getAllProjects();
    set({ projects });
  }
}));
