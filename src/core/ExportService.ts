import { FFmpegKit, FFmpegSession, ReturnCode, FFmpegKitConfig } from 'ffmpeg-kit-react-native';
import * as FileSystem from 'expo-file-system';
import { TimelineData, Track, Clip, Project } from '../types/models';

export interface ExportOptions {
  resolution: '720p' | '1080p' | '4k';
  fps: number;
  quality: 'low' | 'medium' | 'high';
  onProgress?: (progress: number) => void;
}

export class ExportService {
  private static activeSession: FFmpegSession | null = null;

  static async cancelExport() {
    if (this.activeSession) {
      await FFmpegKit.cancel(await this.activeSession.getSessionId());
      this.activeSession = null;
    }
  }

  static async exportProject(project: Project, timeline: TimelineData, options: ExportOptions): Promise<string> {
    const outputFileName = `export_${project.id}_${Date.now()}.mp4`;
    const outputPath = `${FileSystem.cacheDirectory}${outputFileName}`;

    const fileInfo = await FileSystem.getInfoAsync(outputPath);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(outputPath);
    }

    const { command, totalDurationMs } = this.buildFFmpegCommand(timeline, options, outputPath);

    return new Promise((resolve, reject) => {
      FFmpegKitConfig.enableStatisticsCallback((statistics) => {
        const timeMs = statistics.getTime();
        if (timeMs > 0 && totalDurationMs > 0) {
          const progress = Math.min(1, timeMs / totalDurationMs);
          if (options.onProgress) options.onProgress(progress);
        }
      });

      FFmpegKit.executeAsync(command, async (session) => {
        const returnCode = await session.getReturnCode();
        if (ReturnCode.isSuccess(returnCode)) {
          resolve(outputPath);
        } else if (ReturnCode.isCancel(returnCode)) {
          reject(new Error("Export cancelled"));
        } else {
          const logs = await session.getFailStackTrace();
          reject(new Error(`Export failed: ${logs}`));
        }
        this.activeSession = null;
      }).then(session => {
        this.activeSession = session;
      });
    });
  }

  static buildFFmpegCommand(timeline: TimelineData, options: ExportOptions, outputPath: string) {
    let inputs: string[] = [];
    let filterComplex: string[] = [];
    let inputIndex = 0;

    let targetWidth = 1920;
    let targetHeight = 1080;
    if (options.resolution === '720p') { targetWidth = 1280; targetHeight = 720; }
    if (options.resolution === '4k') { targetWidth = 3840; targetHeight = 2160; }

    const mainTrack = timeline.tracks.find(t => t.id === 'main' && !t.isOverlay);
    if (!mainTrack || mainTrack.clips.length === 0) {
      throw new Error("No main video track found to export.");
    }

    // 1. Gather all inputs (Main Videos, Overlays, Audio)
    const audioClips: { clip: Clip, inputIdx: number }[] = [];
    const overlayClips: { clip: Clip, inputIdx: number }[] = [];

    // Main track inputs
    mainTrack.clips.forEach(clip => {
      inputs.push(`-i "${clip.mediaUri}"`);
      inputIndex++;
    });

    // Audio & Voiceover track inputs
    timeline.tracks.forEach(track => {
      if (track.type === 'audio' || track.type === 'voiceover') {
        track.clips.forEach(clip => {
          inputs.push(`-i "${clip.mediaUri}"`);
          audioClips.push({ clip, inputIdx: inputIndex });
          inputIndex++;
        });
      }

      // Overlay inputs
      if (track.type === 'video' && track.isOverlay) {
        track.clips.forEach(clip => {
          inputs.push(`-i "${clip.mediaUri}"`);
          overlayClips.push({ clip, inputIdx: inputIndex });
          inputIndex++;
        });
      }
    });

    // 2. Build Filtergraph for main sequence
    const scaledInputs: string[] = [];
    let currentMainIdx = 0;

    mainTrack.clips.forEach((clip) => {
      let filter = `[${currentMainIdx}:v]scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease,pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${options.fps}[v${currentMainIdx}]`;
      filterComplex.push(filter);
      scaledInputs.push(`[v${currentMainIdx}]`);
      currentMainIdx++;
    });

    // Concat main video clips
    const concatInputs = scaledInputs.join('');
    filterComplex.push(`${concatInputs}concat=n=${mainTrack.clips.length}:v=1:a=0[base_video]`);

    let currentVideoLabel = 'base_video';

    // 3. Process Overlays (PIP)
    let overlayCounter = 0;
    overlayClips.forEach(item => {
      const scaleW = Math.round(targetWidth * (item.clip.scale || 0.5));
      const scaleH = Math.round(targetHeight * (item.clip.scale || 0.5));

      // Calculate delay in seconds
      const delayS = (item.clip.start / 1000).toFixed(2);
      const endS = ((item.clip.start + item.clip.duration) / 1000).toFixed(2);

      // Scale the overlay input
      filterComplex.push(`[${item.inputIdx}:v]scale=${scaleW}:${scaleH}[ovl${overlayCounter}]`);

      // Apply overlay to the current base video string
      const nextLabel = `vid_ovl${overlayCounter}`;
      filterComplex.push(`[${currentVideoLabel}][ovl${overlayCounter}]overlay=enable='between(t,${delayS},${endS})':x=(main_w-overlay_w)/2:y=(main_h-overlay_h)/2[${nextLabel}]`);

      currentVideoLabel = nextLabel;
      overlayCounter++;
    });

    // 4. Process Text / Captions (using drawtext)
    // Warning: FFmpeg drawtext requires a font file to work correctly across platforms. We assume system font for the sandbox.
    let textCounter = 0;
    timeline.tracks.forEach(track => {
      if (track.type === 'text' || track.type === 'caption') {
        track.clips.forEach(clip => {
          if (clip.textData?.text) {
            const startS = (clip.start / 1000).toFixed(2);
            const endS = ((clip.start + clip.duration) / 1000).toFixed(2);
            const safeText = clip.textData.text.replace(/'/g, "’"); // escape single quotes
            const nextLabel = `vid_txt${textCounter}`;

            filterComplex.push(`[${currentVideoLabel}]drawtext=text='${safeText}':fontsize=48:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2:enable='between(t,${startS},${endS})'[${nextLabel}]`);
            currentVideoLabel = nextLabel;
            textCounter++;
          }
        });
      }
    });

    // 5. Audio Mixing
    // We need to mix the main video audio (if any) and the audio clips.
    // For simplicity, we amix all audio tracks together
    let audioString = '';
    let totalAudioInputs = 0;

    // Add main video audio
    for (let i = 0; i < mainTrack.clips.length; i++) {
      audioString += `[${i}:a]`;
      totalAudioInputs++;
    }

    // Add delayed external audio
    let audioCounter = 0;
    audioClips.forEach(item => {
      const delayMs = item.clip.start;
      filterComplex.push(`[${item.inputIdx}:a]adelay=${delayMs}|${delayMs}[aud${audioCounter}]`);
      audioString += `[aud${audioCounter}]`;
      audioCounter++;
      totalAudioInputs++;
    });

    if (totalAudioInputs > 0) {
      filterComplex.push(`${audioString}amix=inputs=${totalAudioInputs}:duration=longest[final_audio]`);
    }

    let bitrate = '5M';
    if (options.quality === 'low') bitrate = '2M';
    if (options.quality === 'high') bitrate = '10M';

    // Map the final video and audio
    const mapVideo = `-map "[${currentVideoLabel}]"`;
    const mapAudio = totalAudioInputs > 0 ? `-map "[final_audio]"` : '';

    const command = `${inputs.join(' ')} -filter_complex "${filterComplex.join(';')}" ${mapVideo} ${mapAudio} -c:v libx264 -preset ultrafast -b:v ${bitrate} -c:a aac -b:a 192k -r ${options.fps} -y "${outputPath}"`;

    return { command, totalDurationMs: timeline.duration };
  }
}
