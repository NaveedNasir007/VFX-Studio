import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, TextInput, ScrollView } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Download, Undo, Redo, Play, Pause, Scissors, Trash2, Type, Sliders, Palette, X, Music, Sticker, AlignLeft, AlignCenter, AlignRight } from 'lucide-react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { EditorScreenProps } from '../navigation/types';
import { useTimelineStore } from '../store/TimelineStore';
import { useProjectStore } from '../store/ProjectStore';
import Timeline from '../components/Timeline';
import { Clip } from '../types/models';
import * as DocumentPicker from 'expo-document-picker';
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
    updateClipProperties
  } = useTimelineStore();

  const [isPlaying, setIsPlaying] = useState(false);
  const [playheadPos, setPlayheadPos] = useState(0);
  const [activeVideoClip, setActiveVideoClip] = useState<Clip | null>(null);
  const [activeTextClips, setActiveTextClips] = useState<Clip[]>([]);

  const [activePanel, setActivePanel] = useState<'main' | 'text_edit' | 'filters' | 'adjustments' | 'stickers'>('main');

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
      return;
    }

    let foundVideo: Clip | null = null;
    const textClipsFound: Clip[] = [];

    for (const track of timelineData.tracks) {
      const clipAtPlayhead = track.clips.find(c => playheadPos >= c.start && playheadPos < c.start + c.duration);
      if (clipAtPlayhead) {
        if (track.type === 'video') foundVideo = clipAtPlayhead;
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
  }, [playheadPos, timelineData]);

  const player = useVideoPlayer(
    activeVideoClip?.type === 'video' ? activeVideoClip.mediaUri || null : null,
    (player) => { player.loop = false; }
  );

  useEffect(() => {
    if (activeVideoClip?.type === 'video') {
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
      const clipOffset = (safeMs - activeVideoClip.start) + activeVideoClip.mediaStart;
      player.seekBy(clipOffset / 1000 - player.currentTime);
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

  // Actions
  const handleAddText = async () => {
    await addTextClip("New Text", playheadPos, 3000);
    // Find the newly added text track/clip to auto-select it?
    // Usually it goes to the end of the text track. For now, rely on tap.
  };

  const handlePickAudio = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*' });
      if (!result.canceled && result.assets.length > 0) {
        await addAudioClip(result.assets[0].uri, playheadPos, 10000);
      }
    } catch (err) {
      console.log('Audio pick err', err);
    }
  };

  const applyFilter = (filterName: string) => {
    if (selectedClipId) {
      updateClipProperties(selectedClipId, {
        filter: { id: filterName, name: filterName, intensity: 1 }
      });
    }
  };

  const updateTextValue = (val: string) => {
    if (selectedClipId && (selectedClip?.type === 'text' || selectedClip?.type === 'sticker')) {
      const currentTextData = selectedClip.textData || { text: '' };
      updateClipProperties(selectedClipId, { textData: { ...currentTextData, text: val } });
    }
  };

  const updateTextColor = (color: string) => {
    if (selectedClipId && selectedClip?.type === 'text') {
      const currentTextData = selectedClip.textData || { text: '' };
      updateClipProperties(selectedClipId, { textData: { ...currentTextData, color } });
    }
  };

  const updateTextAlignment = (alignment: 'left'|'center'|'right') => {
    if (selectedClipId && selectedClip?.type === 'text') {
      const currentTextData = selectedClip.textData || { text: '' };
      updateClipProperties(selectedClipId, { textData: { ...currentTextData, alignment } });
    }
  };

  const updateAdjustment = (key: keyof NonNullable<Clip['adjustments']>, value: number) => {
    if (selectedClipId) {
      const currentAdj = selectedClip?.adjustments || {};
      updateClipProperties(selectedClipId, { adjustments: { ...currentAdj, [key]: value } });
    }
  };

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${(s % 60).toString().padStart(2, '0')}.${Math.floor((ms % 1000)/100)}`;
  };

  const renderSlider = (label: string, key: keyof NonNullable<Clip['adjustments']>) => {
    const val = selectedClip?.adjustments?.[key] || 0;
    return (
      <View style={{ marginBottom: 16 }}>
        <Text style={{ color: colors.textSecondary, marginBottom: 8 }}>{label} ({Math.round(val * 100)})</Text>
        <Slider
          style={{ width: '100%', height: 40 }}
          minimumValue={-1}
          maximumValue={1}
          value={val}
          onValueChange={(v) => updateAdjustment(key, v)}
          minimumTrackTintColor={colors.primary}
          maximumTrackTintColor={colors.border}
        />
      </View>
    );
  };

  const textColors = ['#FFFFFF', '#000000', '#FF3B30', '#34C759', '#007AFF', '#FF9500', '#AF52DE'];

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
        {activeVideoClip?.type === 'video' ? (
          <VideoView
            style={[styles.mediaPreview, activeVideoClip.filter ? styles.hasFilterPlaceholder : {}]}
            player={player}
            allowsPictureInPicture={false}
            nativeControls={false}
          />
        ) : activeVideoClip?.type === 'image' ? (
          <Image
            source={{ uri: activeVideoClip.mediaUri }}
            style={[styles.mediaPreview, activeVideoClip.filter ? styles.hasFilterPlaceholder : {}]}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.emptyPreview}>
            <Text style={styles.emptyText}>No Media at Playhead</Text>
          </View>
        )}

        {/* Text & Sticker Overlay */}
        {activeTextClips.map(clip => (
          <View key={clip.id} style={styles.textOverlay}>
            <Text style={[styles.overlayText, {
              color: clip.textData?.color || '#FFF',
              fontSize: clip.textData?.fontSize || 32,
              textAlign: clip.textData?.alignment || 'center'
            }]}>
              {clip.textData?.text}
            </Text>
          </View>
        ))}

        {activeVideoClip?.filter && (
          <View style={styles.filterBadge}>
            <Text style={styles.filterBadgeText}>{activeVideoClip.filter.name}</Text>
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

      <View style={styles.toolsMenu}>
        {activePanel === 'main' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.toolbarScroll}>
            {selectedClip ? (
              <>
                <TouchableOpacity style={styles.toolItem} onPress={() => selectedClip && splitClip(selectedClip.id, playheadPos)}>
                  <Scissors color={colors.text} size={24} />
                  <Text style={styles.toolText}>Split</Text>
                </TouchableOpacity>
                {(selectedClip.type === 'text' || selectedClip.type === 'sticker') && (
                  <TouchableOpacity style={styles.toolItem} onPress={() => setActivePanel('text_edit')}>
                    <Type color={colors.text} size={24} />
                    <Text style={styles.toolText}>Edit Text</Text>
                  </TouchableOpacity>
                )}
                {selectedClip.type !== 'audio' && selectedClip.type !== 'text' && selectedClip.type !== 'sticker' && (
                  <>
                    <TouchableOpacity style={styles.toolItem} onPress={() => setActivePanel('filters')}>
                      <Palette color={colors.text} size={24} />
                      <Text style={styles.toolText}>Filter</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.toolItem} onPress={() => setActivePanel('adjustments')}>
                      <Sliders color={colors.text} size={24} />
                      <Text style={styles.toolText}>Adjust</Text>
                    </TouchableOpacity>
                  </>
                )}
                <TouchableOpacity style={styles.toolItem} onPress={() => { if (selectedClip) deleteClip(selectedClip.id); }}>
                  <Trash2 color={colors.danger} size={24} />
                  <Text style={[styles.toolText, { color: colors.danger }]}>Delete</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity style={styles.toolItem} onPress={handleAddText}>
                  <Type color={colors.text} size={24} />
                  <Text style={styles.toolText}>Text</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.toolItem} onPress={handlePickAudio}>
                  <Music color={colors.text} size={24} />
                  <Text style={styles.toolText}>Audio</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.toolItem} onPress={() => setActivePanel('stickers')}>
                  <Sticker color={colors.text} size={24} />
                  <Text style={styles.toolText}>Sticker</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        )}

        {/* Real Text Editor Panel */}
        {activePanel === 'text_edit' && (
          <View style={styles.panelContainer}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>Edit Text</Text>
              <TouchableOpacity onPress={() => setActivePanel('main')}><X color={colors.text} size={20}/></TouchableOpacity>
            </View>
            <TextInput
              style={styles.textInputArea}
              value={selectedClip?.textData?.text || ''}
              onChangeText={updateTextValue}
              placeholder="Type here..."
              placeholderTextColor={colors.textSecondary}
              autoFocus
            />
            {selectedClip?.type === 'text' && (
              <View style={styles.textTools}>
                <View style={styles.colorPickerRow}>
                  {textColors.map(c => (
                    <TouchableOpacity
                      key={c}
                      style={[styles.colorSwatch, { backgroundColor: c }, selectedClip?.textData?.color === c && styles.colorSwatchActive]}
                      onPress={() => updateTextColor(c)}
                    />
                  ))}
                </View>
                <View style={styles.alignmentRow}>
                  <TouchableOpacity onPress={() => updateTextAlignment('left')} style={styles.iconButton}>
                    <AlignLeft color={selectedClip?.textData?.alignment === 'left' ? colors.primary : colors.textSecondary} size={24} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => updateTextAlignment('center')} style={styles.iconButton}>
                    <AlignCenter color={(!selectedClip?.textData?.alignment || selectedClip.textData.alignment === 'center') ? colors.primary : colors.textSecondary} size={24} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => updateTextAlignment('right')} style={styles.iconButton}>
                    <AlignRight color={selectedClip?.textData?.alignment === 'right' ? colors.primary : colors.textSecondary} size={24} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Stickers Panel */}
        {activePanel === 'stickers' && (
          <View style={styles.panelContainer}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>Stickers</Text>
              <TouchableOpacity onPress={() => setActivePanel('main')}><X color={colors.text} size={20}/></TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {['😀','🔥','❤️','🎉','✨','👍', '💀', '👀', '💯'].map(emoji => (
                <TouchableOpacity key={emoji} style={styles.filterOption} onPress={() => {
                  addTextClip(emoji, playheadPos, 3000);
                  setActivePanel('main');
                }}>
                  <Text style={{fontSize: 32}}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Filters Panel */}
        {activePanel === 'filters' && (
          <View style={styles.panelContainer}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>Filters</Text>
              <TouchableOpacity onPress={() => setActivePanel('main')}><X color={colors.text} size={20}/></TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {['None', 'Cinematic', 'Vintage', 'B&W', 'Vibrant'].map(f => (
                <TouchableOpacity key={f} style={styles.filterOption} onPress={() => applyFilter(f)}>
                  <Text style={styles.filterOptionText}>{f}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Adjustments Panel (Fully Realized) */}
        {activePanel === 'adjustments' && (
          <View style={styles.panelContainer}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>Adjustments</Text>
              <TouchableOpacity onPress={() => setActivePanel('main')}><X color={colors.text} size={20}/></TouchableOpacity>
            </View>
            <ScrollView>
              {renderSlider("Brightness", "brightness")}
              {renderSlider("Contrast", "contrast")}
              {renderSlider("Saturation", "saturation")}
              {renderSlider("Exposure", "exposure")}
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

  previewContainer: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', position: 'relative' },
  mediaPreview: { width: '100%', height: '100%' },
  hasFilterPlaceholder: { opacity: 0.9 },
  emptyPreview: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { ...typography.body, color: colors.textSecondary },

  textOverlay: { position: 'absolute', width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', pointerEvents: 'none' },
  overlayText: { fontWeight: 'bold', textShadowColor: 'rgba(0,0,0,0.75)', textShadowOffset: { width: -1, height: 1 }, textShadowRadius: 10 },
  filterBadge: { position: 'absolute', top: 16, right: 16, backgroundColor: colors.surfaceGlass, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  filterBadgeText: { color: colors.text, fontSize: 10, fontWeight: '600' },

  timelineContainer: { height: 250, backgroundColor: colors.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  timelineToolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  timecode: { ...typography.caption, color: colors.primary, fontVariant: ['tabular-nums'] },
  playButton: { backgroundColor: colors.primary, width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  timelineWrapper: { flex: 1 },

  toolsMenu: { height: 180, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background, justifyContent: 'flex-start' },
  toolbarScroll: { flexGrow: 1, justifyContent: 'space-around', alignItems: 'center', paddingHorizontal: 16, height: 80 },
  toolItem: { alignItems: 'center', padding: 12, minWidth: 60 },
  toolText: { ...typography.caption, color: colors.text, marginTop: 4 },

  panelContainer: { flex: 1, padding: 16 },
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  panelTitle: { color: colors.text, fontWeight: 'bold' },
  filterOption: { width: 80, height: 80, backgroundColor: colors.surface, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  filterOptionText: { color: colors.text, fontSize: 12 },

  textInputArea: { backgroundColor: colors.surface, color: colors.text, padding: 16, borderRadius: 8, fontSize: 18, marginBottom: 16 },
  textTools: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  colorPickerRow: { flexDirection: 'row', gap: 8 },
  colorSwatch: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  colorSwatchActive: { borderWidth: 2, borderColor: colors.primary, transform: [{scale: 1.2}] },
  alignmentRow: { flexDirection: 'row', gap: 16 }
});
