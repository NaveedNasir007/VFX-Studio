import { useTimelineStore } from '../src/store/TimelineStore';
import { ProjectService } from '../src/database/ProjectService';
import { Clip } from '../src/types/models';

jest.mock('../src/database/ProjectService', () => ({
  ProjectService: {
    updateProject: jest.fn().mockResolvedValue(undefined)
  }
}));

describe('TimelineStore phase 2', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useTimelineStore.setState({
      currentProject: { id: 'p1', name: 'Test', timelineData: '', thumbnailUri: null } as any,
      selectedClipId: null,
      timelineData: {
        duration: 2000,
        tracks: [
          {
            id: 'main',
            type: 'video',
            clips: [
              { id: 'c1', mediaUri: 'video.mp4', type: 'video', start: 0, duration: 1000, mediaStart: 0, mediaDuration: 1000 },
              { id: 'c2', mediaUri: 'image.png', type: 'image', start: 1000, duration: 1000, mediaStart: 0, mediaDuration: 1000 },
            ]
          }
        ]
      }
    });
  });

  it('selects and deletes a clip and recalculates timing', async () => {
    const store = useTimelineStore.getState();
    store.selectClip('c1');
    expect(useTimelineStore.getState().selectedClipId).toBe('c1');

    await store.deleteClip('c1');

    const newState = useTimelineStore.getState();
    expect(newState.selectedClipId).toBeNull();
    expect(newState.timelineData.tracks[0].clips).toHaveLength(1);

    // Remaining clip (c2) should slide to start=0
    const remainingClip = newState.timelineData.tracks[0].clips[0];
    expect(remainingClip.id).toBe('c2');
    expect(remainingClip.start).toBe(0);
    expect(newState.timelineData.duration).toBe(1000);
  });

  it('splits a clip properly and adjusts durations and starts', async () => {
    const store = useTimelineStore.getState();
    await store.splitClip('c1', 500);

    const newState = useTimelineStore.getState();
    const clips = newState.timelineData.tracks[0].clips;

    expect(clips).toHaveLength(3);

    // First half
    expect(clips[0].id).toBe('c1');
    expect(clips[0].start).toBe(0);
    expect(clips[0].duration).toBe(500);
    expect(clips[0].mediaStart).toBe(0);

    // Second half (new id generated)
    expect(clips[1].id).not.toBe('c1');
    expect(clips[1].start).toBe(500);
    expect(clips[1].duration).toBe(500);
    expect(clips[1].mediaStart).toBe(500); // mediaStart shifted

    // Third clip (originally c2) shifts starts safely
    expect(clips[2].id).toBe('c2');
    expect(clips[2].start).toBe(1000);

    expect(newState.timelineData.duration).toBe(2000);
  });

  it('does not split if outside clip bounds', async () => {
    const store = useTimelineStore.getState();
    await store.splitClip('c1', 1500); // 1500 is in c2, not c1

    const newState = useTimelineStore.getState();
    expect(newState.timelineData.tracks[0].clips).toHaveLength(2);
  });
});
