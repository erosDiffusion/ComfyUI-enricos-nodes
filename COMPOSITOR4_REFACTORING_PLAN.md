# Compositor4 GUI Refactoring Plan

**Date**: November 18, 2025  
**Version**: 1.0  
**Status**: Planning Phase - DO NOT IMPLEMENT YET

---

## 🎯 Executive Summary

This document outlines the complete refactoring strategy for Compositor4's GUI, transitioning from a DOM-widget-based interface to a React-powered sidebar panel with fullscreen/popout capabilities.

### Goals

1. **Centralized Interface**: Move compositor UI from individual nodes to a shared sidebar
2. **Modern Architecture**: Leverage React for better state management and performance
3. **Enhanced UX**: Add fullscreen/popout modes for better workspace utilization
4. **Node Selection**: Sidebar responds to selected Compositor4 nodes in the graph
5. **Backward Compatibility**: Maintain existing functionality during migration

---

## 📋 Table of Contents

1. [Current Architecture Analysis](#current-architecture-analysis)
2. [React Sidebar Architecture](#react-sidebar-architecture)
3. [Node-Sidebar Communication](#node-sidebar-communication)
4. [Fullscreen/Popout Feature](#fullscreenpopout-feature)
5. [Implementation Roadmap](#implementation-roadmap)
6. [Migration Strategy](#migration-strategy)
7. [Technical Considerations](#technical-considerations)

---

## 🔍 Current Architecture Analysis

### Existing Implementation (compositor4.js)

**Current Structure:**

```
Node Widget (DOM-based)
├── Container Element
├── Toolbar (80px height, scrollable)
│   ├── Save/Reset Buttons
│   ├── Alignment Grid (3x3)
│   ├── Flip/Transform Tools
│   ├── Snap/Grid Controls
│   ├── Rotation/Precision Sliders
│   ├── Drawing Mode Toggles
│   └── Size Controls (W/H inputs)
├── Content Wrapper
│   ├── Fabric Canvas (with padding border)
│   │   ├── Composition Area (colored background)
│   │   ├── Composition Border (green outline)
│   │   ├── Image Layers (0-8)
│   │   ├── Foreground Drawing Layer
│   │   └── Mask ClipPaths
│   └── Layers Panel (150px width)
│       ├── Title
│       ├── Foreground Layer UI
│       ├── Image Layer Items (1-8, draggable)
│       │   ├── Drag Handle
│       │   ├── Image Thumbnail
│       │   ├── Mask Thumbnail
│       │   └── Visibility Toggle
│       └── Background Layer UI
```

### Key Components to Migrate

1. **Toolbar System**: 300+ lines of button/control creation
2. **Fabric.js Canvas**: Image manipulation engine
3. **Layer Management**: Thumbnails, visibility, z-order
4. **Drawing Tools**: Brush, eraser, canvas primitives
5. **State Management**:
   - `images[]` - Fabric image objects
   - `maskImages[]` - Mask clip paths
   - `imagePositions[]` - Z-order stacking
   - `pendingTransforms[]` - Restore transforms
   - Tool modes, snap settings, brush config
6. **Event Handlers**:
   - Canvas events (selection, modification, drawing)
   - Widget events (button clicks, slider changes)
   - API events (`compositor4_init`)

### Pain Points with Current Approach

1. **Scalability**: Each node instance creates its own UI (wasteful)
2. **State Sync**: Multiple nodes require complex coordination
3. **Performance**: DOM manipulation for every update
4. **UX Limitations**: Canvas size limited by node widget dimensions
5. **Code Complexity**: 4300+ lines of imperative DOM code

---

## ⚛️ React Sidebar Architecture

### Component Hierarchy

```
<CompositorSidebarApp>
  ├── <CompositorHeader>
  │   ├── Node Selector Dropdown
  │   ├── Fullscreen Button
  │   └── Settings Menu
  │
  ├── <CanvasContainer>
  │   ├── <FabricCanvasWrapper>
  │   │   └── [Fabric.js Canvas Element]
  │   └── <CanvasOverlay>
  │       └── Loading/Status Indicators
  │
  ├── <Toolbar>
  │   ├── <ToolSection name="file">
  │   │   ├── <Button>Save</Button>
  │   │   └── <Button>Reset</Button>
  │   ├── <ToolSection name="alignment">
  │   │   └── <AlignmentGrid />
  │   ├── <ToolSection name="transform">
  │   │   ├── <FlipButtons />
  │   │   └── <StretchButtons />
  │   ├── <ToolSection name="grid">
  │   │   ├── <ToggleButton>Snap</ToggleButton>
  │   │   └── <Slider>Grid Size</Slider>
  │   ├── <ToolSection name="mode">
  │   │   ├── <ModeButton>Select</ModeButton>
  │   │   ├── <ModeButton>Draw</ModeButton>
  │   │   └── <ModeButton>Erase</ModeButton>
  │   └── <ToolSection name="brush">
  │       ├── <ColorPicker />
  │       ├── <Slider>Brush Width</Slider>
  │       └── <BrushShapeToggle />
  │
  └── <LayersPanel>
      ├── <LayerItem type="foreground">
      │   ├── <Thumbnail />
      │   └── <VisibilityToggle />
      ├── {imageLayers.map(layer => (
      │   <LayerItem key={layer.id} draggable>
      │       ├── <DragHandle />
      │       ├── <Thumbnail src={layer.image} />
      │       ├── <MaskThumbnail src={layer.mask} />
      │       └── <VisibilityToggle />
      │   </LayerItem>
      │ ))}
      └── <LayerItem type="background">
          ├── <ColorPicker />
          └── <VisibilityToggle />
```

### State Management Strategy

**Option A: React Context + Hooks** (Recommended for Phase 1)

```javascript
// Global state provider
<CompositorContextProvider>
  - selectedNodeId: number | null - canvasState: FabricCanvasState -
  toolbarState: ToolbarConfig - layersState: LayerConfig[] - drawingState:
  DrawingConfig
</CompositorContextProvider>;

// Custom hooks
useCompositorNode(); // Access current node data
useFabricCanvas(); // Fabric.js instance + helpers
useLayerManagement(); // Layer CRUD operations
useDrawingTools(); // Brush/eraser state
useCanvasSave(); // Auto-save logic
```

**Option B: Redux/Zustand** (For complex multi-node scenarios)

```javascript
// Global store
{
  nodes: {
    [nodeId]: {
      canvasState: {...},
      layers: [...],
      transforms: [...]
    }
  },
  ui: {
    activeNodeId: number | null,
    sidebarCollapsed: boolean,
    toolbarLayout: 'compact' | 'expanded'
  }
}
```

### Key React Patterns

1. **Canvas Integration**:

```jsx
const FabricCanvasWrapper = () => {
  const canvasRef = useRef(null);
  const fabricRef = useRef(null);

  useEffect(() => {
    fabricRef.current = new fabric.Canvas(canvasRef.current, {...});
    return () => fabricRef.current.dispose();
  }, []);

  useCompositorEvents(fabricRef); // Subscribe to fabric events

  return <canvas ref={canvasRef} />;
};
```

2. **Layer Drag & Drop** (React DnD or native):

```jsx
const LayerItem = ({ layer, onReorder }) => {
  const [{ isDragging }, drag] = useDrag({
    type: "layer",
    item: { id: layer.id },
  });

  const [, drop] = useDrop({
    accept: "layer",
    drop: (item) => onReorder(item.id, layer.id),
  });

  return <div ref={(node) => drag(drop(node))} />;
};
```

3. **Debounced Save**:

```jsx
const useAutoSave = (canvasState) => {
  const debouncedSave = useMemo(
    () =>
      debounce(async () => {
        await saveToComfyUI(canvasState);
      }, 300),
    []
  );

  useEffect(() => {
    debouncedSave();
  }, [canvasState]);
};
```

### Styling Approach

**Option 1**: CSS Modules

```css
/* CompositorSidebar.module.css */
.sidebar {
  /* ... */
}
.toolbar {
  /* ... */
}
```

**Option 2**: Styled Components

```jsx
const Toolbar = styled.div`
  display: flex;
  background: rgba(50, 50, 50, 0.9);
  padding: 5px 10px;
`;
```

**Option 3**: Tailwind/Utility Classes (if available in ComfyUI)

---

## 🔌 Node-Sidebar Communication

### Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     ComfyUI Graph                       │
│  ┌──────────────┐   ┌──────────────┐   ┌─────────────┐ │
│  │ Compositor4  │   │ Compositor4  │   │ Compositor4 │ │
│  │   Node #1    │   │   Node #2    │   │   Node #3   │ │
│  └──────┬───────┘   └──────┬───────┘   └──────┬──────┘ │
│         │                  │                   │        │
│         └──────────────────┴───────────────────┘        │
│                            │                            │
│                    [Node Selection Event]               │
└────────────────────────────┼────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │  Event Bridge   │
                    │  (ComfyUI API)  │
                    └────────┬────────┘
                             │
┌────────────────────────────┼────────────────────────────┐
│                   Sidebar Panel                         │
│                    ┌────────▼────────┐                  │
│                    │  React Sidebar  │                  │
│                    │   (Compositor   │                  │
│                    │    Interface)   │                  │
│                    └─────────────────┘                  │
└─────────────────────────────────────────────────────────┘
```

### Event Flow

**1. Node Selection → Sidebar Update**

```javascript
// In compositor4.js (node code)
app.canvas.onSelectionChange = (selectedNodes) => {
  const compositorNode = selectedNodes.find((n) => n.type === "Compositor4");
  if (compositorNode) {
    api.dispatchEvent(
      new CustomEvent("compositor4:node-selected", {
        detail: {
          nodeId: compositorNode.id,
          fabricData: compositorNode.widgets.find(
            (w) => w.name === "fabricData"
          ).value,
          canvasConfig: {
            width: compositorNode.properties.width,
            height: compositorNode.properties.height,
            padding: compositorNode.properties.padding,
          },
        },
      })
    );
  }
};

// In React sidebar
useEffect(() => {
  const handleNodeSelection = (event) => {
    setActiveNode(event.detail);
    loadCanvasState(event.detail.fabricData);
  };

  api.addEventListener("compositor4:node-selected", handleNodeSelection);
  return () =>
    api.removeEventListener("compositor4:node-selected", handleNodeSelection);
}, []);
```

**2. Sidebar Edit → Node Update**

```javascript
// In React sidebar
const handleCanvasChange = async (newFabricData) => {
  // Update local state immediately (optimistic update)
  setCanvasState(newFabricData);

  // Send to backend via API
  await api.dispatchEvent(
    new CustomEvent("compositor4:canvas-updated", {
      detail: {
        nodeId: activeNode.id,
        fabricData: JSON.stringify(newFabricData),
        imageName: generateImageName(),
        seed: Date.now(),
      },
    })
  );
};

// In compositor4.js (node code)
api.addEventListener("compositor4:canvas-updated", (event) => {
  const node = app.graph.getNodeById(event.detail.nodeId);
  if (node) {
    // Update widget values
    const fabricDataWidget = node.widgets.find((w) => w.name === "fabricData");
    fabricDataWidget.value = event.detail.fabricData;

    const seedWidget = node.widgets.find((w) => w.name === "seed");
    seedWidget.value = event.detail.seed.toString();

    // Trigger save and re-execution
    node.setDirtyCanvas(true, true);
  }
});
```

**3. Backend Response → Sidebar Feedback**

```javascript
// Backend sends compositor4_init event after processing
api.addEventListener("compositor4_init", (event) => {
  const { node, output } = event.detail;

  // Update React sidebar if this is the active node
  if (activeNode?.id === node) {
    updateLayerThumbnails(output.names);
    updateMaskThumbnails(output.maskNames);
    setConfigChanged(output.configChanged);
  }
});
```

### State Synchronization Patterns

**Pattern 1: Single Source of Truth (Node Widget)**

- Widget values remain authoritative
- Sidebar reads from widgets, writes back to widgets
- Simple but requires frequent node lookups

**Pattern 2: Sidebar as Source (Recommended)**

- Sidebar maintains active state in React
- Node widgets sync on save/queue
- Better performance, cleaner React code

**Pattern 3: Hybrid (Best for Complex Scenarios)**

- Persistent state in widgets (survives reloads)
- Active editing state in sidebar (performance)
- Explicit sync points (save, node selection change)

### API Extension Points

```javascript
// Extend ComfyUI API for compositor
api.compositor4 = {
  // Get current active compositor node
  getActiveNode: () => {
    /* ... */
  },

  // Save canvas state to node
  saveToNode: async (nodeId, data) => {
    /* ... */
  },

  // Load canvas state from node
  loadFromNode: (nodeId) => {
    /* ... */
  },

  // Trigger workflow execution
  executeNode: (nodeId) => {
    /* ... */
  },

  // Subscribe to node events
  onNodeChanged: (nodeId, callback) => {
    /* ... */
  },
};
```

---

## 🖼️ Fullscreen/Popout Feature

### Architecture

```
┌────────────────────────────────────────────────────────┐
│               Main ComfyUI Window                      │
│  ┌──────────────────────────────────────────────────┐ │
│  │  Sidebar (can be collapsed)                      │ │
│  │  ┌────────────────────────────────────────────┐  │ │
│  │  │  [↗ Popout] [⛶ Fullscreen]               │  │ │
│  │  │  Compositor Interface                      │  │ │
│  │  │  (React Component)                         │  │ │
│  │  └────────────────────────────────────────────┘  │ │
│  └──────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘

                    ↓ [Popout clicked]

┌────────────────────────────────────────────────────────┐
│          New Browser Window (Popout)                   │
│  ┌──────────────────────────────────────────────────┐ │
│  │  Same React Component (Portal)                   │ │
│  │  - Larger canvas area                            │ │
│  │  - Full toolbar visible                          │ │
│  │  - All features available                        │ │
│  │  - Synced state with main window                 │ │
│  └──────────────────────────────────────────────────┘ │
│  [Close Window] [↩ Return to Sidebar]                 │
└────────────────────────────────────────────────────────┘
```

### Implementation Strategies

**Strategy 1: Window.open() + Messaging**

```javascript
// In React sidebar
const handlePopout = () => {
  const popoutWindow = window.open(
    "/compositor-popout.html",
    "CompositorPopout",
    "width=1400,height=900,menubar=no,toolbar=no"
  );

  // Wait for window to load
  popoutWindow.addEventListener("load", () => {
    // Send current state to popout
    popoutWindow.postMessage(
      {
        type: "INIT_COMPOSITOR",
        payload: {
          nodeId: activeNode.id,
          canvasState: canvasState,
          layers: layers,
        },
      },
      "*"
    );
  });

  // Listen for updates from popout
  window.addEventListener("message", (event) => {
    if (event.data.type === "CANVAS_UPDATE") {
      handleCanvasChange(event.data.payload);
    }
  });
};
```

**Strategy 2: React Portal (Complex but elegant)**

```jsx
const CompositorPopout = ({ isPopped, onClose }) => {
  const [popoutWindow, setPopoutWindow] = useState(null);

  useEffect(() => {
    if (isPopped) {
      const newWindow = window.open("", "CompositorPopout", "...");
      setPopoutWindow(newWindow);

      return () => newWindow.close();
    }
  }, [isPopped]);

  if (!isPopped || !popoutWindow) {
    return <CompositorInterface />; // Render in sidebar
  }

  // Render same component in new window using portal
  return ReactDOM.createPortal(
    <CompositorInterface />,
    popoutWindow.document.body
  );
};
```

**Strategy 3: Fullscreen API (Simpler alternative)**

```javascript
const handleFullscreen = () => {
  const container = document.getElementById("compositor-container");

  if (!document.fullscreenElement) {
    container.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
};
```

### State Persistence Across Windows

```javascript
// Shared state manager (singleton)
class CompositorStateManager {
  constructor() {
    this.state = null;
    this.listeners = new Set();
    this.setupStorageSync();
  }

  setState(newState) {
    this.state = newState;
    this.notifyListeners();
    this.persistToStorage();
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notifyListeners() {
    this.listeners.forEach((fn) => fn(this.state));
  }

  setupStorageSync() {
    // Use BroadcastChannel for same-origin communication
    this.channel = new BroadcastChannel("compositor-state");
    this.channel.onmessage = (event) => {
      this.state = event.data;
      this.notifyListeners();
    };
  }

  persistToStorage() {
    // Broadcast to all windows
    this.channel.postMessage(this.state);

    // Also save to sessionStorage as backup
    sessionStorage.setItem("compositor-state", JSON.stringify(this.state));
  }
}

// Usage in React
const stateManager = new CompositorStateManager();

function useCompositorState() {
  const [state, setState] = useState(stateManager.state);

  useEffect(() => {
    return stateManager.subscribe(setState);
  }, []);

  const updateState = (newState) => {
    stateManager.setState(newState);
  };

  return [state, updateState];
}
```

### UX Considerations

1. **Window Management**:

   - Save window size/position to localStorage
   - Restore on next popout
   - Handle window close gracefully

2. **Visual Feedback**:

   - Show "popped out" indicator in sidebar
   - Dim/disable sidebar when popped
   - Provide easy way to bring back

3. **Feature Parity**:

   - All tools work in both modes
   - Keyboard shortcuts work in popout
   - No feature degradation

4. **Responsive Design**:
   - Popout adapts to window size
   - Toolbar reorganizes for smaller windows
   - Canvas scales appropriately

---

## 🗺️ Implementation Roadmap

### Phase 1: Foundation (Week 1-2)

**Goal**: Set up React infrastructure, sidebar registration

- [ ] Set up React build pipeline (Vite/Webpack)
- [ ] Create basic sidebar registration
- [ ] Implement minimal React app in sidebar
- [ ] Test node selection → sidebar communication
- [ ] Document API events needed

**Deliverables**:

- `compositor4-react-app/` folder structure
- `package.json` with dependencies
- `CompositorSidebarApp.jsx` shell component
- Working sidebar registration in ComfyUI

### Phase 2: Canvas Migration (Week 3-4)

**Goal**: Move Fabric.js canvas to sidebar

- [ ] Port Fabric canvas initialization to React
- [ ] Migrate image loading logic
- [ ] Implement basic layer display
- [ ] Test canvas save/restore
- [ ] Add selection synchronization

**Deliverables**:

- `<FabricCanvasWrapper>` component
- Canvas state management hooks
- Basic layer rendering
- Save/load integration

### Phase 3: Toolbar & Controls (Week 5-6)

**Goal**: Recreate toolbar in React

- [ ] Build button component library
- [ ] Implement alignment tools
- [ ] Port transform controls
- [ ] Add mode switching (select/draw/erase)
- [ ] Rebuild sliders and inputs

**Deliverables**:

- `<Toolbar>` component hierarchy
- All tool buttons functional
- Keyboard shortcuts working
- Tool state persistence

### Phase 4: Layer Management (Week 7-8)

**Goal**: Complete layer panel migration

- [ ] Build drag-and-drop layer list
- [ ] Add thumbnail generation
- [ ] Implement visibility toggles
- [ ] Port mask preview functionality
- [ ] Add foreground/background layers

**Deliverables**:

- `<LayersPanel>` component
- Drag & drop reordering
- Real-time thumbnail updates
- Mask toggle/preview

### Phase 5: Drawing Tools (Week 9-10)

**Goal**: Migrate brush/eraser functionality

- [ ] Integrate Fabric drawing mode
- [ ] Build color picker component
- [ ] Port brush settings (width, shape)
- [ ] Implement eraser with canvas primitives
- [ ] Add foreground layer management

**Deliverables**:

- Drawing mode fully functional
- Brush controls in React
- Eraser working correctly
- Clear/reset foreground

### Phase 6: Fullscreen/Popout (Week 11-12)

**Goal**: Add window management features

- [ ] Implement popout window mechanism
- [ ] Set up state synchronization
- [ ] Add fullscreen API support
- [ ] Build window management UI
- [ ] Test multi-window scenarios

**Deliverables**:

- Popout button functional
- State syncs across windows
- Fullscreen mode works
- Graceful window closing

### Phase 7: Polish & Migration (Week 13-14)

**Goal**: Finalize and deprecate old code

- [ ] Performance optimization
- [ ] Add loading states and error handling
- [ ] Write migration guide
- [ ] Add feature flag to toggle old/new UI
- [ ] Comprehensive testing

**Deliverables**:

- Migration guide document
- Feature toggle system
- Performance benchmarks
- Bug fixes and polish

### Phase 8: Deprecation (Week 15+)

**Goal**: Remove old widget-based UI

- [ ] Mark old code as deprecated
- [ ] Remove widget creation from nodes
- [ ] Clean up unused code
- [ ] Update documentation
- [ ] Release notes and changelog

**Deliverables**:

- Old code removed
- Documentation updated
- Release v5.0.0

---

## 🔄 Migration Strategy

### Backward Compatibility Plan

**Option A: Dual Mode (Recommended)**

```javascript
// Feature flag in extension registration
const USE_REACT_SIDEBAR = true; // User can toggle via settings

app.registerExtension({
  name: "Comfy.Compositor4",
  async nodeCreated(node) {
    if (USE_REACT_SIDEBAR) {
      // New approach: minimal node, sidebar does everything
      initializeMinimalNode(node);
      notifySidebarOfNewNode(node);
    } else {
      // Old approach: full widget in node (current v4)
      initializeCustomCanvasWidget(node);
    }
  },
});
```

**Option B: Parallel Extensions**

- Keep `compositor4.js` as-is (v4)
- Create `compositor4-react.js` (v5)
- Let users choose which to load
- Eventually deprecate v4

### Data Migration

**Node Widget Compatibility**:

```javascript
// Ensure old workflows still work
function loadLegacyNodeData(node) {
  const fabricDataWidget = node.widgets.find((w) => w.name === "fabricData");

  if (fabricDataWidget && fabricDataWidget.value) {
    // Parse old format
    const legacyData = JSON.parse(fabricDataWidget.value);

    // Convert to new format if needed
    const modernData = convertLegacyFormat(legacyData);

    // Load into sidebar
    loadCanvasState(modernData);
  }
}
```

**Workflow Compatibility**:

- Old workflows with v4 nodes continue to work
- New workflows use v5 (sidebar) automatically
- No breaking changes to inputs/outputs
- Same Python backend (no changes needed)

### Rollout Strategy

1. **Alpha Release** (Internal testing)

   - Feature flag off by default
   - Enable via developer console
   - Gather feedback from power users

2. **Beta Release** (Public opt-in)

   - Add toggle in extension settings
   - Document new features
   - Collect bug reports

3. **Stable Release** (Default enabled)

   - Feature flag on by default
   - Old mode still available
   - Migration guide published

4. **Deprecation** (v5.1+)

   - Old mode marked deprecated
   - Warning message when using old UI
   - Timeline for removal announced

5. **Full Migration** (v6.0)
   - Old code removed
   - Breaking change: v4 UI no longer available
   - All users on React sidebar

---

## 🔧 Technical Considerations

### Build Setup

**Option 1: Separate Build Process**

```
ComfyUI-enricos-nodes/
├── compositor4-react/
│   ├── package.json
│   ├── vite.config.js
│   ├── src/
│   │   ├── index.jsx (entry point)
│   │   ├── App.jsx
│   │   ├── components/
│   │   ├── hooks/
│   │   └── utils/
│   └── dist/ (build output → web/)
├── web/
│   ├── compositor4.js (old)
│   ├── compositor4-react.bundle.js (new)
│   └── compositor4-react.css
└── package.json (root)
```

**Build Commands**:

```bash
# Development
cd compositor4-react
npm run dev  # Watch mode, outputs to ../web/

# Production
npm run build  # Minified bundle
```

**Option 2: Integrated Build**

```
# Use ComfyUI's build system if it supports React
# (May require changes to ComfyUI core)
```

### Dependencies

**Core Dependencies**:

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "fabric": "^5.3.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.0.0",
    "vite": "^4.3.0"
  }
}
```

**Optional Dependencies**:

```json
{
  "react-dnd": "^16.0.1", // Drag and drop
  "zustand": "^4.3.8", // State management
  "lodash-es": "^4.17.21" // Utilities (debounce, etc)
}
```

### Performance Considerations

1. **Fabric.js in React**:

   - Use refs, not state, for canvas instance
   - Avoid re-renders when canvas changes
   - Debounce save operations

2. **Layer Thumbnails**:

   - Generate on demand, cache results
   - Use lower resolution for thumbnails
   - Consider virtual scrolling for 100+ layers

3. **State Updates**:

   - Batch updates with React 18 automatic batching
   - Use `useMemo` for expensive computations
   - Separate canvas state from UI state

4. **Memory Management**:
   - Dispose Fabric objects properly
   - Clean up event listeners on unmount
   - Limit history/undo stack size

### Browser Compatibility

- **Minimum**: Chrome/Edge 90+, Firefox 88+, Safari 14+
- **Features needed**:
  - ES6+ (already required by ComfyUI)
  - ResizeObserver (canvas sizing)
  - BroadcastChannel (popout sync)
  - Fullscreen API (optional feature)

### Security Considerations

1. **Cross-Window Communication**:

   - Validate message origins
   - Sanitize data passed via postMessage
   - Don't trust popout window content

2. **Image Loading**:

   - Respect CORS policies
   - Validate image URLs
   - Handle load failures gracefully

3. **State Persistence**:
   - Don't store sensitive data in localStorage
   - Clear session data on logout
   - Encrypt if needed

---

## 📚 Additional Resources

### Example Files Created

1. **compositor4-topbar-example.js**: Topbar menu registration demo
2. **compositor4-bottompanel-example.js**: Bottom panel tab demo
3. **compositor4-sidebar-example.js**: Sidebar tab with React patterns

### References

- [ComfyUI Sidebar Tabs Docs](https://docs.comfy.org/custom-nodes/js/javascript_sidebar_tabs)
- [ComfyUI Topbar Menu Docs](https://docs.comfy.org/custom-nodes/js/javascript_topbar_menu)
- [ComfyUI Bottom Panel Docs](https://docs.comfy.org/custom-nodes/js/javascript_bottom_panel_tabs)
- [Fabric.js Documentation](http://fabricjs.com/docs/)
- [React Portal Docs](https://react.dev/reference/react-dom/createPortal)

### Future Enhancements (Post-v5)

1. **Multiple Canvas Support**: Work with multiple compositor nodes simultaneously
2. **Undo/Redo System**: Canvas history with visual timeline
3. **Presets/Templates**: Save common layouts and configurations
4. **Collaborative Editing**: Multiple users editing same composition (advanced)
5. **Plugin System**: Allow third-party tools/effects
6. **Touch Support**: Better mobile/tablet experience
7. **Animation Timeline**: Keyframe-based animations (v6+)

---

## ✅ Success Criteria

### Phase 1-2 (Foundation & Canvas)

- [ ] Sidebar appears and responds to node selection
- [ ] Canvas displays images from selected node
- [ ] Basic save/load works

### Phase 3-4 (Toolbar & Layers)

- [ ] All toolbar buttons functional
- [ ] Layer reordering works
- [ ] Thumbnails generate correctly

### Phase 5-6 (Drawing & Popout)

- [ ] Drawing tools match v4 functionality
- [ ] Popout window works reliably
- [ ] State syncs between windows

### Phase 7-8 (Migration & Deprecation)

- [ ] Old workflows compatible
- [ ] Performance equals or exceeds v4
- [ ] User documentation complete
- [ ] Zero regression bugs

---

## 🚧 Known Challenges & Solutions

### Challenge 1: Fabric.js + React

**Problem**: Fabric canvas state doesn't fit React paradigm  
**Solution**: Use refs for canvas, controlled components for UI, explicit sync points

### Challenge 2: Multiple Node Instances

**Problem**: Which node's data to show in sidebar?  
**Solution**: Active selection determines active node, clear indicator in sidebar

### Challenge 3: Large Canvas Performance

**Problem**: 4K+ canvas with 8 images lags  
**Solution**: Implement viewport culling, lazy thumbnail generation, canvas virtualization

### Challenge 4: Popout State Sync

**Problem**: Main window and popout can get out of sync  
**Solution**: Use BroadcastChannel + sessionStorage, mark one window as "source of truth"

### Challenge 5: Backward Compatibility

**Problem**: Breaking existing workflows unacceptable  
**Solution**: Maintain widget structure even if unused, transparent data migration

---

**END OF PLANNING DOCUMENT**

_Next Steps: Review plan, gather feedback, begin Phase 1 implementation when approved._
