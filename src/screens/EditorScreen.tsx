import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Download, Undo, Redo, Play, Pause, Scissors, Trash2 } from 'lucide-react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { EditorScreenProps } from '../navigation/types';
import { useTimelineStore } from '../store/TimelineStore';
import { useProjectStore } from '../store/ProjectStore';
import Timeline from '../components/Timeline';
import { Clip } from '../types/models';

export default function EditorScreen({ route, navigation }: EditorScreenProps) {
  const { projectId } = route.params;
  const insets = useSafeAreaInsets();
  const { projects } = useProjectStore();
  const { timelineData, currentProject, loadProjectTimeline, selectedClipId, splitClip, deleteClip } = useTimelineStore();

  const [isPlaying, setIsPlaying] = useState(false);
  const [playheadPos, setPlayheadPos] = useState(0); // in ms
  const [activeClip, setActiveClip] = useState<Clip | null>(null);
  const animationRef = useRef<number>();
  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    if (currentProject?.id !== projectId) {
      const proj = projects.find(p => p.id === projectId);
      if (proj) loadProjectTimeline(proj);
    }
  }, [projectId, projects, currentProject?.id, loadProjectTimeline]);

  // Sync playhead to active clip
  useEffect(() => {
    if (!timelineData?.tracks?.length) {
      setActiveClip(null);
      return;
    }

    // Find clip that encompasses playheadPos
    let foundClip: Clip | null = null;
    for (const track of timelineData.tracks) {
      if (track.type === 'video') {
        foundClip = track.clips.find(c => playheadPos >= c.start && playheadPos < c.start + c.duration) || null;
        if (foundClip) break;
      }
    }

    // If end of timeline, clear or keep last
    if (!foundClip && timelineData.duration > 0 && playheadPos >= timelineData.duration) {
      setIsPlaying(false);
      setPlayheadPos(timelineData.duration);
    }

    // Detect clip switch
    if (foundClip?.id !== activeClip?.id) {
      setActiveClip(foundClip);
    }
  }, [playheadPos, timelineData]);

  const player = useVideoPlayer(
    activeClip?.type === 'video' ? activeClip.mediaUri : null,
    (player) => {
      // Loop individual clips for now if testing, but typically we manage timeline time
      player.loop = false;
    }
  );

  useEffect(() => {
    if (activeClip?.type === 'video') {
      if (isPlaying) {
        player.play();
      } else {
        player.pause();
      }
    }
  }, [isPlaying, activeClip, player]);

  // Playhead Tick Engine
  const playheadTick = (timestamp: number) => {
    if (!lastUpdateRef.current) lastUpdateRef.current = timestamp;
    const delta = timestamp - lastUpdateRef.current;

    setPlayheadPos(prev => {
      const next = prev + delta;
      if (next >= (timelineData?.duration || 0)) {
        setIsPlaying(false);
        return timelineData?.duration || 0;
      }
      return next;
    });

    lastUpdateRef.current = timestamp;
    if (isPlaying) {
      animationRef.current = requestAnimationFrame(playheadTick);
    }
  };

  useEffect(() => {
    if (isPlaying) {
      lastUpdateRef.current = performance.now();
      animationRef.current = requestAnimationFrame(playheadTick);
    } else {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying, timelineData?.duration]);

  const togglePlayback = () => setIsPlaying(!isPlaying);

  const handleSeek = (ms: number) => {
    const safeMs = Math.max(0, Math.min(ms, timelineData?.duration || 0));
    setPlayheadPos(safeMs);
    // Sync video player to local clip offset
    if (activeClip && activeClip.type === 'video' && safeMs >= activeClip.start) {
      const clipOffset = (safeMs - activeClip.start) + activeClip.mediaStart;
      player.seekBy(clipOffset / 1000 - player.currentTime);
    }
  };

  const handleSplit = () => {
    if (selectedClipId) {
      splitClip(selectedClipId, playheadPos);
    }
  };

  const handleDelete = () => {
    if (selectedClipId) {
      deleteClip(selectedClipId);
    }
  };

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${(s % 60).toString().padStart(2, '0')}.${Math.floor((ms % 1000)/100)}`;
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
          <ChevronLeft color={colors.text} size={28} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.projectName}>{currentProject?.name || 'Project'}</Text>
          <Text style={styles.resolutionBadge}>{currentProject?.resolution || '1080p'}</Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconButton}>
            <Undo color={colors.textSecondary} size={24} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton}>
            <Redo color={colors.textSecondary} size={24} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.iconButton, styles.exportButton]}>
            <Download color={colors.background} size={20} />
            <Text style={styles.exportText}>Export</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.previewContainer}>
        {activeClip?.type === 'video' ? (
          <VideoView
            style={styles.mediaPreview}
            player={player}
            allowsPictureInPicture={false}
            nativeControls={false}
          />
        ) : activeClip?.type === 'image' ? (
          <Image
            source={{ uri: activeClip.mediaUri }}
            style={styles.mediaPreview}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.emptyPreview}>
            <Text style={styles.emptyText}>No Media at Playhead</Text>
          </View>
        )}
      </View>

      <View style={styles.timelineContainer}>
        <View style={styles.timelineToolbar}>
          <Text style={styles.timecode}>{formatTime(playheadPos)} / {formatTime(timelineData?.duration || 0)}</Text>
          <TouchableOpacity style={styles.playButton} onPress={togglePlayback}>
            {isPlaying ? <Pause color={colors.background} size={20} /> : <Play color={colors.background} size={20} />}
          </TouchableOpacity>
        </View>

        <View style={styles.timelineWrapper}>
          <Timeline playheadPosition={playheadPos} onSeek={handleSeek} />
        </View>
      </View>

      {/* Editor Context Menu */}
      <View style={styles.toolsMenu}>
        {selectedClipId ? (
          <>
            <TouchableOpacity style={styles.toolItem} onPress={handleSplit}>
              <Scissors color={colors.text} size={24} />
              <Text style={styles.toolText}>Split</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolItem} onPress={handleDelete}>
              <Trash2 color={colors.danger} size={24} />
              <Text style={[styles.toolText, { color: colors.danger }]}>Delete</Text>
            </TouchableOpacity>
          </>
        ) : (
          ['Edit', 'Audio', 'Text', 'Filters'].map(tool => (
            <TouchableOpacity key={tool} style={styles.toolItem}>
              <Text style={styles.toolText}>{tool}</Text>
            </TouchableOpacity>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 60, borderBottomWidth: 1, borderBottomColor: colors.border },
  iconButton: { padding: 8, justifyContent: 'center', alignItems: 'center' },
  headerCenter: { alignItems: 'center' },
  projectName: { ...typography.body, fontWeight: '600' },
  resolutionBadge: { ...typography.caption, color: colors.secondary, marginTop: 2, backgroundColor: colors.surface, paddingHorizontal: 6, borderRadius: 4, overflow: 'hidden' },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  exportButton: { flexDirection: 'row', backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, marginLeft: 8 },
  exportText: { ...typography.caption, color: colors.background, fontWeight: '600', marginLeft: 4 },

  previewContainer: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  mediaPreview: { width: '100%', height: '100%' },
  emptyPreview: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { ...typography.body, color: colors.textSecondary },

  timelineContainer: { height: 250, backgroundColor: colors.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  timelineToolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  timecode: { ...typography.caption, color: colors.primary, fontVariant: ['tabular-nums'] },
  playButton: { backgroundColor: colors.primary, width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  timelineWrapper: { flex: 1 },

  toolsMenu: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background },
  toolItem: { alignItems: 'center', padding: 8 },
  toolText: { ...typography.caption, color: colors.text, marginTop: 4 }
});
