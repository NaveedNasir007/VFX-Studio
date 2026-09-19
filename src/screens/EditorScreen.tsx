import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Download, Undo, Redo } from 'lucide-react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { EditorScreenProps } from '../navigation/types';
import { useTimelineStore } from '../store/TimelineStore';
import { useProjectStore } from '../store/ProjectStore';
import { Clip } from '../types/models';

export default function EditorScreen({ route, navigation }: EditorScreenProps) {
  const { projectId } = route.params;
  const insets = useSafeAreaInsets();
  const { projects } = useProjectStore();
  const { timelineData, currentProject, loadProjectTimeline } = useTimelineStore();

  const [activeClip, setActiveClip] = useState<Clip | null>(null);

  useEffect(() => {
    if (currentProject?.id !== projectId) {
      const proj = projects.find(p => p.id === projectId);
      if (proj) {
        loadProjectTimeline(proj);
      }
    }
  }, [projectId, projects, currentProject?.id, loadProjectTimeline]);

  useEffect(() => {
    if (timelineData?.tracks?.length > 0) {
      const mainTrack = timelineData.tracks.find(t => t.id === 'main');
      if (mainTrack && mainTrack.clips.length > 0) {
        setActiveClip(mainTrack.clips[0]);
      }
    }
  }, [timelineData]);

  const player = useVideoPlayer(
    activeClip?.type === 'video' ? activeClip.mediaUri : null,
    (player) => {
      player.loop = true;
    }
  );

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
            nativeControls={true}
          />
        ) : activeClip?.type === 'image' ? (
          <Image
            source={{ uri: activeClip.mediaUri }}
            style={styles.mediaPreview}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.emptyPreview}>
            <Text style={styles.emptyText}>No Media Selected</Text>
          </View>
        )}
      </View>

      <View style={styles.timelineContainer}>
        <View style={styles.timelineToolbar}>
          <Text style={{ ...typography.button, color: colors.text }}>Timeline</Text>
          <Text style={{ color: colors.textSecondary }}>{(timelineData?.duration || 0) / 1000}s</Text>
        </View>

        <View style={styles.timelineTracksPlaceholder}>
          <View style={styles.playhead} />
          {timelineData?.tracks?.map(track => (
            <View key={track.id} style={styles.trackPlaceholder}>
              {track.clips.map(clip => (
                <View key={clip.id} style={styles.clipBlock}>
                  <Text style={{ fontSize: 12, color: colors.text }} numberOfLines={1}>
                    {clip.type === 'video' ? '🎬' : '📷'} Clip
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      </View>

      <View style={styles.toolsMenu}>
        {['Edit', 'Audio', 'Text', 'Filters'].map(tool => (
          <TouchableOpacity key={tool} style={styles.toolItem}>
            <Text style={styles.toolText}>{tool}</Text>
          </TouchableOpacity>
        ))}
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
  timelineToolbar: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  timelineTracksPlaceholder: { flex: 1, padding: 16, paddingTop: 32, position: 'relative' },
  playhead: { position: 'absolute', left: '50%', top: 0, bottom: 0, width: 2, backgroundColor: colors.primary, zIndex: 10 },
  trackPlaceholder: { height: 60, backgroundColor: colors.background, borderRadius: 8, flexDirection: 'row', alignItems: 'center', padding: 4, marginBottom: 8 },
  clipBlock: { backgroundColor: colors.border, height: '100%', minWidth: 100, borderRadius: 6, justifyContent: 'center', paddingHorizontal: 8, marginRight: 4, borderColor: colors.secondary, borderWidth: 1 },

  toolsMenu: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background },
  toolItem: { alignItems: 'center', padding: 8 },
  toolText: { ...typography.caption, color: colors.text, marginTop: 4 }
});
