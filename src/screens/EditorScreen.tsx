import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, TextInput, ScrollView } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Audio } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Download, Undo, Redo, Play, Pause, Scissors, Trash2, Type, Sliders, Palette, X, Music, Sticker, AlignLeft, AlignCenter, AlignRight, Gauge, ArrowRightLeft, Camera, Layers, CircleDot, Crop, Wand2, Mic } from 'lucide-react-native';
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
    updateMask,
    addVoiceover,
    addCaptions
  } = useTimelineStore();

  const [isPlaying, setIsPlaying] = useState(false);
  const [playheadPos, setPlayheadPos] = useState(0);
  const [activeVideoClip, setActiveVideoClip] = useState<Clip | null>(null);
  const [activeOverlayClips, setActiveOverlayClips] = useState<Clip[]>([]);
  const [activeTextClips, setActiveTextClips] = useState<Clip[]>([]);

  const [activePanel, setActivePanel] = useState<'main' | 'text_edit' | 'filters' | 'adjustments' | 'stickers' | 'speed' | 'effects' | 'transitions' | 'chroma' | 'mask' | 'keyframes' | 'voiceover' | 'captions'>('main');

  // Voiceover State
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecordingVO, setIsRecordingVO] = useState(false);
  const voStartPos = useRef<number>(0);

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
        if (track.type === 'text' || track.type === 'sticker' || track.type === 'caption') textClipsFound.push(clipAtPlayhead);
      }
    }

    if (!foundVideo && timelineData.duration > 0 && playheadPos >= timelineData.duration) {
      setIsPlaying(false);
      setPlayheadPos(timelineData.duration);
      if (isRecordingVO) stopRecording();
    }

    if (foundVideo?.id !== activeVideoClip?.id) {
      setActiveVideoClip(foundVideo);
    }
    setActiveTextClips(textClipsFound);
    setActiveOverlayClips(overlaysFound);
  }, [playheadPos, timelineData, isRecordingVO]);

  const player = useVideoPlayer(
    activeVideoClip?.type === 'video' ? activeVideoClip.mediaUri || null : null,
    (player) => { player.loop = false; }
  );

  useEffect(() => {
    if (activeVideoClip?.type === 'video') {
      const desiredSpeed = activeVideoClip.speed || 1;
      if (player.playbackRate !== desiredSpeed) player.playbackRate = desiredSpeed;
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
    if (isRecordingVO) return; // Prevent seeking while recording
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

  // Voiceover Logic
  const startRecording = async () => {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (perm.status === 'granted') {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        setRecording(recording);
        setIsRecordingVO(true);
        voStartPos.current = playheadPos;
        setIsPlaying(true); // Start playback while recording VO
      }
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  const stopRecording = async () => {
    setIsRecordingVO(false);
    setIsPlaying(false);
    if (!recording) return;

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      const status = await recording.getStatusAsync();
      if (uri && status.durationMillis) {
        await addVoiceover(uri, voStartPos.current, status.durationMillis);
      }
    } catch (error) {
      console.error('Failed to stop recording', error);
    }
    setRecording(null);
  };

  // Captions Logic
  const handleGenerateCaptions = async () => {
    // In a real app, this calls an API (Whisper) with the video audio.
    // For Phase 6 functional representation, we generate mock structured captions.
    const mockCaptions = [
      { text: "Welcome to VFX Studio.", start: 0, duration: 2000 },
      { text: "This is a demonstration of auto captions.", start: 2000, duration: 3000 },
      { text: "It scales automatically on the timeline.", start: 5000, duration: 2500 }
    ];
    await addCaptions(mockCaptions);
    setActivePanel('main');
  };

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${(s % 60).toString().padStart(2, '0')}.${Math.floor((ms % 1000)/100)}`;
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}><ChevronLeft color={colors.text} size={28} /></TouchableOpacity>
        <View style={styles.headerCenter}><Text style={styles.projectName}>{currentProject?.name || 'Project'}</Text></View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={[styles.iconButton, styles.exportButton]} onPress={() => navigation.navigate('Export', { projectId: currentProject?.id || projectId })}>
            <Download color={colors.background} size={20} />
            <Text style={styles.exportText}>Export</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.previewContainer}>
        {activeVideoClip?.type === 'video' ? (
          <VideoView style={styles.mediaPreview} player={player} allowsPictureInPicture={false} nativeControls={false} />
        ) : activeVideoClip?.type === 'image' ? (
          <Image source={{ uri: activeVideoClip.mediaUri }} style={styles.mediaPreview} resizeMode="contain" />
        ) : (
          <View style={styles.emptyPreview}><Text style={styles.emptyText}>No Media at Playhead</Text></View>
        )}

        {/* Text & Caption Overlay */}
        {activeTextClips.map(clip => (
          <View key={clip.id} style={styles.textOverlay}>
            <Text style={[styles.overlayText, {
              color: clip.textData?.color || '#FFF',
              fontSize: clip.textData?.fontSize || 32,
              textAlign: clip.textData?.alignment || 'center',
              backgroundColor: clip.textData?.backgroundColor || 'transparent',
              padding: clip.textData?.backgroundColor ? 8 : 0,
              borderRadius: 8
            }]}>
              {clip.textData?.text}
            </Text>
          </View>
        ))}
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
                <TouchableOpacity style={styles.toolItem} onPress={() => splitClip(selectedClip.id, playheadPos)}>
                  <Scissors color={colors.text} size={24} />
                  <Text style={styles.toolText}>Split</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.toolItem} onPress={() => deleteClip(selectedClip.id)}>
                  <Trash2 color={colors.danger} size={24} />
                  <Text style={[styles.toolText, { color: colors.danger }]}>Delete</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity style={styles.toolItem} onPress={() => addTextClip("New Text", playheadPos, 3000)}>
                  <Type color={colors.text} size={24} />
                  <Text style={styles.toolText}>Text</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.toolItem} onPress={() => setActivePanel('voiceover')}>
                  <Mic color={colors.text} size={24} />
                  <Text style={styles.toolText}>Voiceover</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.toolItem} onPress={() => setActivePanel('captions')}>
                  <Type color={colors.text} size={24} />
                  <Text style={styles.toolText}>Captions</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        )}

        {activePanel === 'voiceover' && (
          <View style={styles.panelContainer}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>Record Voiceover</Text>
              <TouchableOpacity onPress={() => setActivePanel('main')}><X color={colors.text} size={20}/></TouchableOpacity>
            </View>
            <View style={{ alignItems: 'center', justifyContent: 'center', flex: 1 }}>
              <TouchableOpacity
                style={[styles.recordButton, isRecordingVO && styles.recordingActive]}
                onPress={isRecordingVO ? stopRecording : startRecording}
              >
                <Mic color={colors.background} size={40} />
              </TouchableOpacity>
              <Text style={{color: colors.textSecondary, marginTop: 12}}>
                {isRecordingVO ? 'Recording... Tap to stop' : 'Tap to record'}
              </Text>
            </View>
          </View>
        )}

        {activePanel === 'captions' && (
          <View style={styles.panelContainer}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>Auto Captions</Text>
              <TouchableOpacity onPress={() => setActivePanel('main')}><X color={colors.text} size={20}/></TouchableOpacity>
            </View>
            <View style={{ alignItems: 'center', justifyContent: 'center', flex: 1 }}>
              <Text style={{color: colors.textSecondary, textAlign: 'center', marginBottom: 20}}>
                Generate automatic subtitles for the timeline.
              </Text>
              <TouchableOpacity style={styles.actionButton} onPress={handleGenerateCaptions}>
                <Text style={styles.actionButtonText}>Generate Captions</Text>
              </TouchableOpacity>
            </View>
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
  emptyPreview: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { ...typography.body, color: colors.textSecondary },

  textOverlay: { position: 'absolute', width: '100%', height: '100%', justifyContent: 'flex-end', paddingBottom: 40, alignItems: 'center', pointerEvents: 'none' },
  overlayText: { fontWeight: 'bold', textShadowColor: 'rgba(0,0,0,0.75)', textShadowOffset: { width: -1, height: 1 }, textShadowRadius: 10 },

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

  recordButton: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  recordingActive: { backgroundColor: colors.danger, transform: [{ scale: 1.1 }] },

  actionButton: { backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  actionButtonText: { ...typography.button, color: colors.background }
});
