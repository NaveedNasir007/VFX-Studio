import { ExportService } from '../src/core/ExportService';
import { TimelineData } from '../src/types/models';

jest.mock('ffmpeg-kit-react-native', () => ({
  FFmpegKit: { executeAsync: jest.fn(), cancel: jest.fn() },
  FFmpegKitConfig: { enableStatisticsCallback: jest.fn() },
  ReturnCode: { isSuccess: jest.fn(), isCancel: jest.fn() }
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
    expect(result.command).toContain('concat=n=2:v=1:a=0[base_video]'); // Fixed from [main_video] to [base_video] due to Phase 9 overlay update
    expect(result.command).toContain('-map "[base_video]"');
    expect(result.command).toContain('-c:v libx264');
    expect(result.command).toContain('out.mp4');
  });
});
