import { useTimelineStore } from '../src/store/TimelineStore';
import { ProjectService } from '../src/database/ProjectService';
import { Clip } from '../src/types/models';

jest.mock('../src/database/ProjectService', () => ({
  ProjectService: {
    updateProject: jest.fn().mockResolvedValue(undefined)
  }
}));

describe('TimelineStore phase 3', () => {
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
    expect(clips[0].id).toBe('c1');
    expect(clips[0].start).toBe(0);
    expect(clips[0].duration).toBe(500);

    expect(clips[1].id).not.toBe('c1');
    expect(clips[1].start).toBe(500);
    expect(clips[1].duration).toBe(500);
    expect(clips[1].mediaStart).toBe(500);
    expect(newState.timelineData.duration).toBe(2000);
  });

  it('adds a text clip correctly', async () => {
    const store = useTimelineStore.getState();
    await store.addTextClip('Hello World', 500, 2000);

    const newState = useTimelineStore.getState();
    const textTrack = newState.timelineData.tracks.find(t => t.type === 'text');
    expect(textTrack).toBeDefined();
    expect(textTrack?.clips).toHaveLength(1);

    const textClip = textTrack?.clips[0];
    expect(textClip?.textData?.text).toBe('Hello World');
    expect(textClip?.start).toBe(500);
    expect(textClip?.duration).toBe(2000);

    // Adding text beyond current duration updates overall duration
    expect(newState.timelineData.duration).toBe(2500);
  });

  it('adds an audio clip correctly', async () => {
    const store = useTimelineStore.getState();
    await store.addAudioClip('audio.mp3', 0, 5000);

    const newState = useTimelineStore.getState();
    const audioTrack = newState.timelineData.tracks.find(t => t.type === 'audio');
    expect(audioTrack).toBeDefined();

    const audioClip = audioTrack?.clips[0];
    expect(audioClip?.type).toBe('audio');
    expect(audioClip?.duration).toBe(5000);
    expect(newState.timelineData.duration).toBe(5000);
  });

  it('updates clip properties correctly', async () => {
    const store = useTimelineStore.getState();
    await store.updateClipProperties('c1', { filter: { id: 'Vintage', name: 'Vintage', intensity: 0.8 } });

    const newState = useTimelineStore.getState();
    const clip = newState.timelineData.tracks[0].clips[0];
    expect(clip.filter).toBeDefined();
    expect(clip.filter?.name).toBe('Vintage');
  });
});
