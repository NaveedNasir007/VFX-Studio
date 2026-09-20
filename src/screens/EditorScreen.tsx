import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Image } from 'expo-image';
import { Audio } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Download, Undo, Redo, Play, Pause, Scissors, Trash2, Type, Sliders, Palette, X, Music, Sticker, AlignLeft, AlignCenter, AlignRight, Gauge, ArrowRightLeft, Camera, Layers, CircleDot, Crop, Wand2, Mic, Activity } from 'lucide-react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { EditorScreenProps } from '../navigation/types';
import { useTimelineStore } from '../store/TimelineStore';
import { useProjectStore } from '../store/ProjectStore';
import Timeline from '../components/Timeline';
import { Clip } from '../types/models';
import * as DocumentPicker from 'expo-document-picker';
import { AIService } from '../core/AIService';
import { pickMedia } from '../utils/mediaPicker';
import { DebouncedSlider as Slider } from '../components/DebouncedSlider';

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

    if (foundVideo?.id !== activeVideoClip?.id) setActiveVideoClip(foundVideo);
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
    if (isRecordingVO) return;
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

  const handleAddOverlay = async () => {
    const assets = await pickMedia(false);
    if (assets && assets.length > 0) {
      const asset = assets[0];
      const duration = asset.type === 'video' && asset.duration ? asset.duration : 3000;
      await addOverlayClip(asset.uri, asset.type as 'video'|'image', playheadPos, duration);
    }
  };

  const startRecording = async () => {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (perm.status === 'granted') {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        setRecording(recording);
        setIsRecordingVO(true);
        voStartPos.current = playheadPos;
        setIsPlaying(true);
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

  const handleGenerateCaptions = async () => {
    if (!activeVideoClip?.mediaUri) return;
    try {
      // Offload to real AI architecture
      const generated = await AIService.generateCaptions(activeVideoClip.mediaUri);
      await addCaptions(generated);
      setActivePanel('main');
    } catch (e) {
      console.error(e);
    }
  };

  const applyFilter = (filterName: string) => {
    if (selectedClipId) updateClipProperties(selectedClipId, { filter: { id: filterName, name: filterName, intensity: 1 } });
  };

  const updateTextValue = (val: string) => {
    if (selectedClipId && (selectedClip?.type === 'text' || selectedClip?.type === 'sticker')) {
      const currentTextData = selectedClip.textData || { text: '' };
      updateClipProperties(selectedClipId, { textData: { ...currentTextData, text: val } });
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
          <TouchableOpacity style={[styles.iconButton, styles.exportButton]} onPress={() => navigation.navigate('Export', { projectId: currentProject?.id || projectId })}>
            <Download color={colors.background} size={20} />
            <Text style={styles.exportText}>Export</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.previewContainer}>
        {activeVideoClip?.type === 'video' ? (
          <VideoView style={[styles.mediaPreview, activeVideoClip.filter ? styles.hasFilterPlaceholder : {}]} player={player} allowsPictureInPicture={false} nativeControls={false} />
        ) : activeVideoClip?.type === 'image' ? (
          <Image source={activeVideoClip.mediaUri} contentFit="contain" style={[styles.mediaPreview, activeVideoClip.filter ? styles.hasFilterPlaceholder : {}]} />
        ) : (
          <View style={styles.emptyPreview}><Text style={styles.emptyText}>No Media at Playhead</Text></View>
        )}

        {/* Phase 5: Overlays (Picture-in-Picture) */}
        {activeOverlayClips.map(clip => {
          const scale = clip.scale || 0.5;
          const maskStyle = clip.mask?.type === 'circle' ? { borderRadius: 1000 } : {};
          const chromaStyle = clip.chromaKey?.enabled ? { opacity: 0.8, backgroundColor: 'rgba(0,255,0,0.3)' } : {};
          return (
            <View key={clip.id} style={[styles.overlayContainer, { transform: [{ scale }] }, maskStyle, chromaStyle]}>
              {clip.type === 'image' ? (
                <Image source={clip.mediaUri} contentFit="cover" style={{ width: '100%', height: '100%' }} />
              ) : (
                <View style={styles.pipPlaceholder}><Text style={{ color: '#fff' }}>PIP Video</Text></View>
              )}
            </View>
          )
        })}

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

        <View style={styles.badgeContainer}>
          {activeVideoClip?.filter && <View style={styles.badge}><Text style={styles.badgeText}>{activeVideoClip.filter.name}</Text></View>}
          {activeVideoClip?.effect && <View style={styles.badge}><Text style={styles.badgeText}>{activeVideoClip.effect.name}</Text></View>}
          {activeVideoClip?.speed && activeVideoClip.speed !== 1 && <View style={styles.badge}><Text style={styles.badgeText}>{activeVideoClip.speed}x</Text></View>}
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
                <TouchableOpacity style={styles.toolItem} onPress={() => splitClip(selectedClip.id, playheadPos)}>
                  <Scissors color={colors.text} size={24} />
                  <Text style={styles.toolText}>Split</Text>
                </TouchableOpacity>
                {selectedClip.type === 'video' && (
                  <TouchableOpacity style={styles.toolItem} onPress={() => setActivePanel('speed')}>
                    <Gauge color={colors.text} size={24} />
                    <Text style={styles.toolText}>Speed</Text>
                  </TouchableOpacity>
                )}
                {selectedClip.type === 'video' && (
                  <TouchableOpacity style={styles.toolItem} onPress={() => toggleClipReverse(selectedClip.id)}>
                    <ArrowRightLeft color={selectedClip.isReversed ? colors.primary : colors.text} size={24} />
                    <Text style={[styles.toolText, selectedClip.isReversed && { color: colors.primary }]}>Reverse</Text>
                  </TouchableOpacity>
                )}
                {selectedClip.type === 'video' && (
                  <TouchableOpacity style={styles.toolItem} onPress={() => insertFreezeFrame(selectedClip.id, playheadPos)}>
                    <Camera color={colors.text} size={24} />
                    <Text style={styles.toolText}>Freeze</Text>
                  </TouchableOpacity>
                )}
                {(selectedClip.type === 'text' || selectedClip.type === 'sticker') && (
                  <TouchableOpacity style={styles.toolItem} onPress={() => setActivePanel('text_edit')}>
                    <Type color={colors.text} size={24} />
                    <Text style={styles.toolText}>Edit Text</Text>
                  </TouchableOpacity>
                )}
                {selectedClip.type !== 'audio' && selectedClip.type !== 'text' && selectedClip.type !== 'sticker' && selectedClip.type !== 'caption' && (
                  <>
                    <TouchableOpacity style={styles.toolItem} onPress={() => setActivePanel('effects')}>
                      <Activity color={colors.text} size={24} />
                      <Text style={styles.toolText}>Effects</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.toolItem} onPress={() => setActivePanel('transitions')}>
                      <Activity color={colors.text} size={24} />
                      <Text style={styles.toolText}>Transition</Text>
                    </TouchableOpacity>
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
                <TouchableOpacity style={styles.toolItem} onPress={handleAddOverlay}>
                  <Layers color={colors.text} size={24} />
                  <Text style={styles.toolText}>Overlay</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.toolItem} onPress={async () => {
                  try {
                    const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*' });
                    if (!result.canceled && result.assets.length > 0) {
                      await addAudioClip(result.assets[0].uri, playheadPos, 10000);
                    }
                  } catch (e) {}
                }}>
                  <Music color={colors.text} size={24} />
                  <Text style={styles.toolText}>Audio</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.toolItem} onPress={() => setActivePanel('voiceover')}>
                  <Mic color={colors.text} size={24} />
                  <Text style={styles.toolText}>Voiceover</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.toolItem} onPress={() => setActivePanel('captions')}>
                  <Type color={colors.text} size={24} />
                  <Text style={styles.toolText}>Captions</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.toolItem} onPress={() => setActivePanel('stickers')}>
                  <Sticker color={colors.text} size={24} />
                  <Text style={styles.toolText}>Sticker</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        )}

        {/* Text Edit Panel */}
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
          </View>
        )}

        {/* Speed Panel */}
        {activePanel === 'speed' && (
          <View style={styles.panelContainer}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>Speed</Text>
              <TouchableOpacity onPress={() => setActivePanel('main')}><X color={colors.text} size={20}/></TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {[0.25, 0.5, 1, 1.5, 2, 4].map(s => (
                <TouchableOpacity key={s} style={[styles.filterOption, selectedClip?.speed === s && styles.clipSelected]} onPress={() => selectedClipId && updateClipSpeed(selectedClipId, s)}>
                  <Text style={styles.filterOptionText}>{s}x</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Effects & Transitions Panels */}
        {activePanel === 'effects' && (
          <View style={styles.panelContainer}>
            <View style={styles.panelHeader}><Text style={styles.panelTitle}>Effects</Text><TouchableOpacity onPress={() => setActivePanel('main')}><X color={colors.text} size={20}/></TouchableOpacity></View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {['None', 'Glitch', 'Shake', 'Flash', 'RGB Split'].map(e => (
                <TouchableOpacity key={e} style={styles.filterOption} onPress={() => selectedClipId && applyEffect(selectedClipId, e === 'None' ? undefined as any : { id: e, name: e, intensity: 1 })}>
                  <Text style={styles.filterOptionText}>{e}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {activePanel === 'transitions' && (
          <View style={styles.panelContainer}>
            <View style={styles.panelHeader}><Text style={styles.panelTitle}>Transition (In)</Text><TouchableOpacity onPress={() => setActivePanel('main')}><X color={colors.text} size={20}/></TouchableOpacity></View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {['None', 'Fade', 'Dissolve', 'Slide Right', 'Zoom In'].map(t => (
                <TouchableOpacity key={t} style={styles.filterOption} onPress={() => selectedClipId && applyTransition(selectedClipId, t === 'None' ? undefined as any : { id: t, name: t, durationMs: 1000 }, 'in')}>
                  <Text style={styles.filterOptionText}>{t}</Text>
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

        {/* Adjustments Panel */}
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

        {/* Voiceover Panel */}
        {activePanel === 'voiceover' && (
          <View style={styles.panelContainer}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>Record Voiceover</Text>
              <TouchableOpacity onPress={() => setActivePanel('main')}><X color={colors.text} size={20}/></TouchableOpacity>
            </View>
            <View style={{ alignItems: 'center', justifyContent: 'center', flex: 1 }}>
              <TouchableOpacity style={[styles.recordButton, isRecordingVO && styles.recordingActive]} onPress={isRecordingVO ? stopRecording : startRecording}>
                <Mic color={colors.background} size={40} />
              </TouchableOpacity>
              <Text style={{color: colors.textSecondary, marginTop: 12}}>
                {isRecordingVO ? 'Recording... Tap to stop' : 'Tap to record'}
              </Text>
            </View>
          </View>
        )}

        {/* Captions Panel */}
        {activePanel === 'captions' && (
          <View style={styles.panelContainer}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>Auto Captions</Text>
              <TouchableOpacity onPress={() => setActivePanel('main')}><X color={colors.text} size={20}/></TouchableOpacity>
            </View>
            <View style={{ alignItems: 'center', justifyContent: 'center', flex: 1 }}>
              <Text style={{color: colors.textSecondary, textAlign: 'center', marginBottom: 20}}>Generate automatic subtitles for the timeline.</Text>
              <TouchableOpacity style={styles.actionButton} onPress={handleGenerateCaptions}>
                <Text style={styles.actionButtonText}>Generate Captions</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Chroma & Mask Panels */}
        {activePanel === 'chroma' && (
          <View style={styles.panelContainer}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>Chroma Key</Text>
              <TouchableOpacity onPress={() => setActivePanel('main')}><X color={colors.text} size={20}/></TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <TouchableOpacity style={styles.filterOption} onPress={() => selectedClipId && updateChromaKey(selectedClipId, { enabled: true, colorHex: '#00FF00', intensity: 0.5, shadow: 0.2 })}>
                <Text style={styles.filterOptionText}>Enable</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.filterOption} onPress={() => selectedClipId && updateChromaKey(selectedClipId, { enabled: false, colorHex: '#00FF00', intensity: 0.5, shadow: 0.2 })}>
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
                <TouchableOpacity key={m} style={styles.filterOption} onPress={() => selectedClipId && updateMask(selectedClipId, { type: m as any, feather: 0.2, invert: false })}>
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

  textOverlay: { position: 'absolute', width: '100%', height: '100%', justifyContent: 'flex-end', paddingBottom: 40, alignItems: 'center', pointerEvents: 'none' },
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

  toolsMenu: { height: 180, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background, justifyContent: 'flex-start' },
  toolbarScroll: { flexGrow: 1, justifyContent: 'space-around', alignItems: 'center', paddingHorizontal: 16, height: 80 },
  toolItem: { alignItems: 'center', padding: 12, minWidth: 60 },
  toolText: { ...typography.caption, color: colors.text, marginTop: 4 },

  panelContainer: { flex: 1, padding: 16 },
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  panelTitle: { color: colors.text, fontWeight: 'bold' },
  filterOption: { width: 80, height: 80, backgroundColor: colors.surface, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  filterOptionText: { color: colors.text, fontSize: 12 },
  clipSelected: { borderColor: colors.primary, borderWidth: 2 },

  textInputArea: { backgroundColor: colors.surface, color: colors.text, padding: 16, borderRadius: 8, fontSize: 18, marginBottom: 16 },

  recordButton: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  recordingActive: { backgroundColor: colors.danger, transform: [{ scale: 1.1 }] },

  actionButton: { backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  actionButtonText: { ...typography.button, color: colors.background }
});
