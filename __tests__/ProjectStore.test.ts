import { useProjectStore } from '../src/store/ProjectStore';
import { ProjectService } from '../src/database/ProjectService';
import uuid from 'react-native-uuid';

jest.mock('../src/database/ProjectService', () => ({
  ProjectService: {
    getAllProjects: jest.fn().mockResolvedValue([]),
    createProject: jest.fn().mockResolvedValue(undefined),
    deleteProject: jest.fn().mockResolvedValue(undefined),
    updateProject: jest.fn().mockResolvedValue(undefined)
  }
}));

describe('ProjectStore Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useProjectStore.setState({ projects: [] });
  });

  it('creates an empty project and updates state', async () => {
    const mockProjects = [
      {
        id: '1',
        name: 'New Project',
        createdAt: 1000,
        updatedAt: 1000,
        resolution: '1080p',
        fps: 30,
        thumbnailUri: null,
        timelineData: '{}'
      }
    ];

    (ProjectService.getAllProjects as jest.Mock).mockResolvedValueOnce(mockProjects);

    const project = await useProjectStore.getState().createEmptyProject();

    expect(ProjectService.createProject).toHaveBeenCalledTimes(1);
    expect(ProjectService.getAllProjects).toHaveBeenCalledTimes(1);

    expect(project.name).toBe('New Project');
    expect(project.resolution).toBe('1080p');
    expect(useProjectStore.getState().projects).toEqual(mockProjects);
  });
});
