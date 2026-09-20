import * as VideoThumbnails from 'expo-video-thumbnails';
import * as FileSystem from 'expo-file-system';
import { FFmpegKit, ReturnCode } from 'ffmpeg-kit-react-native';

export class MediaService {
  /**
   * Extracts a thumbnail from a video file efficiently.
   */
  static async generateThumbnail(videoUri: string, timeMs: number = 0): Promise<string | null> {
    try {
      const { uri } = await VideoThumbnails.getThumbnailAsync(
        videoUri,
        {
          time: timeMs,
          quality: 0.5, // 50% JPEG quality for memory efficiency
        }
      );
      return uri;
    } catch (e) {
      console.warn("Thumbnail generation failed:", e);
      return null;
    }
  }

  /**
   * Generates a fast-decoding, 720p proxy video for smooth timeline scrubbing.
   * Caches the output in the app's cache directory.
   */
  static async generateProxy(videoUri: string): Promise<string | null> {
    try {
      const fileName = videoUri.split('/').pop() || `proxy_${Date.now()}`;
      const proxyUri = `${FileSystem.cacheDirectory}proxy_${fileName}.mp4`;

      // Check if proxy already exists in cache
      const fileInfo = await FileSystem.getInfoAsync(proxyUri);
      if (fileInfo.exists) {
        return proxyUri;
      }

      // Generate proxy using extremely fast preset, scaling down to max 720p height, preserving aspect ratio
      const command = `-i "${videoUri}" -vf "scale=-2:720" -c:v libx264 -preset ultrafast -crf 28 -an "${proxyUri}"`;

      const session = await FFmpegKit.execute(command);
      const returnCode = await session.getReturnCode();

      if (ReturnCode.isSuccess(returnCode)) {
        return proxyUri;
      }

      return null;
    } catch (e) {
      console.warn("Proxy generation failed:", e);
      return null;
    }
  }

  /**
   * Cleans up all generated proxies and thumbnails from the cache to free up space.
   */
  static async clearCache(): Promise<void> {
    try {
      const cacheDir = FileSystem.cacheDirectory;
      if (!cacheDir) return;

      const files = await FileSystem.readDirectoryAsync(cacheDir);
      const promises = files.map(file => FileSystem.deleteAsync(`${cacheDir}${file}`, { idempotent: true }));
      await Promise.all(promises);
    } catch (e) {
      console.error("Failed to clear cache:", e);
    }
  }
}
