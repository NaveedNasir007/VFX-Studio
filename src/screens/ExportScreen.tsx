import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Download, CheckCircle } from 'lucide-react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useTimelineStore } from '../store/TimelineStore';
import { ExportService, ExportOptions } from '../core/ExportService';
import * as MediaLibrary from 'expo-media-library';

type Props = NativeStackScreenProps<RootStackParamList, 'Export'>;

export default function ExportScreen({ route, navigation }: Props) {
  const { projectId } = route.params;
  const insets = useSafeAreaInsets();
  const { currentProject, timelineData } = useTimelineStore();

  const [resolution, setResolution] = useState<ExportOptions['resolution']>('1080p');
  const [fps, setFps] = useState<ExportOptions['fps']>(30);
  const [quality, setQuality] = useState<ExportOptions['quality']>('high');

  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [exportComplete, setExportComplete] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleExport = async () => {
    if (!currentProject) return;

    // Request permission to save to gallery
    const perm = await MediaLibrary.requestPermissionsAsync();
    if (perm.status !== 'granted') {
      setErrorMsg("Requires photo gallery permission to save video.");
      return;
    }

    setIsExporting(true);
    setProgress(0);
    setErrorMsg(null);

    try {
      const outputPath = await ExportService.exportProject(currentProject, timelineData, {
        resolution,
        fps,
        quality,
        onProgress: (p) => setProgress(p)
      });

      await MediaLibrary.saveToLibraryAsync(outputPath);
      setExportComplete(true);
    } catch (err: any) {
      setErrorMsg(err.message || "An unknown error occurred during export.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleCancel = async () => {
    await ExportService.cancelExport();
    setIsExporting(false);
    setProgress(0);
  };

  const getEstimatedSize = () => {
    // Rough estimation
    let base = timelineData.duration / 1000; // seconds
    let mult = 1;
    if (resolution === '4k') mult *= 4;
    else if (resolution === '720p') mult *= 0.5;
    if (fps === 60) mult *= 2;
    if (quality === 'low') mult *= 0.5;
    else if (quality === 'high') mult *= 1.5;

    return Math.max(1, Math.round(base * mult * 0.5)); // MB
  };

  if (exportComplete) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
        <CheckCircle color={colors.success} size={64} style={{marginBottom: 24}} />
        <Text style={styles.title}>Export Complete!</Text>
        <Text style={{color: colors.textSecondary, marginTop: 8}}>Video saved to device gallery.</Text>
        <TouchableOpacity style={[styles.exportButton, {marginTop: 32}]} onPress={() => navigation.navigate('Home')}>
          <Text style={styles.exportButtonText}>Done</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
          <ChevronLeft color={colors.text} size={28} />
        </TouchableOpacity>
        <Text style={typography.h2}>Export Settings</Text>
        <View style={{width: 44}} />
      </View>

      <View style={styles.content}>
        <Text style={styles.sectionLabel}>Resolution</Text>
        <View style={styles.pillContainer}>
          {(['720p', '1080p', '4k'] as const).map(res => (
            <TouchableOpacity key={res} style={[styles.pill, resolution === res && styles.pillActive]} onPress={() => setResolution(res)}>
              <Text style={[styles.pillText, resolution === res && styles.pillTextActive]}>{res}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Frame Rate</Text>
        <View style={styles.pillContainer}>
          {([24, 30, 60]).map(f => (
            <TouchableOpacity key={f} style={[styles.pill, fps === f && styles.pillActive]} onPress={() => setFps(f)}>
              <Text style={[styles.pillText, fps === f && styles.pillTextActive]}>{f} fps</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Quality</Text>
        <View style={styles.pillContainer}>
          {(['low', 'medium', 'high'] as const).map(q => (
            <TouchableOpacity key={q} style={[styles.pill, quality === q && styles.pillActive]} onPress={() => setQuality(q)}>
              <Text style={[styles.pillText, quality === q && styles.pillTextActive]}>{q.charAt(0).toUpperCase() + q.slice(1)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.estimationBox}>
          <Text style={{color: colors.textSecondary}}>Estimated File Size</Text>
          <Text style={typography.h1}>~{getEstimatedSize()} MB</Text>
        </View>

        {errorMsg && (
          <View style={styles.errorBox}>
            <Text style={{color: colors.danger}}>{errorMsg}</Text>
          </View>
        )}

        <View style={{flex: 1}} />

        {isExporting ? (
          <View style={styles.progressContainer}>
            <Text style={{color: colors.text, marginBottom: 8}}>Exporting... {Math.round(progress * 100)}%</Text>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, {width: `${progress * 100}%`}]} />
            </View>
            <TouchableOpacity style={{marginTop: 16}} onPress={handleCancel}>
              <Text style={{color: colors.danger}}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.exportButton} onPress={handleExport}>
            <Download color={colors.background} size={24} style={{marginRight: 8}} />
            <Text style={styles.exportButtonText}>Export Video</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 60, borderBottomWidth: 1, borderBottomColor: colors.border },
  iconButton: { padding: 8, justifyContent: 'center', alignItems: 'center' },
  title: { ...typography.h1 },

  content: { flex: 1, padding: 24 },
  sectionLabel: { ...typography.body, fontWeight: '600', marginBottom: 12, marginTop: 24 },

  pillContainer: { flexDirection: 'row', gap: 12 },
  pill: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
  pillTextActive: { color: colors.background },

  estimationBox: { marginTop: 40, padding: 20, backgroundColor: colors.surface, borderRadius: 12, alignItems: 'center' },

  errorBox: { marginTop: 24, padding: 16, backgroundColor: 'rgba(255, 69, 58, 0.1)', borderRadius: 8, borderWidth: 1, borderColor: colors.danger },

  exportButton: { backgroundColor: colors.primary, padding: 16, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 32 },
  exportButtonText: { ...typography.h2, color: colors.background },

  progressContainer: { alignItems: 'center', marginBottom: 32 },
  progressBarBg: { width: '100%', height: 8, backgroundColor: colors.surface, borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: colors.primary }
});
