import { getDb } from './schema';
import { Project } from '../types/models';

export const ProjectService = {
  async getAllProjects(): Promise<Project[]> {
    const db = await getDb();
    const allRows = await db.getAllAsync<Project>('SELECT * FROM projects ORDER BY updatedAt DESC');
    return allRows;
  },

  async getProject(id: string): Promise<Project | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<Project>('SELECT * FROM projects WHERE id = ?', [id]);
    return row || null;
  },

  async createProject(project: Project): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      `INSERT INTO projects (id, name, createdAt, updatedAt, resolution, fps, thumbnailUri, timelineData)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        project.id,
        project.name,
        project.createdAt,
        project.updatedAt,
        project.resolution,
        project.fps,
        project.thumbnailUri,
        project.timelineData
      ]
    );
  },

  async updateProject(project: Project): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      `UPDATE projects
       SET name = ?, updatedAt = ?, resolution = ?, fps = ?, thumbnailUri = ?, timelineData = ?
       WHERE id = ?`,
      [
        project.name,
        Date.now(),
        project.resolution,
        project.fps,
        project.thumbnailUri,
        project.timelineData,
        project.id
      ]
    );
  },

  async deleteProject(id: string): Promise<void> {
    const db = await getDb();
    await db.runAsync('DELETE FROM projects WHERE id = ?', [id]);
  }
};
