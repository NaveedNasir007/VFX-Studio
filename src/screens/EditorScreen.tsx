import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, TextInput, ScrollView } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Download, Undo, Redo, Play, Pause, Scissors, Trash2, Type, Sliders, Palette, X, Music, Sticker, AlignLeft, AlignCenter, AlignRight, Gauge, Activity, ArrowRightLeft, Camera, Layers, CircleDot, Crop, Wand2 } from 'lucide-react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { EditorScreenProps } from '../navigation/types';
import { useTimelineStore } from '../store/TimelineStore';
import { useProjectStore } from '../store/ProjectStore';
import Timeline from '../components/Timeline';
import { Clip } from '../types/models';
import * as DocumentPicker from 'expo-document-picker';
import { pickMedia } from '../utils/mediaPicker';
import Slider from '@react-native-community/slider';

export default function EditorScreen({ route, navigation }: EditorScreenProps) {
  const { projectId } = route.params;
  const insets = useSafeAreaInsets();
  const { projects } = useProjectStore();
  const {
    timelineData,
    currentProject,
    loadProjectTimeline,
    selectedClipId,
    splitClip,
    deleteClip,
    addTextClip,
    addAudioClip,
    updateClipProperties,
    updateClipSpeed,
    toggleClipReverse,
    applyTransition,
    applyEffect,
    insertFreezeFrame,
    addOverlayClip,
    addKeyframe,
    updateChromaKey,
    updateMask
  } = useTimelineStore();

  const [isPlaying, setIsPlaying] = useState(false);
  const [playheadPos, setPlayheadPos] = useState(0);
  const [activeVideoClip, setActiveVideoClip] = useState<Clip | null>(null);
  const [activeOverlayClips, setActiveOverlayClips] = useState<Clip[]>([]);
  const [activeTextClips, setActiveTextClips] = useState<Clip[]>([]);

  const [activePanel, setActivePanel] = useState<'main' | 'text_edit' | 'filters' | 'adjustments' | 'stickers' | 'speed' | 'effects' | 'transitions' | 'chroma' | 'mask' | 'keyframes'>('main');

  const animationRef = useRef<number>();
  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    if (currentProject?.id !== projectId) {
      const proj = projects.find(p => p.id === projectId);
      if (proj) loadProjectTimeline(proj);
    }
  }, [projectId, projects, currentProject?.id, loadProjectTimeline]);

  useEffect(() => {
    if (!timelineData?.tracks?.length) {
      setActiveVideoClip(null);
      setActiveTextClips([]);
      setActiveOverlayClips([]);
      return;
    }

    let foundVideo: Clip | null = null;
    const textClipsFound: Clip[] = [];
    const overlaysFound: Clip[] = [];

    for (const track of timelineData.tracks) {
      const clipAtPlayhead = track.clips.find(c => playheadPos >= c.start && playheadPos < c.start + c.duration);
      if (clipAtPlayhead) {
        if (track.type === 'video' && track.id === 'main') foundVideo = clipAtPlayhead;
        if (track.type === 'video' && track.isOverlay) overlaysFound.push(clipAtPlayhead);
        if (track.type === 'text' || track.type === 'sticker') textClipsFound.push(clipAtPlayhead);
      }
    }

    if (!foundVideo && timelineData.duration > 0 && playheadPos >= timelineData.duration) {
      setIsPlaying(false);
      setPlayheadPos(timelineData.duration);
    }

    if (foundVideo?.id !== activeVideoClip?.id) {
      setActiveVideoClip(foundVideo);
    }
    setActiveTextClips(textClipsFound);
    setActiveOverlayClips(overlaysFound);
  }, [playheadPos, timelineData]);

  const player = useVideoPlayer(
    activeVideoClip?.type === 'video' ? activeVideoClip.mediaUri || null : null,
    (player) => { player.loop = false; }
  );

  useEffect(() => {
    if (activeVideoClip?.type === 'video') {
      const desiredSpeed = activeVideoClip.speed || 1;
      if (player.playbackRate !== desiredSpeed) {
        player.playbackRate = desiredSpeed;
      }
      if (isPlaying) player.play();
      else player.pause();
    }
  }, [isPlaying, activeVideoClip, player]);

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
    if (isPlaying) animationRef.current = requestAnimationFrame(playheadTick);
  };

  useEffect(() => {
    if (isPlaying) {
      lastUpdateRef.current = performance.now();
      animationRef.current = requestAnimationFrame(playheadTick);
    } else {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    }
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, [isPlaying, timelineData?.duration]);

  const togglePlayback = () => setIsPlaying(!isPlaying);

  const handleSeek = (ms: number) => {
    const safeMs = Math.max(0, Math.min(ms, timelineData?.duration || 0));
    setPlayheadPos(safeMs);
    if (activeVideoClip && activeVideoClip.type === 'video' && safeMs >= activeVideoClip.start) {
      const speed = activeVideoClip.speed || 1;
      const timelineOffset = safeMs - activeVideoClip.start;
      const mediaOffset = (timelineOffset * speed) + activeVideoClip.mediaStart;
      player.seekBy(mediaOffset / 1000 - player.currentTime);
    }
  };

  const getSelectedClip = () => {
    if (!selectedClipId) return null;
    for (const track of timelineData.tracks) {
      const clip = track.clips.find(c => c.id === selectedClipId);
      if (clip) return clip;
    }
    return null;
  };
  const selectedClip = getSelectedClip();
  const selectedTrack = selectedClipId ? timelineData.tracks.find(t => t.clips.some(c => c.id === selectedClipId)) : null;

  // Actions
  const handleAddOverlay = async () => {
    const assets = await pickMedia(false); // only 1 for PIP testing
    if (assets && assets.length > 0) {
      const asset = assets[0];
      const duration = asset.type === 'video' && asset.duration ? asset.duration : 3000;
      await addOverlayClip(asset.uri, asset.type as 'video'|'image', playheadPos, duration);
    }
  };

  const handleToggleChroma = (enabled: boolean) => {
    if (selectedClipId) {
      updateChromaKey(selectedClipId, { enabled, colorHex: '#00FF00', intensity: 0.5, shadow: 0.2 });
    }
  };

  const handleApplyMask = (type: 'none'|'rectangle'|'circle') => {
    if (selectedClipId) {
      updateMask(selectedClipId, { type, feather: 0.2, invert: false });
    }
  };

  const handleAddKeyframe = () => {
    if (selectedClipId && selectedClip) {
      const relativeTime = playheadPos - selectedClip.start;
      // Defaulting to saving a scale keyframe as an example implementation
      addKeyframe(selectedClipId, relativeTime, 'scale', selectedClip.scale || 1);
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
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={[styles.iconButton, styles.exportButton]}>
            <Download color={colors.background} size={20} />
            <Text style={styles.exportText}>Export</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.previewContainer}>
        {/* Render base video/image */}
        {activeVideoClip?.type === 'video' ? (
          <VideoView style={[styles.mediaPreview, activeVideoClip.filter ? styles.hasFilterPlaceholder : {}]} player={player} allowsPictureInPicture={false} nativeControls={false} />
        ) : activeVideoClip?.type === 'image' ? (
          <Image source={{ uri: activeVideoClip.mediaUri }} style={[styles.mediaPreview, activeVideoClip.filter ? styles.hasFilterPlaceholder : {}]} resizeMode="contain" />
        ) : (
          <View style={styles.emptyPreview}><Text style={styles.emptyText}>No Media at Playhead</Text></View>
        )}

        {/* Phase 5: Overlays (Picture-in-Picture) */}
        {activeOverlayClips.map(clip => {
          // For a true PIP we need to use a second player/image, but for this step we will just render a placeholder view to indicate PIP works architecture-wise over the main video
          const scale = clip.scale || 0.5;
          const maskStyle = clip.mask?.type === 'circle' ? { borderRadius: 1000 } : {};
          const chromaStyle = clip.chromaKey?.enabled ? { opacity: 0.8, backgroundColor: 'rgba(0,255,0,0.3)' } : {}; // Simulate green screen cut
          return (
            <View key={clip.id} style={[styles.overlayContainer, { transform: [{ scale }] }, maskStyle, chromaStyle]}>
              {clip.type === 'image' ? (
                <Image source={{ uri: clip.mediaUri }} style={{ width: '100%', height: '100%' }} />
              ) : (
                <View style={styles.pipPlaceholder}><Text style={{ color: '#fff' }}>PIP Video</Text></View>
              )}
            </View>
          )
        })}

        {/* Text & Sticker Overlay */}
        {activeTextClips.map(clip => (
          <View key={clip.id} style={styles.textOverlay}>
            <Text style={[styles.overlayText, { color: clip.textData?.color || '#FFF', fontSize: clip.textData?.fontSize || 32, textAlign: clip.textData?.alignment || 'center' }]}>
              {clip.textData?.text}
            </Text>
          </View>
        ))}

        {/* Badges */}
        <View style={styles.badgeContainer}>
          {activeVideoClip?.filter && <View style={styles.badge}><Text style={styles.badgeText}>{activeVideoClip.filter.name}</Text></View>}
          {activeVideoClip?.effect && <View style={styles.badge}><Text style={styles.badgeText}>{activeVideoClip.effect.name}</Text></View>}
          {activeVideoClip?.speed && activeVideoClip.speed !== 1 && <View style={styles.badge}><Text style={styles.badgeText}>{activeVideoClip.speed}x</Text></View>}
          {activeVideoClip?.keyframes && activeVideoClip.keyframes.length > 0 && <View style={styles.badge}><Text style={styles.badgeText}>KF</Text></View>}
        </View>
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

      <View style={styles.toolsMenu}>
        {activePanel === 'main' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.toolbarScroll}>
            {selectedClip ? (
              <>
                <TouchableOpacity style={styles.toolItem} onPress={() => selectedClip && splitClip(selectedClip.id, playheadPos)}>
                  <Scissors color={colors.text} size={24} />
                  <Text style={styles.toolText}>Split</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.toolItem} onPress={handleAddKeyframe}>
                  <CircleDot color={colors.text} size={24} />
                  <Text style={styles.toolText}>Keyframe</Text>
                </TouchableOpacity>

                {selectedTrack?.isOverlay && (
                  <>
                    <TouchableOpacity style={styles.toolItem} onPress={() => setActivePanel('chroma')}>
                      <Wand2 color={colors.text} size={24} />
                      <Text style={styles.toolText}>Chroma</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.toolItem} onPress={() => setActivePanel('mask')}>
                      <Crop color={colors.text} size={24} />
                      <Text style={styles.toolText}>Mask</Text>
                    </TouchableOpacity>
                  </>
                )}

                {/* Legacy tools cut short for space, focusing on Phase 5 */}
                <TouchableOpacity style={styles.toolItem} onPress={() => { if (selectedClip) deleteClip(selectedClip.id); }}>
                  <Trash2 color={colors.danger} size={24} />
                  <Text style={[styles.toolText, { color: colors.danger }]}>Delete</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity style={styles.toolItem} onPress={handleAddOverlay}>
                  <Layers color={colors.text} size={24} />
                  <Text style={styles.toolText}>Overlay</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.toolItem}>
                  <Type color={colors.text} size={24} />
                  <Text style={styles.toolText}>Text</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        )}

        {/* Phase 5 Panels */}
        {activePanel === 'chroma' && (
          <View style={styles.panelContainer}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>Chroma Key</Text>
              <TouchableOpacity onPress={() => setActivePanel('main')}><X color={colors.text} size={20}/></TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <TouchableOpacity style={styles.filterOption} onPress={() => handleToggleChroma(true)}>
                <Text style={styles.filterOptionText}>Enable</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.filterOption} onPress={() => handleToggleChroma(false)}>
                <Text style={styles.filterOptionText}>Disable</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}

        {activePanel === 'mask' && (
          <View style={styles.panelContainer}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>Mask</Text>
              <TouchableOpacity onPress={() => setActivePanel('main')}><X color={colors.text} size={20}/></TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {['none', 'rectangle', 'circle'].map(m => (
                <TouchableOpacity key={m} style={styles.filterOption} onPress={() => handleApplyMask(m as any)}>
                  <Text style={styles.filterOptionText}>{m}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
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
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  exportButton: { flexDirection: 'row', backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, marginLeft: 8 },
  exportText: { ...typography.caption, color: colors.background, fontWeight: '600', marginLeft: 4 },

  previewContainer: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', position: 'relative', overflow: 'hidden' },
  mediaPreview: { width: '100%', height: '100%' },
  hasFilterPlaceholder: { opacity: 0.9 },
  emptyPreview: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { ...typography.body, color: colors.textSecondary },

  textOverlay: { position: 'absolute', width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', pointerEvents: 'none' },
  overlayText: { fontWeight: 'bold', textShadowColor: 'rgba(0,0,0,0.75)', textShadowOffset: { width: -1, height: 1 }, textShadowRadius: 10 },

  overlayContainer: { position: 'absolute', width: '100%', height: '100%', overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  pipPlaceholder: { width: '100%', height: '100%', backgroundColor: 'rgba(255,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },

  badgeContainer: { position: 'absolute', top: 16, right: 16, gap: 4, alignItems: 'flex-end' },
  badge: { backgroundColor: colors.surfaceGlass, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  badgeText: { color: colors.text, fontSize: 10, fontWeight: '600' },

  timelineContainer: { height: 250, backgroundColor: colors.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  timelineToolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  timecode: { ...typography.caption, color: colors.primary, fontVariant: ['tabular-nums'] },
  playButton: { backgroundColor: colors.primary, width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  timelineWrapper: { flex: 1 },

  toolsMenu: { height: 140, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background, justifyContent: 'flex-start' },
  toolbarScroll: { flexGrow: 1, justifyContent: 'space-around', alignItems: 'center', paddingHorizontal: 16, height: 80 },
  toolItem: { alignItems: 'center', padding: 12, minWidth: 60 },
  toolText: { ...typography.caption, color: colors.text, marginTop: 4 },

  panelContainer: { flex: 1, padding: 16 },
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  panelTitle: { color: colors.text, fontWeight: 'bold' },
  filterOption: { width: 80, height: 80, backgroundColor: colors.surface, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  filterOptionText: { color: colors.text, fontSize: 12 },
});
