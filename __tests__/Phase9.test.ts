import { ExportService } from '../src/core/ExportService';
import { useTimelineStore } from '../src/store/TimelineStore';
import { TimelineData } from '../src/types/models';

jest.mock('ffmpeg-kit-react-native', () => ({
  FFmpegKit: { executeAsync: jest.fn(), cancel: jest.fn() },
  FFmpegKitConfig: { enableStatisticsCallback: jest.fn() },
  ReturnCode: { isSuccess: jest.fn(), isCancel: jest.fn() }
}));

jest.mock('../src/database/ProjectService', () => ({
  ProjectService: {
    updateProject: jest.fn().mockResolvedValue(undefined)
  }
}));

describe('Phase 9 Bug Fixes', () => {
  it('ExportService outputs overlay, drawtext, and amix syntax', () => {
    const complexTimeline: TimelineData = {
      duration: 5000,
      tracks: [
        {
          id: 'main',
          type: 'video',
          clips: [
            { id: '1', mediaUri: 'file1.mp4', type: 'video', start: 0, duration: 5000, mediaStart: 0, mediaDuration: 5000 },
          ]
        },
        {
          id: 'overlay',
          type: 'video',
          isOverlay: true,
          clips: [
            { id: '2', mediaUri: 'pip.mp4', type: 'video', start: 1000, duration: 2000, mediaStart: 0, mediaDuration: 2000, scale: 0.5 }
          ]
        },
        {
          id: 'audio',
          type: 'audio',
          clips: [
            { id: '3', mediaUri: 'bgm.mp3', type: 'audio', start: 0, duration: 5000, mediaStart: 0, mediaDuration: 5000 }
          ]
        },
        {
          id: 'text',
          type: 'text',
          clips: [
            { id: '4', mediaUri: '', type: 'text', start: 2000, duration: 2000, mediaStart: 0, mediaDuration: 2000, textData: { text: "Hello" } }
          ]
        }
      ]
    };

    const result = ExportService.buildFFmpegCommand(complexTimeline, { resolution: '1080p', fps: 30, quality: 'high' }, 'out.mp4');

    // Check main scaling
    expect(result.command).toContain('scale=1920:1080');

    // Check overlay insertion
    expect(result.command).toContain('pip.mp4');
    expect(result.command).toContain('overlay=enable=\'between(t,1.00,3.00)\'');

    // Check drawtext insertion
    expect(result.command).toContain('drawtext=text=\'Hello\'');
    expect(result.command).toContain('enable=\'between(t,2.00,4.00)\'');

    // Check audio mixing insertion
    expect(result.command).toContain('bgm.mp3');
    expect(result.command).toContain('adelay=0|0');
    expect(result.command).toContain('amix=inputs=2'); // 1 main video audio + 1 external audio

    // Check output maps
    expect(result.command).toContain('-map "[vid_txt0]"'); // The final video label in this sequence
    expect(result.command).toContain('-map "[final_audio]"');
  });

  it('TimelineStore moveClipPosition successfully updates a free-moving clip', async () => {
    useTimelineStore.setState({
      currentProject: { id: 'p1', name: 'Test', timelineData: '', thumbnailUri: null } as any,
      selectedClipId: null,
      timelineData: {
        duration: 5000,
        tracks: [
          {
            id: 'overlay',
            type: 'video',
            isOverlay: true,
            clips: [
              { id: 'pip1', mediaUri: 'pip.mp4', type: 'video', start: 1000, duration: 2000, mediaStart: 0, mediaDuration: 2000, scale: 0.5 }
            ]
          }
        ]
      }
    });

    const store = useTimelineStore.getState();
    await store.moveClipPosition('pip1', 2500);

    const newState = useTimelineStore.getState();
    const movedClip = newState.timelineData.tracks[0].clips[0];

    expect(movedClip.start).toBe(2500);
    // Duration expands because 2500 start + 2000 duration = 4500
    expect(newState.timelineData.duration).toBe(4500);
  });
});
