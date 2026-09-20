import { MediaService } from '../src/core/MediaService';
import * as VideoThumbnails from 'expo-video-thumbnails';
import * as FileSystem from 'expo-file-system';
import { FFmpegKit, ReturnCode } from 'ffmpeg-kit-react-native';

jest.mock('expo-video-thumbnails', () => ({
  getThumbnailAsync: jest.fn()
}));

jest.mock('expo-file-system', () => ({
  cacheDirectory: 'file:///cache/',
  getInfoAsync: jest.fn(),
  readDirectoryAsync: jest.fn(),
  deleteAsync: jest.fn()
}));

jest.mock('ffmpeg-kit-react-native', () => ({
  FFmpegKit: {
    execute: jest.fn()
  },
  ReturnCode: {
    isSuccess: jest.fn()
  }
}));

describe('MediaService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('generates a thumbnail correctly using expo-video-thumbnails', async () => {
    (VideoThumbnails.getThumbnailAsync as jest.Mock).mockResolvedValueOnce({ uri: 'file:///cache/thumb.jpg' });

    const result = await MediaService.generateThumbnail('video.mp4', 1000);

    expect(VideoThumbnails.getThumbnailAsync).toHaveBeenCalledWith('video.mp4', { time: 1000, quality: 0.5 });
    expect(result).toBe('file:///cache/thumb.jpg');
  });

  it('generates a 720p proxy if not already cached', async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValueOnce({ exists: false });

    const mockSession = { getReturnCode: jest.fn().mockResolvedValue(0) };
    (FFmpegKit.execute as jest.Mock).mockResolvedValueOnce(mockSession);
    (ReturnCode.isSuccess as jest.Mock).mockReturnValue(true);

    const result = await MediaService.generateProxy('video.mp4');

    expect(FileSystem.getInfoAsync).toHaveBeenCalled();
    expect(FFmpegKit.execute).toHaveBeenCalledWith(expect.stringContaining('scale=-2:720'));
    expect(result).toContain('file:///cache/proxy_video.mp4');
  });

  it('returns cached proxy if it already exists', async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValueOnce({ exists: true });

    const result = await MediaService.generateProxy('video.mp4');

    expect(FFmpegKit.execute).not.toHaveBeenCalled();
    expect(result).toContain('file:///cache/proxy_video.mp4');
  });

  it('clears cache directory properly', async () => {
    (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValueOnce(['thumb1.jpg', 'proxy1.mp4']);
    (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);

    await MediaService.clearCache();

    expect(FileSystem.readDirectoryAsync).toHaveBeenCalledWith('file:///cache/');
    expect(FileSystem.deleteAsync).toHaveBeenCalledTimes(2);
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith('file:///cache/thumb1.jpg', { idempotent: true });
  });
});
