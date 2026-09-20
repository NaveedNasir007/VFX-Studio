# VFX Studio

VFX Studio is a professional-grade mobile video editing application built with React Native and Expo. It features a complete multi-track timeline, real-time playback rendering, complex filter/effect manipulation, and a native FFmpeg export pipeline.

## Features & Capabilities

- **Multi-Track Timeline Engine:** Powered by Zustand, the application dynamically sequences main video clips while supporting absolute-positioned free-floating tracks (Text, Picture-in-Picture Video, Voiceover, Audio).
- **Advanced Editing Tools:** Split, Trim, Delete, and Reorder clips. Includes manipulation of Speed (0.25x - 4x), Reverse toggles, and instant Freeze-Frame insertion.
- **Visuals & Overlays:** Apply transitions, effects, masks (circle/rectangle), and simulated Chroma Key (green-screen).
- **Text & Captions:** Drop text layers over videos, manipulate fonts and alignments, and utilize the abstracted AI Service hook for Auto-Captions.
- **Voiceover:** Native recording directly to the device utilizing `expo-av` injected directly onto the timeline.
- **Templates:** Rapid project creation using pre-defined blueprints (e.g., 'Cinematic Reel', 'TikTok Fast Cuts').
- **Export Pipeline:** Compiles the Timeline state into complex FFmpeg filtergraphs using `ffmpeg-kit-react-native` to render high-quality `.mp4` artifacts to the user's camera roll.

## Technology Stack

- **Framework:** Expo SDK 52 (React Native) + TypeScript
- **State Management:** Zustand
- **Database:** `expo-sqlite` (Local device persistence)
- **Video Engine:** `expo-video` for UI preview, `ffmpeg-kit-react-native` for processing & export
- **Performance:** `expo-image` (memory caching), `lodash.debounce` (UI thread management)
- **Gestures:** `react-native-gesture-handler`

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd vfx-studio

# Install dependencies
npm install --legacy-peer-deps
```

## Running the Application

Because this application relies on deep native modules (`ffmpeg-kit-react-native`, `expo-sqlite`, `expo-av`), it works best via an Expo Development Build.

```bash
# Start the Expo bundler
npx expo start

# To run on a connected Android/iOS device or emulator
npx expo start --android
npx expo start --ios
```

## Running Tests

The application utilizes Jest for strict unit and integration testing across the Timeline logic and Export Service pipelines.

```bash
npm run test
```

## Project Architecture

- `/src/store`: Contains `TimelineStore` (complex sequence math) and `ProjectStore` (database interactions).
- `/src/core`: Contains `ExportService` (FFmpeg string builders), `MediaService` (proxy generation), and `AIService` (abstracted AI endpoints).
- `/src/screens`: Primary views including `EditorScreen` (the main workspace) and `HomeScreen` (project gallery).
- `/src/components`: UI primitives like the interactive horizontally-scrolling `Timeline.tsx` and `DebouncedSlider.tsx`.
- `/src/database`: SQLite schemas and migrations.
