import { useTimelineStore } from '../src/store/TimelineStore';
import { ProjectService } from '../src/database/ProjectService';
import { Clip } from '../src/types/models';

jest.mock('../src/database/ProjectService', () => ({
  ProjectService: {
    updateProject: jest.fn().mockResolvedValue(undefined)
  }
}));

describe('TimelineStore phase 4', () => {
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
              { id: 'c1', mediaUri: 'video.mp4', type: 'video', start: 0, duration: 2000, mediaStart: 0, mediaDuration: 2000 },
            ]
          }
        ]
      }
    });
  });

  it('updates clip speed and stretches/compresses duration', async () => {
    const store = useTimelineStore.getState();
    await store.updateClipSpeed('c1', 2.0);

    const newState = useTimelineStore.getState();
    const clip = newState.timelineData.tracks[0].clips[0];

    // Original media duration is 2000. At 2x speed, timeline duration should be 1000.
    expect(clip.speed).toBe(2.0);
    expect(clip.duration).toBe(1000);
    expect(newState.timelineData.duration).toBe(1000);

    // Switch to 0.5x speed
    await useTimelineStore.getState().updateClipSpeed('c1', 0.5);
    const slowState = useTimelineStore.getState();
    const slowClip = slowState.timelineData.tracks[0].clips[0];
    expect(slowClip.duration).toBe(4000);
  });

  it('inserts a freeze frame correctly', async () => {
    const store = useTimelineStore.getState();
    // Insert freeze frame at 1000ms
    await store.insertFreezeFrame('c1', 1000);

    const newState = useTimelineStore.getState();
    const clips = newState.timelineData.tracks[0].clips;

    // Should be: [first half (1000ms)] -> [freeze frame image (3000ms)] -> [second half (1000ms)]
    expect(clips).toHaveLength(3);

    expect(clips[0].id).toBe('c1');
    expect(clips[0].duration).toBe(1000);
    expect(clips[0].start).toBe(0);

    expect(clips[1].type).toBe('image');
    expect(clips[1].duration).toBe(3000);
    expect(clips[1].start).toBe(1000);

    expect(clips[2].type).toBe('video');
    expect(clips[2].duration).toBe(1000);
    expect(clips[2].start).toBe(4000); // 1000 (first) + 3000 (freeze)

    expect(newState.timelineData.duration).toBe(5000);
  });
});
