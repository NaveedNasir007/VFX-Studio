import React, { useRef, useMemo, memo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { PanGestureHandler, State, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useTimelineStore } from '../store/TimelineStore';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { Track, Clip } from '../types/models';

interface TimelineProps {
  playheadPosition: number; // in ms
  onSeek: (timeMs: number) => void;
}

const PIXELS_PER_MS = 0.05; // 1 second = 50 pixels

// Memoized individual Clip component to prevent massive re-renders
const TimelineClip = memo(({
  clip,
  track,
  isSelected,
  onSelect
}: {
  clip: Clip;
  track: Track;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) => {
  const moveClipPosition = useTimelineStore(state => state.moveClipPosition);

  const left = clip.start * PIXELS_PER_MS;
  const width = clip.duration * PIXELS_PER_MS;

  let icon = '🎬';
  let bgColor = colors.border;
  if (clip.type === 'image') icon = '📷';
  if (clip.type === 'text' || clip.type === 'caption') { icon = 'T'; bgColor = '#4A5568'; }
  if (clip.type === 'audio' || clip.type === 'voiceover') { icon = '🎤'; bgColor = '#2F855A'; }

  const isMainTrack = track.type === 'video' && track.id === 'main' && !track.isOverlay;

  // Gesture handling for free-moving clips (non-main sequence)
  const handlePan = (event: any) => {
    if (isMainTrack) return; // Sequence tracks can't be freely moved, only reordered via UI
    const { translationX, state } = event.nativeEvent;

    if (state === State.END) {
      const msDelta = translationX / PIXELS_PER_MS;
      const newStart = Math.max(0, clip.start + msDelta);
      moveClipPosition(clip.id, newStart);
    }
  };

  return (
    <PanGestureHandler onHandlerStateChange={handlePan} enabled={!isMainTrack}>
      <View style={{position: 'absolute', left, width, height: '100%'}}>
        <TouchableOpacity
          activeOpacity={0.8}
          style={[
            styles.clip,
            { backgroundColor: bgColor },
            isSelected && styles.clipSelected
          ]}
          onPress={() => onSelect(clip.id)}
        >
          <Text style={styles.clipText} numberOfLines={1}>
            {icon} {clip.textData?.text ? `"${clip.textData.text}"` : ''}
          </Text>
        </TouchableOpacity>
      </View>
    </PanGestureHandler>
  );
}, (prevProps, nextProps) => {
  return prevProps.clip === nextProps.clip && prevProps.isSelected === nextProps.isSelected;
});

// Memoized Track component
const TimelineTrack = memo(({
  track,
  selectedClipId,
  onSelect
}: {
  track: Track;
  selectedClipId: string | null;
  onSelect: (id: string) => void;
}) => {
  const isText = track.type === 'text' || track.type === 'caption';
  const isAudio = track.type === 'audio' || track.type === 'voiceover';

  return (
    <View style={[styles.track, isText && styles.textTrack, isAudio && styles.audioTrack]}>
      {track.clips.map(clip => (
        <TimelineClip
          key={clip.id}
          clip={clip}
          track={track}
          isSelected={selectedClipId === clip.id}
          onSelect={onSelect}
        />
      ))}
    </View>
  );
});

export default function Timeline({ playheadPosition, onSeek }: TimelineProps) {
  const { timelineData, selectedClipId, selectClip } = useTimelineStore();
  const scrollViewRef = useRef<ScrollView>(null);

  const totalWidth = useMemo(() => Math.max(timelineData.duration * PIXELS_PER_MS, 400), [timelineData.duration]);

  const handleTimelinePress = (event: any) => {
    const tapX = event.nativeEvent.locationX;
    const timeMs = tapX / PIXELS_PER_MS;
    onSeek(timeMs);
  };

  // Group tracks for organized rendering
  const { textTracks, videoTracks, audioTracks } = useMemo(() => {
    return {
      textTracks: timelineData.tracks.filter(t => t.type === 'text' || t.type === 'sticker' || t.type === 'caption'),
      videoTracks: timelineData.tracks.filter(t => t.type === 'video'),
      audioTracks: timelineData.tracks.filter(t => t.type === 'audio' || t.type === 'voiceover')
    };
  }, [timelineData.tracks]);

  return (
    <GestureHandlerRootView style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ width: totalWidth, paddingRight: '50%' }}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={[styles.tracksContainer, { width: totalWidth }]}
          onPress={handleTimelinePress}
        >
          <View style={styles.ruler} />

          {textTracks.map(track => <TimelineTrack key={track.id} track={track} selectedClipId={selectedClipId} onSelect={selectClip} />)}
          {videoTracks.map(track => <TimelineTrack key={track.id} track={track} selectedClipId={selectedClipId} onSelect={selectClip} />)}
          {audioTracks.map(track => <TimelineTrack key={track.id} track={track} selectedClipId={selectedClipId} onSelect={selectClip} />)}

          <View style={[styles.playhead, { left: playheadPosition * PIXELS_PER_MS }]} pointerEvents="none" />
        </TouchableOpacity>
      </ScrollView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  tracksContainer: { paddingVertical: 16, position: 'relative', minHeight: 150 },
  ruler: { height: 20, borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 8 },
  track: { height: 50, backgroundColor: colors.surface, marginBottom: 4, borderRadius: 8, position: 'relative' },
  textTrack: { height: 36, backgroundColor: 'transparent' },
  audioTrack: { height: 36, backgroundColor: colors.surface, opacity: 0.8 },
  clip: { width: '100%', height: '100%', borderRadius: 6, borderWidth: 1, borderColor: colors.secondary, justifyContent: 'center', paddingHorizontal: 8 },
  clipSelected: { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.surfaceGlass },
  clipText: { ...typography.caption, color: colors.text, fontSize: 11 },
  playhead: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: colors.primary, zIndex: 10, transform: [{ translateX: -1 }] }
});
