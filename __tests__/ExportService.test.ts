import { ExportService } from '../src/core/ExportService';
import { TimelineData } from '../src/types/models';

jest.mock('ffmpeg-kit-react-native', () => ({
  FFmpegKit: {
    executeAsync: jest.fn(),
    cancel: jest.fn()
  },
  FFmpegKitConfig: {
    enableStatisticsCallback: jest.fn()
  },
  ReturnCode: {
    isSuccess: jest.fn(),
    isCancel: jest.fn()
  }
}));

describe('ExportService Command Builder', () => {
  it('builds a valid concatenation command for multiple clips', () => {
    const mockTimeline: TimelineData = {
      duration: 5000,
      tracks: [
        {
          id: 'main',
          type: 'video',
          clips: [
            { id: '1', mediaUri: 'file1.mp4', type: 'video', start: 0, duration: 2500, mediaStart: 0, mediaDuration: 2500 },
            { id: '2', mediaUri: 'file2.mp4', type: 'video', start: 2500, duration: 2500, mediaStart: 0, mediaDuration: 2500 }
          ]
        }
      ]
    };

    const result = ExportService.buildFFmpegCommand(mockTimeline, { resolution: '1080p', fps: 30, quality: 'high' }, 'out.mp4');

    expect(result.command).toContain('-i "file1.mp4"');
    expect(result.command).toContain('-i "file2.mp4"');
    expect(result.command).toContain('scale=1920:1080');
    expect(result.command).toContain('fps=30');
    expect(result.command).toContain('concat=n=2:v=1:a=0[main_video]');
    expect(result.command).toContain('-map "[main_video]"');
    expect(result.command).toContain('-c:v libx264');
    expect(result.command).toContain('out.mp4');
  });

  it('adjusts resolution scaling appropriately', () => {
    const mockTimeline: TimelineData = {
      duration: 1000,
      tracks: [
        {
          id: 'main',
          type: 'video',
          clips: [
            { id: '1', mediaUri: 'file.mp4', type: 'video', start: 0, duration: 1000, mediaStart: 0, mediaDuration: 1000 },
          ]
        }
      ]
    };

    const result720 = ExportService.buildFFmpegCommand(mockTimeline, { resolution: '720p', fps: 24, quality: 'low' }, 'out.mp4');
    expect(result720.command).toContain('scale=1280:720');
    expect(result720.command).toContain('fps=24');
    expect(result720.command).toContain('-b:v 2M');

    const result4k = ExportService.buildFFmpegCommand(mockTimeline, { resolution: '4k', fps: 60, quality: 'high' }, 'out.mp4');
    expect(result4k.command).toContain('scale=3840:2160');
    expect(result4k.command).toContain('fps=60');
    expect(result4k.command).toContain('-b:v 10M');
  });

  it('throws an error if no main track is found', () => {
    const mockTimeline: TimelineData = { duration: 0, tracks: [] };
    expect(() => {
      ExportService.buildFFmpegCommand(mockTimeline, { resolution: '1080p', fps: 30, quality: 'high' }, 'out.mp4');
    }).toThrow("No main video track found to export.");
  });
});
