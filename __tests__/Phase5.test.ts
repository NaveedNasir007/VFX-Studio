import { useTimelineStore } from '../src/store/TimelineStore';
import { ProjectService } from '../src/database/ProjectService';
import { Clip } from '../src/types/models';

jest.mock('../src/database/ProjectService', () => ({
  ProjectService: {
    updateProject: jest.fn().mockResolvedValue(undefined)
  }
}));

describe('TimelineStore phase 5', () => {
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

  it('adds an overlay clip on a new track correctly', async () => {
    const store = useTimelineStore.getState();
    await store.addOverlayClip('overlay.mp4', 'video', 500, 1000);

    const newState = useTimelineStore.getState();

    expect(newState.timelineData.tracks).toHaveLength(2);
    const overlayTrack = newState.timelineData.tracks.find(t => t.isOverlay);
    expect(overlayTrack).toBeDefined();

    const clip = overlayTrack?.clips[0];
    expect(clip?.type).toBe('video');
    expect(clip?.scale).toBe(0.5); // Default scale
    expect(clip?.start).toBe(500);
    expect(clip?.duration).toBe(1000);

    // Overall duration shouldn't change since it's within the main track duration (0-2000)
    expect(newState.timelineData.duration).toBe(2000);
  });

  it('adds a keyframe to a clip, overriding duplicate times', async () => {
    const store = useTimelineStore.getState();
    await store.addKeyframe('c1', 1000, 'scale', 1.5);

    let newState = useTimelineStore.getState();
    let clip = newState.timelineData.tracks[0].clips[0];

    expect(clip.keyframes).toHaveLength(1);
    expect(clip.keyframes![0].timeMs).toBe(1000);
    expect(clip.keyframes![0].property).toBe('scale');
    expect(clip.keyframes![0].value).toBe(1.5);

    // Overwrite the same keyframe
    await useTimelineStore.getState().addKeyframe('c1', 1000, 'scale', 2.0);

    newState = useTimelineStore.getState();
    clip = newState.timelineData.tracks[0].clips[0];

    expect(clip.keyframes).toHaveLength(1); // Still 1
    expect(clip.keyframes![0].value).toBe(2.0); // Value updated
  });

  it('updates mask properties correctly', async () => {
    const store = useTimelineStore.getState();
    await store.updateMask('c1', { type: 'circle', feather: 0.5, invert: true });

    const newState = useTimelineStore.getState();
    const clip = newState.timelineData.tracks[0].clips[0];

    expect(clip.mask).toBeDefined();
    expect(clip.mask?.type).toBe('circle');
    expect(clip.mask?.feather).toBe(0.5);
  });
});
