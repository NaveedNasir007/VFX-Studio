import React, { useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTimelineStore } from '../store/TimelineStore';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { Track } from '../types/models';

interface TimelineProps {
  playheadPosition: number; // in ms
  onSeek: (timeMs: number) => void;
}

const PIXELS_PER_MS = 0.05; // 1 second = 50 pixels

export default function Timeline({ playheadPosition, onSeek }: TimelineProps) {
  const { timelineData, selectedClipId, selectClip } = useTimelineStore();
  const scrollViewRef = useRef<ScrollView>(null);

  const totalWidth = Math.max(timelineData.duration * PIXELS_PER_MS, 400);

  const handleTimelinePress = (event: any) => {
    const tapX = event.nativeEvent.locationX;
    const timeMs = tapX / PIXELS_PER_MS;
    onSeek(timeMs);
  };

  const renderTrack = (track: Track) => {
    // Styling depending on track type
    const isText = track.type === 'text';
    const isAudio = track.type === 'audio';

    return (
      <View key={track.id} style={[styles.track, isText && styles.textTrack, isAudio && styles.audioTrack]}>
        {track.clips.map(clip => {
          const left = clip.start * PIXELS_PER_MS;
          const width = clip.duration * PIXELS_PER_MS;
          const isSelected = selectedClipId === clip.id;

          let icon = '🎬';
          let bgColor = colors.border;
          if (clip.type === 'image') icon = '📷';
          if (clip.type === 'text' || clip.type === 'caption') { icon = 'T'; bgColor = '#4A5568'; } // grayish blue
          if (clip.type === 'audio' || clip.type === 'voiceover') { icon = '🎤'; bgColor = '#2F855A'; } // greenish

          return (
            <TouchableOpacity
              key={clip.id}
              activeOpacity={0.8}
              style={[
                styles.clip,
                { left, width, backgroundColor: bgColor },
                isSelected && styles.clipSelected
              ]}
              onPress={() => selectClip(clip.id)}
            >
              <Text style={styles.clipText} numberOfLines={1}>
                {icon} {clip.textData?.text ? `"${clip.textData.text}"` : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  // Order tracks: Text top, Video middle, Audio bottom
  const textTracks = timelineData.tracks.filter(t => t.type === 'text' || t.type === 'sticker' || t.type === 'caption');
  const videoTracks = timelineData.tracks.filter(t => t.type === 'video');
  const audioTracks = timelineData.tracks.filter(t => t.type === 'audio' || t.type === 'voiceover');

  return (
    <View style={styles.container}>
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

          {textTracks.map(renderTrack)}
          {videoTracks.map(renderTrack)}
          {audioTracks.map(renderTrack)}

          <View style={[styles.playhead, { left: playheadPosition * PIXELS_PER_MS }]} pointerEvents="none" />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  tracksContainer: { paddingVertical: 16, position: 'relative', minHeight: 150 },
  ruler: { height: 20, borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 8 },
  track: { height: 50, backgroundColor: colors.surface, marginBottom: 4, borderRadius: 8, position: 'relative' },
  textTrack: { height: 36, backgroundColor: 'transparent' },
  audioTrack: { height: 36, backgroundColor: colors.surface, opacity: 0.8 },
  clip: { position: 'absolute', height: '100%', borderRadius: 6, borderWidth: 1, borderColor: colors.secondary, justifyContent: 'center', paddingHorizontal: 8 },
  clipSelected: { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.surfaceGlass },
  clipText: { ...typography.caption, color: colors.text, fontSize: 11 },
  playhead: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: colors.primary, zIndex: 10, transform: [{ translateX: -1 }] }
});
