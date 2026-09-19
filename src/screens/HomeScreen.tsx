import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, Settings, Video, Film, Trash2 } from 'lucide-react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { HomeScreenProps } from '../navigation/types';
import { useProjectStore } from '../store/ProjectStore';
import { useTimelineStore } from '../store/TimelineStore';
import { pickMedia } from '../utils/mediaPicker';
import { formatDistanceToNow } from 'date-fns';

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const insets = useSafeAreaInsets();
  const { projects, loadProjects, createEmptyProject, deleteProject } = useProjectStore();
  const { addClipsToMainTrack, loadProjectTimeline } = useTimelineStore();

  useEffect(() => {
    loadProjects();
  }, []);

  const handleNewProject = async () => {
    const assets = await pickMedia(true);
    if (assets && assets.length > 0) {
      const project = await createEmptyProject();
      loadProjectTimeline(project);
      await addClipsToMainTrack(assets);
      // Reload projects list to reflect new project and thumbnail
      await loadProjects();
      navigation.navigate('Editor', { projectId: project.id });
    }
  };

  const renderProjectCard = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.projectCard}
      onPress={() => navigation.navigate('Editor', { projectId: item.id })}
    >
      <View style={styles.thumbnailContainer}>
        {item.thumbnailUri ? (
          <Image source={{ uri: item.thumbnailUri }} style={styles.thumbnail} />
        ) : (
          <View style={styles.thumbnailPlaceholder}>
            <Film color={colors.secondary} size={32} />
          </View>
        )}
      </View>
      <View style={styles.projectInfo}>
        <Text style={styles.projectTitle} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.projectDate}>
          {formatDistanceToNow(item.updatedAt, { addSuffix: true })}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => deleteProject(item.id)}
      >
        <Trash2 color={colors.danger} size={20} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>VFX Studio</Text>
        <TouchableOpacity style={styles.settingsButton}>
          <Settings color={colors.text} size={24} />
        </TouchableOpacity>
      </View>

      <View style={styles.actionSection}>
        <TouchableOpacity style={styles.newProjectButton} onPress={handleNewProject}>
          <View style={styles.newProjectIconContainer}>
            <Plus color={colors.background} size={32} strokeWidth={3} />
          </View>
          <Text style={styles.newProjectText}>New Project</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.projectsSection}>
        <Text style={styles.sectionTitle}>Recent Projects</Text>
        <FlatList
          data={projects}
          keyExtractor={(item) => item.id}
          renderItem={renderProjectCard}
          contentContainerStyle={styles.projectsList}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Video color={colors.secondary} size={48} />
              <Text style={styles.emptyStateText}>No projects yet</Text>
              <Text style={styles.emptyStateSubText}>Create a new project to get started</Text>
            </View>
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  title: { ...typography.h1 },
  settingsButton: { padding: 8, backgroundColor: colors.surface, borderRadius: 20 },
  actionSection: { paddingHorizontal: 20, marginVertical: 24 },
  newProjectButton: { backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 16 },
  newProjectIconContainer: { marginRight: 12 },
  newProjectText: { ...typography.h2, color: colors.background },
  projectsSection: { flex: 1, paddingHorizontal: 20 },
  sectionTitle: { ...typography.h2, marginBottom: 16 },
  projectsList: { paddingBottom: 40 },
  projectCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 16, padding: 12, marginBottom: 12 },
  thumbnailContainer: { width: 80, height: 80, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.border },
  thumbnail: { width: '100%', height: '100%' },
  thumbnailPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  projectInfo: { flex: 1, marginLeft: 16 },
  projectTitle: { ...typography.body, fontWeight: '600', marginBottom: 4 },
  projectDate: { ...typography.caption },
  deleteButton: { padding: 12 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyStateText: { ...typography.body, marginTop: 16, marginBottom: 8 },
  emptyStateSubText: { ...typography.caption }
});
