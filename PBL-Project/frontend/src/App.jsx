import React from 'react';
import { PersonaProvider } from './context/PersonaContext';
import { WorkspaceProvider } from './context/WorkspaceContext';
import PersistentStage3D from './components/PersistentStage3D';
import CyberStatusBar from './components/CyberStatusBar';
import WindowManager from './components/WindowManager';
import GlassDock from './components/GlassDock';
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary name="NeoLogix Global Application Root">
      <PersonaProvider>
        <WorkspaceProvider>
          <div className="relative w-screen h-screen overflow-hidden bg-[#020617] text-slate-100 font-sans select-none">
            {/* 1. Persistent 3D Operational Stage (Continuous 60 FPS Three.js World) */}
            <PersistentStage3D />

            {/* 2. Cyber-Dark Translucent Status Header */}
            <CyberStatusBar />

            {/* 3. Floating Draggable Glassmorphic Service Panels */}
            <WindowManager />

            {/* 4. Floating Glassmorphic Dock Toolbar */}
            <GlassDock />
          </div>
        </WorkspaceProvider>
      </PersonaProvider>
    </ErrorBoundary>
  );
}


export default App;
