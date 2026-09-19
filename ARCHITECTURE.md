# VFX Studio Architecture

## 1. Technology Choices
- **Framework**: Expo / React Native (TypeScript). We are using Expo because it provides a highly robust development environment, over-the-air updates, and seamless integration with native modules through Expo Modules and Development Builds. TypeScript ensures strong typing across our media models and state.
- **Video Processing Engine**: `ffmpeg-kit-react-native` (Native FFmpeg wrapper). This will be our core for operations like extracting audio, applying heavy filters, resizing, and the final export pipeline. For real-time playback, we will use Expo Video or `react-native-video`.
- **Database**: `expo-sqlite`. A local SQLite database is perfect for structured project data, allowing us to store complex timeline states, asset references, and metadata without loading huge JSON objects into memory.
- **State Management**: `zustand`. Zustand provides a fast, minimal, and scalable global state without the boilerplate of Redux. It handles fast updates well, which is crucial for a responsive timeline where the playhead is constantly moving.
- **Styling**: `react-native-reanimated` for 60fps animations and transitions, combined with standard React Native `StyleSheet` for theming (Apple-like glassy aesthetic: deep blacks, minimal whites, gray accents, and blur effects via `@react-native-community/blur` or `expo-blur`).

## 2. Folder Structure
```
/src
  /assets         # Local static assets (fonts, icons, default stickers)
  /components     # Reusable UI components (Buttons, GlassyPanels, TimelineTracks)
  /core           # Core processing logic (FFmpeg wrappers, Export pipeline)
  /database       # SQLite schema, queries, and migrations
  /hooks          # Custom React hooks
  /navigation     # React Navigation setup
  /screens        # Main application screens (Home, Editor, Export)
  /store          # Zustand state stores (ProjectStore, TimelineStore)
  /theme          # Color palettes, typography, spacing
  /types          # Global TypeScript interfaces
  /utils          # Helper functions (Time formatters, File system helpers)
```

## 3. Data Models
### Project Model (SQLite)
- `id` (UUID)
- `name` (String)
- `createdAt` (Timestamp)
- `updatedAt` (Timestamp)
- `resolution` (String, e.g., '1080p')
- `fps` (Integer)
- `thumbnailUri` (String - reference to local file)
- `timelineData` (JSON String - serialized timeline state)

### Timeline Model (Zustand -> Serialized to DB)
- `tracks`: Array of `Track` objects
- `duration`: Total duration in ms
- `playheadPosition`: Current time in ms

### Track Model
- `id` (UUID)
- `type` ('video' | 'audio' | 'text' | 'effect')
- `clips`: Array of `Clip` objects

### Clip Model
- `id` (UUID)
- `mediaUri` (String - reference to original/proxy file)
- `type` ('video' | 'image' | 'audio')
- `start` (Timeline start time)
- `duration` (Duration on timeline)
- `mediaStart` (Offset in the original media file)
- `mediaDuration` (Duration of the original media file used)
- `filters` / `effects` / `transform` (Scale, rotation, position)

## 4. Timeline Architecture
The timeline must support multi-layered tracks. We will use a nested data structure managed by Zustand. To ensure performance, the timeline UI will use `react-native-reanimated` for horizontal scrolling and playhead movement to avoid React re-renders on every frame. We will use lazy loading (`FlatList` or `FlashList`) if the number of clips grows large.

## 5. Rendering & Playback Architecture
Real-time playback of multiple layers is complex on mobile. We will use a main `Video` player for the base video track. When multiple video layers or complex real-time effects are needed, we may rely on WebGL (`gl-react-native`) or generate low-res proxy videos using FFmpeg in the background to serve as the preview. In Phase 1, we will implement a robust single-layer video/image preview.

## 6. Export Architecture
The export pipeline will be decoupled from the UI. When exporting, the app will read the `TimelineModel`, translate it into a complex FFmpeg command (using `filter_complex` for layering, text, and transitions), and execute it using `ffmpeg-kit`. A background service will track progress and update the UI.

## 7. Performance & Android/iOS Compatibility
- **Proxies**: Large 4K files will have 720p proxies generated for timeline playback.
- **Memory**: Media assets will never be loaded into RAM fully. We will only store file URIs.
- **Native Modules**: We will stick to well-maintained native modules to ensure equal capability across iOS and Android.
