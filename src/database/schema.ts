import * as SQLite from 'expo-sqlite';
import { Project } from '../types/models';

export const initDatabase = async () => {
  const db = await SQLite.openDatabaseAsync('vfxstudio.db');

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      resolution TEXT NOT NULL,
      fps INTEGER NOT NULL,
      thumbnailUri TEXT,
      timelineData TEXT NOT NULL
    );
  `);

  return db;
};

export const getDb = async () => {
  return await SQLite.openDatabaseAsync('vfxstudio.db');
};
