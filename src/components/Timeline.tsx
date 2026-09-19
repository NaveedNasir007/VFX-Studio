import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTimelineStore } from '../store/TimelineStore';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { Clip } from '../types/models';

interface TimelineProps {
  playheadPosition: number; // in ms
  onSeek: (timeMs: number) => void;
}

const PIXELS_PER_MS = 0.05; // 1 second = 50 pixels

export default function Timeline({ playheadPosition, onSeek }: TimelineProps) {
  const { timelineData, selectedClipId, selectClip } = useTimelineStore();
  const scrollViewRef = useRef<ScrollView>(null);

  // Base styles calculated from timeline duration
  const totalWidth = Math.max(timelineData.duration * PIXELS_PER_MS, 400); // minimum width

  const handleScroll = (event: any) => {
    // If we wanted scrolling to move the playhead, we'd do it here
    // For now, let's just let the playhead move via playback or tapping
  };

  const handleTimelinePress = (event: any) => {
    const tapX = event.nativeEvent.locationX;
    const timeMs = tapX / PIXELS_PER_MS;
    onSeek(timeMs);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ width: totalWidth, paddingRight: '50%' }} // padding allows scrolling playhead to center
      >
        <TouchableOpacity
          activeOpacity={1}
          style={[styles.tracksContainer, { width: totalWidth }]}
          onPress={handleTimelinePress}
        >
          {/* Time Ruler Placeholder */}
          <View style={styles.ruler} />

          {/* Tracks */}
          {timelineData.tracks.map((track, trackIndex) => (
            <View key={track.id} style={styles.track}>
              {track.clips.map(clip => {
                const left = clip.start * PIXELS_PER_MS;
                const width = clip.duration * PIXELS_PER_MS;
                const isSelected = selectedClipId === clip.id;

                return (
                  <TouchableOpacity
                    key={clip.id}
                    activeOpacity={0.8}
                    style={[
                      styles.clip,
                      { left, width },
                      isSelected && styles.clipSelected
                    ]}
                    onPress={() => selectClip(clip.id)}
                  >
                    <Text style={styles.clipText} numberOfLines={1}>
                      {clip.type === 'video' ? '🎬' : '📷'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}

          {/* Playhead */}
          <View style={[styles.playhead, { left: playheadPosition * PIXELS_PER_MS }]} pointerEvents="none" />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  tracksContainer: {
    paddingVertical: 16,
    position: 'relative',
    minHeight: 150,
  },
  ruler: {
    height: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 8,
  },
  track: {
    height: 60,
    backgroundColor: colors.surface,
    marginBottom: 8,
    borderRadius: 8,
    position: 'relative',
  },
  clip: {
    position: 'absolute',
    height: '100%',
    backgroundColor: colors.border,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.secondary,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  clipSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: colors.surfaceGlass,
  },
  clipText: {
    ...typography.caption,
    color: colors.text,
  },
  playhead: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: colors.primary,
    zIndex: 10,
    transform: [{ translateX: -1 }],
  }
});
