import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { fabric } from "./fabric.js";

// Constants
const COMPOSITOR_3_DEBUG = "Compositor3Debug";
const CANVAS_BORDER_COLOR = "#00b300b0";
const COMPOSITION_BORDER_COLOR = "#00b300b0";
const COMPOSITION_BORDER_SIZE = 2;
const COMPOSITION_BACKGROUND_COLOR = "rgba(0,0,0,0.2)";
const PADDING = 10;
const HEIGHT = 512;
const WIDTH = 512;
const LITEGRAPH_NODE_PADDING = 10;
const QUALITY = 0.8;
const UPLOAD_ENDPOINT = "/upload/image";
const STORE_FOLDER = "compositor";
const INDICATOR_RADIUS = 8;
const GRID_SIZE = 1; // pixels for snap to grid
const SNAP_ENABLED = false; // toggle snap to grid on/off
// wether to overwrite existing images on upload
const OVERWRITE = true;

// UI Color Constants
const COLOR_TOOLBAR_BG = "rgba(50, 50, 50, 0.9)";
const COLOR_BUTTON_BG = "rgba(70, 70, 70, 0.9)";
const COLOR_BUTTON_HOVER = "rgba(200, 162, 255, 0.7)"; // Pastel purple for hover state
const COLOR_BUTTON_DISABLED = "rgba(100, 100, 100, 0.7)";
const COLOR_BUTTON_BORDER = "rgba(100, 100, 100, 0.5)";
const COLOR_BUTTON_TEXT = "white";
const COLOR_SEPARATOR = "rgba(100, 100, 100, 0.5)";
const COLOR_CONTAINER_BG = "rgba(172, 95, 224, 0)";
const COLOR_INDICATOR_SAVING = "red";
const COLOR_BUTTON_ACTIVE = "rgba(152, 251, 152, 0.7)"; // Pastel green for active state
const COLOR_CANVAS_BG = "transparent";
const COLOR_CANVAS_SELECTION = "transparent";

// UI Size Constants
const BUTTON_HEIGHT = "24px";
const ICON_BUTTON_SIZE = "24px";
const BUTTON_FONT_SIZE = "12px";
const ICON_FONT_SIZE = "14px";

app.registerExtension({
  name: "Comfy.Compositor3Debug",

  async setup(app) {
    api.addEventListener("compositor_init", executedMessageHandler);
  },

  async nodeCreated(node) {
    // Initialize the basic editor UI structure when node is created
    // At this point, widget values are NOT yet available (they're populated later)
    if (isCorrectType(node)) {
      initializeCustomCanvasWidget(node);
    }
  },

  loadedGraphNode(node) {
    // This is called AFTER widget values have been populated from the workflow file
    // This is the correct place to restore saved state
    if (isCorrectType(node)) {
      // Call the restoreCanvasState function which accesses widget values
      // and calls the editor's restoreState method
      restoreCanvasState(node);
    }
  },

  async afterConfigureGraph(args) {
    // All nodes have been created and loaded at this point
  },
});

function isCorrectType(node) {
  return node.constructor.comfyClass == COMPOSITOR_3_DEBUG;
}

function getWidget(node, widgetName) {
  return node.widgets.find((w) => w.name === widgetName);
}

function getImageNameWidget(node) {
  return getWidget(node, "imageName");
}

function getFabricDataWidget(node) {
  return getWidget(node, "fabricData");
}

const initializeCustomCanvasWidget = (node) => {
  if (isCorrectType(node)) {
    // Note: Widget hiding functionality is commented out as it doesn't work as expected
    // hideWidgets(node, ["imageName", "fabricData"]);

    const editor = Editor(node, fabric);
    editor.initialize(); // Initialize UI structure only, don't restore state yet

    const editorWidget = node.addDOMWidget(
      "compositorGui",
      "compositorGui",
      editor.getContainer(),
      {
        hideOnZoom: false,
      }
    );

    node.editorWidget = editorWidget;
    node.editor = editor;

    // Add cleanup when node is removed
    const originalOnRemoved = node.onRemoved;
    node.onRemoved = function () {
      if (node.editor && node.editor.cleanup) {
        node.editor.cleanup();
      }
      if (originalOnRemoved) {
        originalOnRemoved.call(this);
      }
    };

    // Set initial size - this will be updated in loadedGraphNode or compositor_init
    node.setSize(editor.calculateNodeSize());
    node.resizable = false;
    node.setDirtyCanvas(true, true);
  }
};

// Restore canvas state when widget values are available (loadedGraphNode)
const restoreCanvasState = (node) => {
  if (!isCorrectType(node) || !node.editor) {
    return;
  }

  try {
    // Get the fabricData widget which contains serialized canvas state
    const fabricDataWidget = node.widgets?.find((w) => w.name === "fabricData");

    if (
      fabricDataWidget &&
      fabricDataWidget.value &&
      fabricDataWidget.value !== "{}"
    ) {
      // Call the editor's restoreState method which will:
      // 1. Deserialize the compositor data
      // 2. Restore canvas dimensions, imagePositions, snap settings, grid size
      // 3. Store pending transforms
      // 4. Load images via appendImage (which applies the transforms)
      // 5. Update UI elements
      const restored = node.editor.restoreState(fabricDataWidget.value);
    }

    // Update node size after restoring state
    const newSize = node.editor.calculateNodeSize();
    node.setSize(newSize);
    node.setDirtyCanvas(true, true);
  } catch (error) {
    console.error("Compositor3Debug: Error restoring canvas state:", error);
  }
};

// const hideWidget = (widget) => {
//   if (widget) {
//     // TODO
//   }
// };

// const hideWidgets = (node, widgetNames) => {
//   widgetNames.forEach((name) => {
//     const widget = getWidget(node, name);
//     hideWidget(widget);
//   });
// };

function executedMessageHandler(event, a, b) {
  const nodeId = event.detail.node;
  const node = getNodeById(nodeId);

  console.log("[Compositor3Debug] executedMessageHandler: nodeId=", nodeId);

  // Check if node exists before checking type
  if (!node) {
    console.error("[Compositor3Debug] Node not found");
    return;
  }

  const nodeFound = isCorrectType(node);

  if (nodeFound) {
    console.log("[Compositor3Debug] 1 Node found");
    // This event is triggered when the Python backend executes the node
    // At this point, widget values are populated with actual config data
    // This is when we update the editor with canvas dimensions, images, etc.
    const e = event.detail.output;
    const editor = node.editor;

    // console.log("[Compositor3Debug] Event data:", {
    //   // width: e.width,
    //   // height: e.height,
    //   // namesCount: e.names?.length,
    //   configSignature: e.configSignature,
    //   configChanged: e.configChanged,
    //   onConfigChangedContinue: e.onConfigChangedContinue,
    // });

    // Check if editor exists (it might not if node was just created)
    if (!editor) {
      console.warn("[Compositor3Debug] 2 Editor not initialized yet");
      return;
    }

    // Update canvas dimensions from config if available
    if (
      e.width !== undefined &&
      e.height !== undefined &&
      e.padding !== undefined
    ) {
      editor.updateCanvasDimensions(e.width, e.height, e.padding);
    }

    // Store saveFolder in editor if provided
    if (e.saveFolder !== undefined) {
      editor.setSaveFolder(e.saveFolder);
    }

    // Load images (this will clear old images and load new ones)
    if (e.names && Array.isArray(e.names)) {
      // console.log("[Compositor3Debug] Loading images:", e.names);
      e.names.forEach((name, index) => editor.appendImage(name, index));
    }

    // Handle auto-save for "grab and continue" mode
    const onConfigChangedContinue = Boolean(e.onConfigChangedContinue?.[0]);
    const configChanged = Boolean(e.configChanged?.[0]);

    console.log("[Compositor3Debug] 3 Auto-save check:", {
      configChanged,
      onConfigChangedContinue,
      rawConfigChanged: e.configChanged,
      rawOnConfigChangedContinue: e.onConfigChangedContinue,
    });

    if (configChanged && onConfigChangedContinue) {
      editor.saveBtn.click();
    }
  }
}

const getNodeById = (nodeId) => {
  return app.graph.getNodeById(nodeId);
};

// Utility function to create styled toolbar buttons
const createToolbarButton = (text, onClick, parent) => {
  const button = document.createElement("button");
  button.textContent = text;
  applyStyles(button, {
    height: BUTTON_HEIGHT,
    padding: "0 12px",
    backgroundColor: COLOR_BUTTON_BG,
    color: COLOR_BUTTON_TEXT,
    border: `1px solid ${COLOR_BUTTON_BORDER}`,
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: BUTTON_FONT_SIZE,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    whiteSpace: "nowrap",
  });

  button.onmouseover = () => {
    button.style.backgroundColor = COLOR_BUTTON_HOVER;
  };

  button.onmouseout = () => {
    button.style.backgroundColor = COLOR_BUTTON_BG;
  };

  button.onclick = onClick;

  if (parent) {
    parent.appendChild(button);
  }

  return button;
};

// Utility function to create square icon buttons
const createIconButton = (icon, onClick, parent) => {
  const button = document.createElement("button");
  button.textContent = icon;
  applyStyles(button, {
    width: ICON_BUTTON_SIZE,
    height: ICON_BUTTON_SIZE,
    minWidth: ICON_BUTTON_SIZE,
    minHeight: ICON_BUTTON_SIZE,
    padding: "0",
    backgroundColor: COLOR_BUTTON_BG,
    color: COLOR_BUTTON_TEXT,
    border: `1px solid ${COLOR_BUTTON_BORDER}`,
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: ICON_FONT_SIZE,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: "1",
  });

  button.onmouseover = () => {
    button.style.backgroundColor = COLOR_BUTTON_HOVER;
  };

  button.onmouseout = () => {
    button.style.backgroundColor = COLOR_BUTTON_BG;
  };

  button.onclick = onClick;

  if (parent) {
    parent.appendChild(button);
  }

  return button;
};

// Utility function to create toolbar separator
const createSeparator = (parent) => {
  const separator = document.createElement("div");
  applyStyles(separator, {
    width: "1px",
    height: "20px",
    backgroundColor: COLOR_SEPARATOR,
    margin: "0 5px",
  });

  if (parent) {
    parent.appendChild(separator);
  }

  return separator;
};

// Utility function to create vertical button group
const createVerticalButtonGroup = (parent) => {
  const group = document.createElement("div");
  applyStyles(group, {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  });

  if (parent) {
    parent.appendChild(group);
  }

  return group;
};

// Utility function to apply multiple styles at once
const applyStyles = (element, styles) => {
  Object.entries(styles).forEach(([key, value]) => {
    element.style[key] = value;
  });
};

// Utility function to create a horizontal button row
const createButtonRow = (parent) => {
  const row = document.createElement("div");
  applyStyles(row, {
    display: "flex",
    gap: "2px",
  });
  if (parent) {
    parent.appendChild(row);
  }
  return row;
};

// Utility function to create a null-filled array
const createNullArray = (length) => Array(length).fill(null);

// Utility function to create sorted index-position pairs
const createSortedIndexPositionPairs = (positions, descending = false) => {
  const pairs = positions.map((position, index) => ({ index, position }));
  return descending
    ? pairs.sort((a, b) => b.position - a.position)
    : pairs.sort((a, b) => a.position - b.position);
};

// Editor Component

const Editor = (node, fabric) => {
  // the widget with the gui to maniuplate images
  // containerEl -> canvasEl -> fabricInstance -> compositionArea, compositionBorder, clickableRect
  // setCanvasSize

  let containerEl = null;
  let canvasEl = null;
  let fabricInstance = null;
  let compositionBorder = null;
  let compositionArea = null;
  let toolbarEl = null;
  let saveBtn = null;
  let rotationSlider = null;
  let rotationLabel = null;
  let layersPanelEl = null;
  let snapBtn = null; // Reference to snap button for UI updates
  let gridSizeLabel = null; // Reference to grid size label
  let gridSizeSlider = null; // Reference to grid size slider
  let isUpdatingRotationSlider = false; // Flag to prevent circular updates
  let snapEnabled = SNAP_ENABLED; // Editor property for snap to grid
  let gridSize = GRID_SIZE; // Editor property for grid size
  const IMAGE_COUNT = 9;
  let images = createNullArray(IMAGE_COUNT);
  let imagePositions = Array.from({ length: IMAGE_COUNT }, (_, i) => i); // Z-index stacking order (0=bottom, 8=top)
  let draggedLayerIndex = null; // Track which layer is being dragged
  let pendingTransforms = createNullArray(IMAGE_COUNT); // Store transforms to apply during restoration

  // Store direct references to layer UI elements (avoids getElementById issues with multiple nodes)
  let layerItems = createNullArray(IMAGE_COUNT);
  let layerThumbnails = createNullArray(IMAGE_COUNT);
  let layerVisibilityButtons = createNullArray(IMAGE_COUNT);

  // Canvas dimensions - can be updated from config
  let canvasWidth = WIDTH;
  let canvasHeight = HEIGHT;
  let canvasPadding = PADDING;
  let saveFolder = "output"; // Default folder for saving images
  let preciseSelection = false; // perPixelTargetFind for precise selection

  // Store keyboard handler reference for cleanup
  let keyboardHandler = null;

  // Save queue management for throttling/batching saves with debounce
  let isSaving = false;
  let pendingSaveRequest = null;
  let saveDebounceTimeout = null;
  const SAVE_DEBOUNCE_DELAY = 15; // milliseconds

  const imageNameWidget = getImageNameWidget(node);
  const fabricDataWidget = getFabricDataWidget(node);

  // Helper function to save and update seed
  const saveAndUpdateSeed = () => {
    return queuedSave(false).then(() => {
      updateSeedValue();
    });
  };

  // Helper function to create a toggle button with active/disabled states
  const createToggleButton = (
    initialState,
    onLabel,
    offLabel,
    onChange,
    parent
  ) => {
    const button = createToolbarButton(
      initialState ? onLabel : offLabel,
      () => {
        const newState = !initialState;
        initialState = newState;
        button.textContent = newState ? onLabel : offLabel;
        button.style.backgroundColor = newState
          ? COLOR_BUTTON_ACTIVE
          : COLOR_BUTTON_DISABLED;
        onChange(newState);
      },
      parent
    );

    // Set initial styling
    button.style.backgroundColor = initialState
      ? COLOR_BUTTON_ACTIVE
      : COLOR_BUTTON_DISABLED;

    // Override hover behavior
    button.onmouseover = () => {
      button.style.backgroundColor = COLOR_BUTTON_HOVER;
    };

    button.onmouseout = () => {
      button.style.backgroundColor = initialState
        ? COLOR_BUTTON_ACTIVE
        : COLOR_BUTTON_DISABLED;
    };

    return button;
  };

  // Helper function to create number input
  const createNumberInput = (labelText, parent) => {
    const container = document.createElement("div");
    applyStyles(container, {
      display: "flex",
      gap: "3px",
      alignItems: "center",
      height: "24px",
    });

    const label = document.createElement("label");
    label.textContent = labelText;
    applyStyles(label, {
      color: COLOR_BUTTON_TEXT,
      fontSize: "10px",
      minWidth: "15px",
    });
    container.appendChild(label);

    const input = document.createElement("input");
    input.type = "number";
    input.value = "0";
    input.disabled = true;
    applyStyles(input, {
      width: "60px",
      height: "20px",
      fontSize: "10px",
      padding: "2px",
      backgroundColor: COLOR_BUTTON_BG,
      color: COLOR_BUTTON_TEXT,
      border: `1px solid ${COLOR_BUTTON_BORDER}`,
      borderRadius: "3px",
      boxSizing: "border-box",
      MozAppearance: "textfield",
      appearance: "textfield",
    });
    container.appendChild(input);

    if (parent) {
      parent.appendChild(container);
    }

    return { container, input };
  };

  const createContainer = () => {
    containerEl = document.createElement("div");
    applyStyles(containerEl, {
      backgroundColor: COLOR_CONTAINER_BG,
      display: "flex",
      flexDirection: "column",
      width:
        canvasWidth +
        canvasPadding * 2 +
        COMPOSITION_BORDER_SIZE * 2 +
        150 +
        "px", // Added 150px for layers panel
      height:
        canvasHeight + canvasPadding * 2 + COMPOSITION_BORDER_SIZE * 2 + "px",
      margin: "0px",
      overflow: "visible",
    });
    return containerEl;
  };

  const createToolbar = () => {
    toolbarEl = document.createElement("div");
    applyStyles(toolbarEl, {
      width: "100%",
      minHeight: "auto",
      height: "118px",
      backgroundColor: COLOR_TOOLBAR_BG,
      display: "flex",
      alignItems: "center",
      borderRadius: "8px",
      padding: "5px 10px",
      boxSizing: "border-box",
      gap: "5px",
      position: "relative",
      boxShadow: "inset 0 0 5px rgba(0, 0, 0, 0.2)",
    });
    containerEl.appendChild(toolbarEl);

    // Create vertical group for Save and Reset buttons
    const mainButtonGroup = createVerticalButtonGroup(toolbarEl);

    // Create and append Save button (non-blocking, queued save)
    saveBtn = createToolbarButton(
      "Save",
      (event) => {
        updateWidgetValues(event, node);
      },
      mainButtonGroup
    );

    // Create and append Reset button
    createToolbarButton(
      "Reset",
      (event) => resetImagePositions(event, node),
      mainButtonGroup
    );

    // Add spacing separator
    createSeparator(toolbarEl);

    // Create alignment buttons grid (3x3)
    const alignments = [
      { label: "↖", align: "top-left", title: "Align Top-Left" },
      { label: "↑", align: "top", title: "Align Top" },
      { label: "↗", align: "top-right", title: "Align Top-Right" },
      { label: "←", align: "left", title: "Align Left" },
      { label: "●", align: "center", title: "Align Center" },
      { label: "→", align: "right", title: "Align Right" },
      { label: "↙", align: "bottom-left", title: "Align Bottom-Left" },
      { label: "↓", align: "bottom", title: "Align Bottom" },
      { label: "↘", align: "bottom-right", title: "Align Bottom-Right" },
    ];

    const alignmentGrid = document.createElement("div");
    applyStyles(alignmentGrid, {
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: "2px",
      width: "78px", // 3 × 24px + 2 × 2px gaps
    });

    alignments.forEach(({ label, align, title }) => {
      const btn = createIconButton(label, () => alignSelected(align));
      btn.title = title;
      alignmentGrid.appendChild(btn);
    });

    toolbarEl.appendChild(alignmentGrid);

    // Add separator before flip controls
    createSeparator(toolbarEl);

    // Create vertical group for flip buttons
    const flipButtonGroup = createVerticalButtonGroup(toolbarEl);

    // Create horizontal flip button
    const flipHRow = createButtonRow(flipButtonGroup);

    const flipHBtn = createIconButton("⇄", () => flipHorizontally(), flipHRow);
    flipHBtn.title = "Flip selected object horizontally";

    const flipVBtn = createIconButton("⇵", () => flipVertically(), flipHRow);
    flipVBtn.title = "Flip selected object vertically";

    // Add separator before transformation buttons
    createSeparator(toolbarEl);

    // Create vertical group for transformation buttons (3 rows: stretch, equalize, distribute)
    const transformButtonGroup = createVerticalButtonGroup(toolbarEl);

    // Row 1: Stretch buttons (↔ ↕ symbols)
    const stretchRow = createButtonRow(transformButtonGroup);

    const stretchHBtn = createIconButton(
      "↔",
      () => stretchHorizontally(),
      stretchRow
    );
    stretchHBtn.title =
      "Stretch selected image horizontally (keeping proportions)";

    const stretchVBtn = createIconButton(
      "↕",
      () => stretchVertically(),
      stretchRow
    );
    stretchVBtn.title =
      "Stretch selected image vertically (keeping proportions)";

    // Row 2: Equalize buttons (= symbol for equalize)
    const equalizeRow = createButtonRow(transformButtonGroup);

    const equalizeWidthBtn = createIconButton(
      "=W",
      () => equalizeWidth(),
      equalizeRow
    );
    equalizeWidthBtn.title =
      "Equalize width of all selected images (keeping proportions)";

    const equalizeHeightBtn = createIconButton(
      "=H",
      () => equalizeHeight(),
      equalizeRow
    );
    equalizeHeightBtn.title =
      "Equalize height of all selected images (keeping proportions)";

    // Row 3: Distribute buttons (⋮ ⋯ symbols for distribute)
    const distributeRow = createButtonRow(transformButtonGroup);

    const distributeHBtn = createIconButton(
      "⋯",
      () => distributeHorizontally(),
      distributeRow
    );
    distributeHBtn.title = "Distribute selected images horizontally";

    const distributeVBtn = createIconButton(
      "⋮",
      () => distributeVertically(),
      distributeRow
    );
    distributeVBtn.title = "Distribute selected images vertically";

    // Add separator before grid and precision controls
    createSeparator(toolbarEl);

    // Create vertical container for Snap button and Grid slider (3 rows: Snap 24px, Label 24px, Slider 24px)
    const snapGridContainer = document.createElement("div");
    applyStyles(snapGridContainer, {
      display: "flex",
      flexDirection: "column",
      gap: "2px",
      minWidth: "80px",
    });
    toolbarEl.appendChild(snapGridContainer);

    // Create and append Snap button with special toggle behavior (24px height)
    snapBtn = createToggleButton(
      snapEnabled,
      "Snap: ON",
      "Snap: OFF",
      (newState) => {
        snapEnabled = newState;
      },
      snapGridContainer
    );

    // Create grid size label (24px height)
    gridSizeLabel = document.createElement("label");
    gridSizeLabel.textContent = `Grid: ${gridSize}px`;
    applyStyles(gridSizeLabel, {
      color: COLOR_BUTTON_TEXT,
      fontSize: "10px",
      textAlign: "center",
      height: "24px",
      lineHeight: "24px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    });
    snapGridContainer.appendChild(gridSizeLabel);

    // Create grid size slider container (24px height)
    const gridSliderContainer = document.createElement("div");
    applyStyles(gridSliderContainer, {
      height: "24px",
      display: "flex",
      alignItems: "center",
    });
    snapGridContainer.appendChild(gridSliderContainer);

    gridSizeSlider = document.createElement("input");
    gridSizeSlider.type = "range";
    gridSizeSlider.min = "1";
    gridSizeSlider.max = "50";
    gridSizeSlider.value = gridSize;
    gridSizeSlider.style.width = "100%";
    gridSizeSlider.style.cursor = "pointer";

    gridSizeSlider.oninput = (e) => {
      gridSize = parseInt(e.target.value);
      gridSizeLabel.textContent = `Grid: ${gridSize}px`;
    };

    gridSliderContainer.appendChild(gridSizeSlider);

    // Add separator before rotation and precision controls
    createSeparator(toolbarEl);

    // Create vertical container for Rotation and Precise Selection (3 rows: Precise button 24px, Label 24px, Slider 24px)
    const rotationPreciseContainer = document.createElement("div");
    applyStyles(rotationPreciseContainer, {
      display: "flex",
      flexDirection: "column",
      gap: "2px",
      minWidth: "80px",
    });
    toolbarEl.appendChild(rotationPreciseContainer);

    // Create Precise Selection toggle button (24px height) - now at the top
    const preciseBtn = createToggleButton(
      preciseSelection,
      "Precise: ON",
      "Precise: OFF",
      (newState) => {
        preciseSelection = newState;
        // Update all images with perPixelTargetFind
        images.forEach((img) => {
          if (img) {
            img.set("perPixelTargetFind", preciseSelection);
          }
        });
        fabricInstance.renderAll();
      },
      rotationPreciseContainer
    );

    // Create rotation label (24px height)
    rotationLabel = document.createElement("label");
    rotationLabel.textContent = "Rotate: 0°";
    applyStyles(rotationLabel, {
      color: COLOR_BUTTON_TEXT,
      fontSize: "10px",
      textAlign: "center",
      height: "24px",
      lineHeight: "24px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    });
    rotationPreciseContainer.appendChild(rotationLabel);

    // Create rotation slider container (24px height)
    const rotationSliderContainer = document.createElement("div");
    applyStyles(rotationSliderContainer, {
      height: "24px",
      display: "flex",
      alignItems: "center",
    });
    rotationPreciseContainer.appendChild(rotationSliderContainer);

    rotationSlider = document.createElement("input");
    rotationSlider.type = "range";
    rotationSlider.min = "0";
    rotationSlider.max = "360";
    rotationSlider.value = "0";
    rotationSlider.style.width = "100%";
    rotationSlider.style.cursor = "pointer";
    rotationSlider.disabled = true; // Disabled until an object is selected

    rotationSlider.oninput = (e) => {
      if (isUpdatingRotationSlider) return; // Prevent circular updates

      let angle = parseInt(e.target.value);

      // Constrain to 5-degree steps if Shift is pressed (only values divisible by 5)
      if (e.shiftKey) {
        angle = Math.round(angle / 5) * 5;
        // Ensure angle is exactly divisible by 5
        if (angle % 5 !== 0) {
          angle = Math.round(angle / 5) * 5;
        }
        rotationSlider.value = angle; // Update slider to snapped value
      }

      rotationLabel.textContent = `Rotate: ${angle}°`;

      const activeObject = fabricInstance.getActiveObject();
      if (activeObject) {
        // Get the center point to maintain position during rotation
        const center = activeObject.getCenterPoint();

        // Set the rotation angle with center as origin
        activeObject.set({
          angle: angle,
          originX: "center",
          originY: "center",
          left: center.x,
          top: center.y,
        });

        activeObject.setCoords();
        fabricInstance.renderAll();

        // Trigger debounced save
        saveAndUpdateSeed().then(() => {
          api.enqueuePrompt(0, 1);
        });
      }
    };

    rotationSliderContainer.appendChild(rotationSlider);

    // Add separator before size controls
    createSeparator(toolbarEl);

    // Create size controls container (width and height inputs, 2 rows × 24px)
    const sizeControlsContainer = document.createElement("div");
    applyStyles(sizeControlsContainer, {
      display: "flex",
      flexDirection: "column",
      gap: "2px",
      minWidth: "80px",
    });
    toolbarEl.appendChild(sizeControlsContainer);

    // Width control (24px height)
    const { input: widthInput } = createNumberInput(
      "W:",
      sizeControlsContainer
    );

    // Height control (24px height)
    const { input: heightInput } = createNumberInput(
      "H:",
      sizeControlsContainer
    );

    // Add CSS to hide number input spinners (webkit browsers)
    const styleId = `compositor-spinner-hide-${node.id}`;
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        input[type="number"]::-webkit-outer-spin-button,
        input[type="number"]::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
      `;
      document.head.appendChild(style);
    }

    // Store references for later use
    node.widthInput = widthInput;
    node.heightInput = heightInput;

    // Width input change handler
    widthInput.onchange = (e) => {
      const activeObject = fabricInstance.getActiveObject();
      if (!activeObject || activeObject.type === "activeSelection") return;

      const targetWidth = parseFloat(e.target.value);
      if (isNaN(targetWidth) || targetWidth <= 0) {
        // Reset to current value if invalid
        widthInput.value = Math.round(activeObject.getScaledWidth());
        return;
      }

      // Calculate new scale to achieve target width
      const currentWidth = activeObject.width;
      const newScaleX = targetWidth / currentWidth;

      activeObject.set({
        scaleX: newScaleX,
        scaleY: newScaleX, // Maintain aspect ratio
      });

      activeObject.setCoords();
      fabricInstance.renderAll();

      // Update height input to reflect new size
      heightInput.value = Math.round(activeObject.getScaledHeight());

      // Trigger save
      saveAndUpdateSeed();
    };

    // Height input change handler
    heightInput.onchange = (e) => {
      const activeObject = fabricInstance.getActiveObject();
      if (!activeObject || activeObject.type === "activeSelection") return;

      const targetHeight = parseFloat(e.target.value);
      if (isNaN(targetHeight) || targetHeight <= 0) {
        // Reset to current value if invalid
        heightInput.value = Math.round(activeObject.getScaledHeight());
        return;
      }

      // Calculate new scale to achieve target height
      const currentHeight = activeObject.height;
      const newScaleY = targetHeight / currentHeight;

      activeObject.set({
        scaleX: newScaleY, // Maintain aspect ratio
        scaleY: newScaleY,
      });

      activeObject.setCoords();
      fabricInstance.renderAll();

      // Update width input to reflect new size
      widthInput.value = Math.round(activeObject.getScaledWidth());

      // Trigger save
      saveAndUpdateSeed();
    };
  };

  const createLayerThumbnail = (index) => {
    const thumbnail = document.createElement("div");
    // No need for ID - we'll store direct reference
    applyStyles(thumbnail, {
      width: "30px",
      height: "30px",
      backgroundColor: "rgba(0, 0, 0, 0.3)",
      borderRadius: "2px",
      backgroundSize: "contain",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: COLOR_BUTTON_TEXT,
      fontSize: "9px",
      cursor: "pointer",
      flexShrink: "0",
    });

    thumbnail.onclick = () => selectImageByIndex(index);

    // Store reference in array
    layerThumbnails[index] = thumbnail;

    return thumbnail;
  };

  const createLayerLabel = (index) => {
    const label = document.createElement("div");
    label.textContent = `Image ${index + 1}`;
    applyStyles(label, {
      color: COLOR_BUTTON_TEXT,
      fontSize: "10px",
      fontWeight: "bold",
    });
    return label;
  };

  const createVisibilityButton = (index) => {
    const visibilityBtn = document.createElement("button");
    // No need for ID - we'll store direct reference
    visibilityBtn.textContent = "👁";
    applyStyles(visibilityBtn, {
      width: "20px",
      height: "20px",
      padding: "0",
      backgroundColor: COLOR_BUTTON_BG,
      color: COLOR_BUTTON_TEXT,
      border: `1px solid ${COLOR_BUTTON_BORDER}`,
      borderRadius: "3px",
      cursor: "pointer",
      fontSize: "12px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    });

    visibilityBtn.onclick = (e) => {
      e.stopPropagation();
      toggleImageVisibility(index);
    };

    visibilityBtn.onmouseover = () => {
      visibilityBtn.style.backgroundColor = COLOR_BUTTON_HOVER;
    };

    visibilityBtn.onmouseout = () => {
      const isVisible = images[index] && images[index].visible !== false;
      visibilityBtn.style.backgroundColor = isVisible
        ? COLOR_BUTTON_BG
        : COLOR_BUTTON_DISABLED;
    };

    // Store reference in array
    layerVisibilityButtons[index] = visibilityBtn;

    return visibilityBtn;
  };

  const createDragHandleButton = (index) => {
    const dragBtn = document.createElement("button");
    // No need for ID - we'll use stored references
    dragBtn.textContent = "☰";
    dragBtn.draggable = true;
    applyStyles(dragBtn, {
      width: "20px",
      height: "20px",
      padding: "0",
      backgroundColor: COLOR_BUTTON_BG,
      color: COLOR_BUTTON_TEXT,
      border: `1px solid ${COLOR_BUTTON_BORDER}`,
      borderRadius: "3px",
      cursor: "grab",
      fontSize: "14px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    });

    dragBtn.ondragstart = (e) => {
      draggedLayerIndex = index;
      dragBtn.style.cursor = "grabbing";
      // Use stored reference instead of getElementById
      if (layerItems[index]) {
        layerItems[index].style.opacity = "0.5";
      }
      e.dataTransfer.effectAllowed = "move";
    };

    dragBtn.ondragend = (e) => {
      dragBtn.style.cursor = "grab";
      // Use stored reference instead of getElementById
      if (layerItems[index]) {
        layerItems[index].style.opacity = "1";
      }
      draggedLayerIndex = null;
    };

    dragBtn.onmouseover = () => {
      dragBtn.style.backgroundColor = COLOR_BUTTON_HOVER;
    };

    dragBtn.onmouseout = () => {
      dragBtn.style.backgroundColor = COLOR_BUTTON_BG;
    };

    return dragBtn;
  };

  const createLayerItem = (index) => {
    const layerItem = document.createElement("div");
    // No need for ID - we'll store direct reference
    applyStyles(layerItem, {
      width: "100%",
      height: "40px",
      backgroundColor: COLOR_BUTTON_BG,
      border: `1px solid ${COLOR_BUTTON_BORDER}`,
      borderRadius: "4px",
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      gap: "5px",
      padding: "5px",
      boxSizing: "border-box",
      position: "relative",
    });

    // Add drag and drop event handlers to the layer item
    layerItem.ondragover = (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (draggedLayerIndex !== null && draggedLayerIndex !== index) {
        layerItem.style.borderColor = COLOR_BUTTON_ACTIVE;
        layerItem.style.borderWidth = "2px";
      }
    };

    layerItem.ondragleave = (e) => {
      layerItem.style.borderColor = COLOR_BUTTON_BORDER;
      layerItem.style.borderWidth = "1px";
    };

    layerItem.ondrop = (e) => {
      e.preventDefault();
      layerItem.style.borderColor = COLOR_BUTTON_BORDER;
      layerItem.style.borderWidth = "1px";

      if (draggedLayerIndex !== null && draggedLayerIndex !== index) {
        swapLayerPositions(draggedLayerIndex, index);
      }
    };

    // Add drag handle button
    const dragHandle = createDragHandleButton(index);
    layerItem.appendChild(dragHandle);

    // Add thumbnail
    const thumbnail = createLayerThumbnail(index);
    layerItem.appendChild(thumbnail);

    // Create info and controls container
    const infoContainer = document.createElement("div");
    applyStyles(infoContainer, {
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      flex: "1",
      gap: "3px",
    });

    // Add label and visibility button
    const label = createLayerLabel(index);
    const visibilityBtn = createVisibilityButton(index);

    infoContainer.appendChild(label);
    infoContainer.appendChild(visibilityBtn);
    layerItem.appendChild(infoContainer);

    // Store reference in array
    layerItems[index] = layerItem;

    return layerItem;
  };

  const createLayersPanelTitle = () => {
    const title = document.createElement("div");
    title.textContent = "Layers";
    applyStyles(title, {
      color: COLOR_BUTTON_TEXT,
      fontSize: "14px",
      fontWeight: "bold",
      marginBottom: "5px",
      textAlign: "center",
    });
    return title;
  };

  const createLayersPanel = () => {
    // Create main content wrapper (canvas + layers side by side)
    const contentWrapper = document.createElement("div");
    applyStyles(contentWrapper, {
      display: "flex",
      flexDirection: "row",
      gap: "10px",
      width: "100%",
    });

    containerEl.appendChild(contentWrapper);

    // Create layers panel
    layersPanelEl = document.createElement("div");
    applyStyles(layersPanelEl, {
      width: "150px",
      height: HEIGHT - 8 + PADDING * 2 + COMPOSITION_BORDER_SIZE * 2 + "px",
      backgroundColor: COLOR_TOOLBAR_BG,
      borderRadius: "8px",
      padding: "4px",
      boxSizing: "border-box",
      overflowY: "auto",
      display: "flex",
      flexDirection: "column",
      marginTop: "8px",
      gap: "4px",
      boxShadow: "inset 0 0 5px rgba(0, 0, 0, 0.2)",
    });

    // Add title
    const title = createLayersPanelTitle();
    layersPanelEl.appendChild(title);

    // Create layer items in order based on imagePositions (highest position first)
    const indexPositionPairs = createSortedIndexPositionPairs(
      imagePositions,
      true
    );

    indexPositionPairs.forEach(({ index }) => {
      const layerItem = createLayerItem(index);
      layersPanelEl.appendChild(layerItem);
    });

    contentWrapper.appendChild(layersPanelEl);

    return contentWrapper;
  };

  const updateLayerThumbnail = (index) => {
    // Use stored reference instead of getElementById
    const thumbnail = layerThumbnails[index];
    if (!thumbnail) return;

    if (images[index]) {
      // Get the image data URL
      const imgElement = images[index].getElement();
      if (imgElement && imgElement.src) {
        thumbnail.style.backgroundImage = `url(${imgElement.src})`;
        thumbnail.textContent = "";
      }
    } else {
      thumbnail.style.backgroundImage = "none";
      thumbnail.textContent = "";
    }
  };

  const selectImageByIndex = (index) => {
    if (images[index] && images[index].visible !== false) {
      fabricInstance.setActiveObject(images[index]);
      fabricInstance.renderAll();
    }
  };

  const updateLayerSelectionHighlight = () => {
    // Clear all highlights first
    layerItems.forEach((layerItem, idx) => {
      if (layerItem) {
        layerItem.style.backgroundColor = COLOR_BUTTON_BG;
      }
    });

    // Get the currently selected object
    const activeObject = fabricInstance.getActiveObject();
    if (!activeObject) return;

    // If it's a single object, find its index and highlight it
    if (activeObject.type !== "activeSelection") {
      const selectedIndex = images.indexOf(activeObject);
      if (selectedIndex !== -1 && layerItems[selectedIndex]) {
        layerItems[selectedIndex].style.backgroundColor = COLOR_BUTTON_ACTIVE;
      }
    }
    // For multi-selection, we could highlight all selected layers
    // but for now we'll just clear highlights for multi-select
  };

  const toggleImageVisibility = (index) => {
    if (!images[index]) {
      return;
    }

    const img = images[index];
    const isCurrentlyVisible = img.visible !== false;

    // Toggle visibility
    img.set({
      opacity: isCurrentlyVisible ? 0 : 1,
      selectable: !isCurrentlyVisible,
      evented: !isCurrentlyVisible,
      visible: !isCurrentlyVisible,
    });

    // Update visibility button appearance using stored reference
    const visibilityBtn = layerVisibilityButtons[index];
    if (visibilityBtn) {
      visibilityBtn.textContent = isCurrentlyVisible ? "👁‍🗨" : "👁";
      visibilityBtn.style.backgroundColor = isCurrentlyVisible
        ? COLOR_BUTTON_DISABLED
        : COLOR_BUTTON_BG;
    }

    // Deselect if hiding the currently selected object
    if (isCurrentlyVisible) {
      const activeObject = fabricInstance.getActiveObject();
      if (activeObject === img) {
        fabricInstance.discardActiveObject();
      }
    }

    fabricInstance.renderAll();

    // Save the changes (same as object:modified event)
    saveAndUpdateSeed();
  };

  const swapLayerPositions = (fromIndex, toIndex) => {
    // Swap the positions in the imagePositions array
    const fromPosition = imagePositions[fromIndex];
    const toPosition = imagePositions[toIndex];

    imagePositions[fromIndex] = toPosition;
    imagePositions[toIndex] = fromPosition;

    // Update the layer panel UI to reflect new order
    updateLayerPanelOrder();

    // Update the canvas z-order based on new positions
    updateCanvasZOrder();

    // Save the changes
    saveAndUpdateSeed();
  };

  const updateLayerPanelOrder = () => {
    // Create array of [index, position] pairs and sort by position (highest first for UI)
    const indexPositionPairs = createSortedIndexPositionPairs(
      imagePositions,
      true
    );

    // Get the title element (first child)
    const title = layersPanelEl.firstChild;

    // Remove all layer items but keep the title
    while (layersPanelEl.children.length > 1) {
      layersPanelEl.removeChild(layersPanelEl.lastChild);
    }

    // Re-append layer items in the new order
    indexPositionPairs.forEach(({ index }) => {
      const layerItem = createLayerItem(index);
      layersPanelEl.appendChild(layerItem);

      // Update thumbnail in case it was already loaded
      updateLayerThumbnail(index);

      // Update visibility button state using stored reference
      if (images[index]) {
        const visibilityBtn = layerVisibilityButtons[index];
        if (visibilityBtn && images[index].visible === false) {
          visibilityBtn.textContent = "👁‍🗨";
          visibilityBtn.style.backgroundColor = COLOR_BUTTON_DISABLED;
        }
      }
    });

    // Update selection highlight after reordering
    updateLayerSelectionHighlight();
  };

  const updateCanvasZOrder = () => {
    // Create array of [index, position] pairs
    const indexPositionPairs = createSortedIndexPositionPairs(
      imagePositions,
      false
    );

    // Reorder objects on canvas
    // First, move composition area and border to back
    if (compositionArea) {
      fabricInstance.sendToBack(compositionArea);
    }
    if (compositionBorder) {
      fabricInstance.bringToFront(compositionBorder);
    }

    // Then arrange images according to their positions
    indexPositionPairs.forEach(({ index }) => {
      if (images[index]) {
        fabricInstance.bringToFront(images[index]);
      }
    });

    // Finally bring border to front
    if (compositionBorder) {
      fabricInstance.bringToFront(compositionBorder);
    }

    fabricInstance.renderAll();
  };

  const createCanvasElement = () => {
    canvasEl = document.createElement("canvas");
    canvasEl.id = getRandomCompositorUniqueId();

    return canvasEl;
  };

  const getRandomCompositorUniqueId = () => {
    const randomUniqueIds = new Uint32Array(10);
    const compositorId =
      "c_" +
      crypto.getRandomValues(randomUniqueIds)[0] +
      "_" +
      crypto.getRandomValues(randomUniqueIds)[1];
    return compositorId;
  };

  const initializeFabricCanvas = () => {
    fabricInstance = new fabric.Canvas(canvasEl, {
      backgroundColor: COLOR_CANVAS_BG,
      selectionColor: COLOR_CANVAS_SELECTION,
      selectionLineWidth: 1,
      preserveObjectStacking: true,
      altSelectionKey: "ctrlKey",
      altActionKey: "ctrlKey",
      centeredKey: "altKey",
    });
  };

  const createCompositionArea = () => {
    // a rectangle representing the composition area
    //p, w, h, node
    compositionArea = new fabric.Rect({
      left: canvasPadding + COMPOSITION_BORDER_SIZE,
      top: canvasPadding + COMPOSITION_BORDER_SIZE,
      fill: COMPOSITION_BACKGROUND_COLOR,
      width: canvasWidth,
      height: canvasHeight,
      selectable: false,
    });
  };

  const createCompositionBorder = () => {
    // a border around (and external to) the composition area
    // p, w, h, node

    compositionBorder = new fabric.Rect({
      left: canvasPadding - COMPOSITION_BORDER_SIZE,
      top: canvasPadding - COMPOSITION_BORDER_SIZE,
      fill: "transparent",
      width: canvasWidth + COMPOSITION_BORDER_SIZE * 2,
      height: canvasHeight + COMPOSITION_BORDER_SIZE * 2,
      selectable: false,
      evented: false,
    });

    compositionBorder.set("strokeWidth", COMPOSITION_BORDER_SIZE);
    compositionBorder.set("stroke", COMPOSITION_BORDER_COLOR);
    compositionBorder.set("selectable", false);
    compositionBorder.set("evented", false);
  };

  const setCanvasSize = (width, height, padding, borderSize) => {
    fabricInstance.setWidth(width + padding * 2 + borderSize * 2);
    fabricInstance.setHeight(height + padding * 2 + borderSize * 2);
    fabricInstance.renderAll();
  };

  const appendCanvasToContainer = (contentWrapper) => {
    // Append canvas to the content wrapper (left side)
    contentWrapper.insertBefore(canvasEl, layersPanelEl);
  };

  const buildImageName = (graphId, nodeId, format, isTemp) => {
    return `${graphId}_${nodeId}.${format}${isTemp ? " [temp]" : ""}`;
  };

  const executeSave = async (queue = false) => {
    // Actual save execution
    const imageName = buildImageName(app.graph.id, node.id, "png", false);
    imageNameWidget.value = imageName;

    // Store custom compositor data instead of full fabric JSON
    const compositorData = serializeCompositorData();
    fabricDataWidget.value = JSON.stringify(compositorData);

    const dataUrl = grabSnapshot();
    await uploadSnapshot(dataUrl, imageNameWidget.value, queue);

    node.setDirtyCanvas(true, true); // Force UI update
  };

  const queuedSave = (queue = false) => {
    // Cancel any pending debounced save
    if (saveDebounceTimeout) {
      clearTimeout(saveDebounceTimeout);
      saveDebounceTimeout = null;
    }

    // If a save is in progress, store this request as pending (only keep the latest)
    if (isSaving) {
      pendingSaveRequest = { queue };
      return Promise.resolve(); // Return resolved promise for .then() compatibility
    }

    // Return a promise that resolves when the save completes
    return new Promise((resolve) => {
      // Schedule the save after debounce delay
      saveDebounceTimeout = setTimeout(async () => {
        saveDebounceTimeout = null;

        // Mark that we're saving
        isSaving = true;
        showSavingIndicator();

        try {
          await executeSave(queue);
        } catch (error) {
          console.error("Compositor3Debug: save failed", error);
        } finally {
          hideSavingIndicator();
          isSaving = false;
          resolve(); // Resolve the promise after save completes

          // If there's a pending save request, execute it now
          if (pendingSaveRequest) {
            const request = pendingSaveRequest;
            pendingSaveRequest = null;
            // Execute immediately (will go through debounce again)
            queuedSave(request.queue);
          }
        }
      }, SAVE_DEBOUNCE_DELAY);
    });
  };

  const updateWidgetValues = (event, node) => {
    queuedSave(true);
  };

  const resetImagePositions = (event, node) => {
    images.forEach((img, index) => {
      if (img) {
        resetTransforms(index);
      }
    });
    fabricInstance.discardActiveObject().renderAll();
    // node.setDirtyCanvas(true, true); // Force UI update
  };

  const initialize = () => {
    // Initialize imageName widget with default value if not set
    if (!imageNameWidget.value || imageNameWidget.value === "default") {
      const imageName = buildImageName(app.graph.id, node.id, "png", false);
      imageNameWidget.value = imageName;
    }

    // DON'T restore compositor data here - widget values aren't available yet in nodeCreated
    // Restoration will happen in loadedGraphNode hook where widget values are populated
    // restoreImagePositions();

    createContainer();
    createToolbar();

    // Update UI elements to reflect restored state (will be properly restored in loadedGraphNode)
    updateUIAfterRestore();

    createCanvasElement();
    const contentWrapper = createLayersPanel();
    appendCanvasToContainer(contentWrapper);
    initializeFabricCanvas();

    setCanvasSize(
      canvasWidth,
      canvasHeight,
      canvasPadding,
      COMPOSITION_BORDER_SIZE
    );

    createCompositionArea();
    fabricInstance.add(compositionArea);
    fabricInstance.sendToBack(compositionArea);

    createCompositionBorder();
    fabricInstance.add(compositionBorder);
    fabricInstance.bringToFront(compositionBorder);

    addCanvasEventListeners();

    fabricInstance.renderAll();
    node.setDirtyCanvas(true, true);
  };

  const updateUIAfterRestore = () => {
    // Update snap button to reflect restored state
    if (snapBtn) {
      snapBtn.textContent = snapEnabled ? "Snap: ON" : "Snap: OFF";
      snapBtn.style.backgroundColor = snapEnabled
        ? COLOR_BUTTON_ACTIVE
        : COLOR_BUTTON_DISABLED;
    }

    // Update grid size slider and label
    if (gridSizeSlider) {
      gridSizeSlider.value = gridSize;
    }
    if (gridSizeLabel) {
      gridSizeLabel.textContent = `Grid: ${gridSize}px`;
    }
  };

  // const restoreImagePositions = () => {
  //   try {
  //     const widgetValue = fabricDataWidget.value;
  //     if (widgetValue && typeof widgetValue === "string") {
  //       const data = deserializeCompositorData(widgetValue);
  //     }
  //   } catch (e) {
  //     console.error("Compositor3Debug: could not restore compositor data", e);
  //   }
  // };

  const getContainer = () => {
    return containerEl;
  };

  const updateCanvasDimensions = (width, height, padding) => {
    // Ensure numeric values to avoid string concatenation issues
    const w = Number(width);
    const h = Number(height);
    const p = Number(padding);

    canvasWidth = w;
    canvasHeight = h;
    canvasPadding = p;

    // Update fabric canvas size
    if (fabricInstance) {
      fabricInstance.setWidth(w + p * 2 + COMPOSITION_BORDER_SIZE * 2);
      fabricInstance.setHeight(h + p * 2 + COMPOSITION_BORDER_SIZE * 2);
      fabricInstance.renderAll();
    }

    // Update composition area
    if (compositionArea) {
      compositionArea.set({
        left: p + COMPOSITION_BORDER_SIZE,
        top: p + COMPOSITION_BORDER_SIZE,
        width: w,
        height: h,
      });
    }

    // Update composition border
    if (compositionBorder) {
      compositionBorder.set({
        left: p - COMPOSITION_BORDER_SIZE,
        top: p - COMPOSITION_BORDER_SIZE,
        width: w + COMPOSITION_BORDER_SIZE * 2,
        height: h + COMPOSITION_BORDER_SIZE * 2,
      });
    }

    // Update container size
    if (containerEl) {
      containerEl.style.width =
        w + p * 2 + COMPOSITION_BORDER_SIZE * 2 + 150 + "px";
      containerEl.style.height = h + p * 2 + COMPOSITION_BORDER_SIZE * 2 + "px";
    }

    // Update node size
    const nodeSize = calculateNodeSize();
    node.setSize(nodeSize);
  };

  const grabSnapshot = () => {
    const data = fabricInstance.toDataURL({
      format: "png",
      quality: QUALITY,
      left: canvasPadding + COMPOSITION_BORDER_SIZE,
      top: canvasPadding + COMPOSITION_BORDER_SIZE,
      width: canvasWidth,
      height: canvasHeight,
    });
    return data;
  };

  const uploadSnapshot = async (dataURL, imageName, queue = false) => {
    const b = dataURLToBlob(dataURL);
    const result = await uploadImage(b, imageName);
    if (queue) {
      app.queuePrompt(0, 1);
    }
  };

  const dataURLToBlob = (dataURL) => {
    const parts = dataURL.split(",");
    const mime = parts[0].match(/:(.*?);/)[1];
    const binary = atob(parts[1]);
    const array = [];
    for (let i = 0; i < binary.length; i++) {
      array.push(binary.charCodeAt(i));
    }
    return new Blob([new Uint8Array(array)], { type: mime });
  };

  const uploadImage = async (blob, imageName) => {
    const file = new File([blob], imageName);
    const body = new FormData();

    body.append("image", file);
    body.append("subfolder", STORE_FOLDER);
    body.append("type", saveFolder); // Use saveFolder variable instead of hardcoded "temp"
    body.append("overwrite", OVERWRITE);

    const result = await api.fetchApi(UPLOAD_ENDPOINT, {
      method: "POST",
      body,
    });
  };

  const calculateNodeSize = () => {
    const ch = fabricInstance.getHeight();
    const cw = fabricInstance.getWidth();
    // Added 150px for layers panel + 10px gap
    return [cw + 21 + 160, ch + 111 + 138];
  };

  const fromUrlCallback = (img, index) => {
    // callback when loading image from url, appends to fabric canvas
    img.set({
      left: canvasPadding + COMPOSITION_BORDER_SIZE,
      top: canvasPadding + COMPOSITION_BORDER_SIZE,
      selectable: true,
      evented: true,
      perPixelTargetFind: preciseSelection, // Set precise selection
    });

    let currentTransform = null;

    // First, check if there's a pending transform (from deserialization)
    if (pendingTransforms[index]) {
      currentTransform = pendingTransforms[index];
      pendingTransforms[index] = null; // Clear after use
    }
    // Otherwise, check if there's an existing image to preserve its transform
    else if (hasImageAtIndex(index)) {
      currentTransform = getCurrentTransforms(index);
    }

    fabricInstance.remove(getImageAtIndex(index));

    if (currentTransform) {
      img.set(currentTransform);
    }

    setImageAtIndex(index, img);

    fabricInstance.add(img);

    // Update canvas z-order based on imagePositions
    updateCanvasZOrder();

    // Update layer thumbnail
    updateLayerThumbnail(index);

    // Update visibility button state if image is hidden using stored reference
    const visibilityBtn = layerVisibilityButtons[index];
    if (visibilityBtn && img.visible === false) {
      visibilityBtn.textContent = "👁‍🗨";
      visibilityBtn.style.backgroundColor = COLOR_BUTTON_DISABLED;
    }

    fabricInstance.renderAll();
  };

  const getImageAtIndex = (index) => {
    if (index >= 0 && index < images.length) {
      return images[index];
    }
    return null;
  };

  // base64 or imageName
  const setImageAtIndex = (index, img) => {
    if (index >= 0 && index < images.length) {
      images[index] = img;
    }
  };

  const hasImageAtIndex = (index) => {
    return images[index] != null;
  };

  const createPlaceholderImage = (index, callback) => {
    // Create a simple placeholder image using a canvas
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 200;
    const ctx = canvas.getContext("2d");

    // Draw a gray rectangle with "Missing" text
    ctx.fillStyle = "#444444";
    ctx.fillRect(0, 0, 200, 200);

    ctx.strokeStyle = "#888888";
    ctx.lineWidth = 2;
    ctx.strokeRect(5, 5, 190, 190);

    ctx.fillStyle = "#CCCCCC";
    ctx.font = "bold 24px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Missing", 100, 85);
    ctx.font = "16px Arial";
    ctx.fillText(`Image ${index + 1}`, 100, 115);

    // Convert canvas to data URL and load as Fabric image
    const dataUrl = canvas.toDataURL();
    fabric.Image.fromURL(dataUrl, callback);
  };

  const appendImage = (imageSource, index) => {
    // imageSource can be either:
    // 1. A base64 data URL (starts with "data:image/")
    // 2. A filename from {saveFolder}/compositor folder
    // 3. null/undefined

    if (!imageSource) {
      return;
    }

    let imageUrl;
    if (imageSource.startsWith("data:image/")) {
      // It's a base64 data URL, use directly
      imageUrl = imageSource;
    } else {
      // It's a filename, construct the URL using the saveFolder setting
      imageUrl = `/view?filename=${encodeURIComponent(
        imageSource
      )}&type=${saveFolder}&subfolder=compositor`;
    }

    // Add a timestamp to force cache busting for file-based URLs
    // This helps when the workflow is loaded from localStorage and files might be stale
    const cacheBustUrl = imageSource.startsWith("data:image/")
      ? imageUrl
      : `${imageUrl}&t=${Date.now()}`;

    fabric.Image.fromURL(
      cacheBustUrl,
      (img) => {
        // Check if image loaded successfully
        if (!img || !img.getElement() || img.getElement().naturalWidth === 0) {
          createPlaceholderImage(index, (placeholderImg) =>
            fromUrlCallback(placeholderImg, index)
          );
        } else {
          fromUrlCallback(img, index);
        }
      },
      { crossOrigin: "anonymous" }
    );
  };

  const getCurrentTransforms = (index) => {
    const ref = images[index];
    return {
      left: ref.left,
      top: ref.top,
      scaleX: ref.scaleX,
      scaleY: ref.scaleY,
      angle: ref.angle,
      flipX: ref.flipX,
      flipY: ref.flipY,
      originX: ref.originX,
      originY: ref.originY,
      xwidth: ref.width,
      xheight: ref.height,
      skewY: ref.skewY,
      skewX: ref.skewX,
      opacity: ref.opacity,
      visible: ref.visible,
      selectable: ref.selectable,
      evented: ref.evented,
    };
  };

  const getBoundingBox = (index) => {
    const ref = images[index].getBoundingRect();
    return {
      left: ref.left,
      top: ref.top,
      scaleX: ref.scaleX,
      scaleY: ref.scaleY,
      angle: ref.angle,
      flipX: ref.flipX,
      flipY: ref.flipY,
      originX: ref.originX,
      originY: ref.originY,
      xwidth: ref.height,
      xheight: ref.width,
      skewY: ref.skewY,
      skewX: ref.skewX,
    };
  };

  const serializeCompositorData = () => {
    // Serialize all necessary data to restore the compositor state
    const transforms = [];
    const bboxes = [];
    const imageNames = [];

    for (let i = 0; i < images.length; i++) {
      if (images[i]) {
        try {
          transforms.push(getCurrentTransforms(i));
          bboxes.push(getBoundingBox(i));
          // Store image name/source if available
          const imgElement = images[i].getElement();
          if (imgElement && imgElement.src) {
            const src = imgElement.src;
            // Extract filename from URL or keep base64 as-is
            if (src.startsWith("data:image/")) {
              // Keep base64 data URLs as-is for backward compatibility
              imageNames.push(src);
            } else {
              // Extract filename from URL like /view?filename=config_123_image1.png&type=temp&subfolder=compositor
              try {
                const url = new URL(src, window.location.origin);
                const filename = url.searchParams.get("filename");
                imageNames.push(filename || src);
              } catch (e) {
                // If URL parsing fails, keep original
                imageNames.push(src);
              }
            }
          } else {
            imageNames.push(null);
          }
        } catch (e) {
          transforms.push(null);
          bboxes.push(null);
          imageNames.push(null);
        }
      } else {
        transforms.push(null);
        bboxes.push(null);
        imageNames.push(null);
      }
    }

    return {
      transforms: transforms,
      bboxes: bboxes,
      imageNames: imageNames,
      imagePositions: imagePositions,
      snapEnabled: snapEnabled,
      gridSize: gridSize,
      width: canvasWidth,
      height: canvasHeight,
      padding: canvasPadding,
    };
  };

  const deserializeCompositorData = (dataString) => {
    try {
      const data = JSON.parse(dataString);

      // Restore canvas dimensions if available
      if (
        data.width !== undefined &&
        data.height !== undefined &&
        data.padding !== undefined
      ) {
        // Just set the variables during restoration, don't call updateCanvasDimensions yet
        // because fabric instance and elements don't exist yet during initialization
        canvasWidth = Number(data.width);
        canvasHeight = Number(data.height);
        canvasPadding = Number(data.padding);
      }

      // Restore imagePositions if available
      if (data.imagePositions && Array.isArray(data.imagePositions)) {
        imagePositions = data.imagePositions;
      }

      // Restore snap settings if available
      if (data.snapEnabled !== undefined) {
        snapEnabled = data.snapEnabled;
      }

      if (data.gridSize !== undefined) {
        gridSize = data.gridSize;
      }

      // Store transforms for pending restoration
      if (data.transforms && Array.isArray(data.transforms)) {
        pendingTransforms = data.transforms.slice(); // Copy the array
      }

      // Restore images from imageNames if available
      if (data.imageNames && Array.isArray(data.imageNames)) {
        data.imageNames.forEach((imageName, index) => {
          if (imageName) {
            // Use appendImage which already handles filename vs base64 and placeholders
            // NOTE: When workflow is loaded from localStorage before backend runs,
            // image files may not exist yet, so placeholders will be shown initially.
            // They will be replaced with actual images once the backend runs.
            // The transforms will be applied from pendingTransforms array in fromUrlCallback
            appendImage(imageName, index);
          }
        });
      }

      return data;
    } catch (e) {
      console.error(
        "Compositor3Debug: could not deserialize compositor data",
        e
      );
      return null;
    }
  };

  const resetTransforms = (index) => {
    images[index].left = canvasPadding + COMPOSITION_BORDER_SIZE;
    images[index].top = canvasPadding + COMPOSITION_BORDER_SIZE;
    images[index].scaleX = 1;
    images[index].scaleY = 1;
    images[index].angle = 0;
    images[index].flipX = false;
    images[index].flipY = false;
    //images[index].originX = "top";
    //images[index].originY = "left";

    images[index].skewY = 0;
    images[index].skewX = 0;
    // images[index].perPixelTargetFind = false;
    //  canvasInstance.preciseSelection;
  };

  const addCanvasEventListeners = () => {
    // Snap to grid on object movement
    fabricInstance.on("object:moving", function (opt) {
      if (snapEnabled) {
        const target = opt.target;
        target.set({
          left: snapToGrid(target.left),
          top: snapToGrid(target.top),
        });
      }
    });

    // Snap to grid on object scaling
    fabricInstance.on("object:scaling", function (opt) {
      if (snapEnabled) {
        const target = opt.target;

        // Snap position to grid
        target.set({
          left: snapToGrid(target.left),
          top: snapToGrid(target.top),
        });

        // Snap scaled dimensions to grid multiples
        const scaledWidth = target.getScaledWidth();
        const scaledHeight = target.getScaledHeight();

        // Calculate target dimensions as multiples of grid
        const snappedWidth = Math.round(scaledWidth / gridSize) * gridSize;
        const snappedHeight = Math.round(scaledHeight / gridSize) * gridSize;

        // Calculate new scale factors to achieve snapped dimensions
        // Avoid division by zero
        if (target.width > 0 && target.height > 0) {
          const newScaleX = snappedWidth / target.width;
          const newScaleY = snappedHeight / target.height;

          target.set({
            scaleX: newScaleX,
            scaleY: newScaleY,
          });
        }
      }
    });

    // Update rotation slider when object is rotated
    fabricInstance.on("object:rotating", function (opt) {
      updateRotationSlider();

      // Constrain rotation to 5-degree steps if Shift is pressed (only values divisible by 5)
      if (opt.e && opt.e.shiftKey) {
        const target = opt.target;
        let snappedAngle = Math.round(target.angle / 5) * 5;
        // Ensure angle is exactly divisible by 5
        if (snappedAngle % 5 !== 0) {
          snappedAngle = Math.round(snappedAngle / 5) * 5;
        }
        target.set({ angle: snappedAngle });
      }
    });

    // Update rotation slider when selection changes
    fabricInstance.on("selection:created", function (opt) {
      updateRotationSlider();
      updateLayerSelectionHighlight();
      updateSizeInputs();
      if (rotationSlider) rotationSlider.disabled = false;
      if (node.widthInput) node.widthInput.disabled = false;
      if (node.heightInput) node.heightInput.disabled = false;
    });

    fabricInstance.on("selection:updated", function (opt) {
      updateRotationSlider();
      updateLayerSelectionHighlight();
      updateSizeInputs();
      if (rotationSlider) rotationSlider.disabled = false;
      if (node.widthInput) node.widthInput.disabled = false;
      if (node.heightInput) node.heightInput.disabled = false;
    });

    fabricInstance.on("selection:cleared", function (opt) {
      updateLayerSelectionHighlight();
      if (rotationSlider) {
        rotationSlider.disabled = true;
        rotationSlider.value = "0";
      }
      if (rotationLabel) {
        rotationLabel.textContent = "Rotate: 0°";
      }
      if (node.widthInput) {
        node.widthInput.disabled = true;
        node.widthInput.value = "0";
      }
      if (node.heightInput) {
        node.heightInput.disabled = true;
        node.heightInput.value = "0";
      }
    });

    // Update size inputs when object is scaled or modified
    fabricInstance.on("object:scaling", function (opt) {
      updateSizeInputs();
    });

    // Save after object is modified
    fabricInstance.on("object:modified", function (opt) {
      updateSizeInputs();
      saveAndUpdateSeed();
    });

    // Add keyboard navigation for selected objects
    keyboardHandler = handleKeyboardNavigation;
    document.addEventListener("keydown", keyboardHandler);
  };

  const handleKeyboardNavigation = (e) => {
    // Only handle arrow keys when an object is selected in this canvas
    const activeObject = fabricInstance?.getActiveObject();
    if (!activeObject) return;

    // Check if we should handle this event (don't interfere with text input)
    if (
      e.target.tagName === "INPUT" ||
      e.target.tagName === "TEXTAREA" ||
      e.target.isContentEditable
    ) {
      return;
    }

    // Arrow key codes
    const isArrowKey = [
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
    ].includes(e.key);
    if (!isArrowKey) return;

    // Prevent default behavior (scrolling)
    e.preventDefault();

    // Determine movement distance (1px normal, 10px with Shift)
    const distance = e.shiftKey ? 10 : 1;

    // Calculate new position
    let deltaX = 0;
    let deltaY = 0;

    switch (e.key) {
      case "ArrowLeft":
        deltaX = -distance;
        break;
      case "ArrowRight":
        deltaX = distance;
        break;
      case "ArrowUp":
        deltaY = -distance;
        break;
      case "ArrowDown":
        deltaY = distance;
        break;
    }

    // Move the object(s)
    if (activeObject.type === "activeSelection") {
      // Multi-selection: move all selected objects
      activeObject.forEachObject((obj) => {
        obj.set({
          left: obj.left + deltaX,
          top: obj.top + deltaY,
        });
        obj.setCoords();
      });
      // Update the selection group position
      activeObject.set({
        left: activeObject.left + deltaX,
        top: activeObject.top + deltaY,
      });
      activeObject.setCoords();
    } else {
      // Single selection: move the object
      activeObject.set({
        left: activeObject.left + deltaX,
        top: activeObject.top + deltaY,
      });
      activeObject.setCoords();
    }

    // Render the changes
    fabricInstance.renderAll();

    // Save the changes
    saveAndUpdateSeed();
  };

  const cleanup = () => {
    // Remove keyboard event listener when editor is destroyed
    if (keyboardHandler) {
      document.removeEventListener("keydown", keyboardHandler);
      keyboardHandler = null;
    }

    // Cancel any pending debounced saves
    if (saveDebounceTimeout) {
      clearTimeout(saveDebounceTimeout);
      saveDebounceTimeout = null;
    }
  };

  const updateSeedValue = (signature = false) => {
    // Store custom compositor data with a random seed to trigger update
    const compositorData = serializeCompositorData();
    compositorData.seed = signature != false ? signature : Math.random(); // Add seed to trigger change detection
    fabricDataWidget.value = JSON.stringify(compositorData);
  };

  const updateRotationSlider = () => {
    if (!rotationSlider || !rotationLabel) return;

    const activeObject = fabricInstance.getActiveObject();
    if (activeObject) {
      isUpdatingRotationSlider = true;

      // Normalize angle to 0-360 range
      let angle = activeObject.angle % 360;
      if (angle < 0) angle += 360;

      rotationSlider.value = Math.round(angle);
      rotationLabel.textContent = `Rotate: ${Math.round(angle)}°`;

      isUpdatingRotationSlider = false;
    }
  };

  const updateSizeInputs = () => {
    if (!node.widthInput || !node.heightInput) return;

    const activeObject = fabricInstance.getActiveObject();
    if (activeObject && activeObject.type !== "activeSelection") {
      // Update inputs with current scaled dimensions
      const scaledWidth = Math.round(activeObject.getScaledWidth());
      const scaledHeight = Math.round(activeObject.getScaledHeight());

      node.widthInput.value = scaledWidth;
      node.heightInput.value = scaledHeight;
    }
  };

  const showSavingIndicator = () => {
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.style.backgroundColor = COLOR_INDICATOR_SAVING;
      saveBtn.style.cursor = "not-allowed";
    }
  };

  const hideSavingIndicator = () => {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.style.backgroundColor = COLOR_BUTTON_BG;
      saveBtn.style.cursor = "pointer";
    }
  };

  const snapToGrid = (value) => {
    // Calculate the offset of the composition area
    const offset = PADDING + COMPOSITION_BORDER_SIZE;

    // Snap relative to the composition area's top-left corner
    return Math.round((value - offset) / gridSize) * gridSize + offset;
  };

  const alignSelected = (alignment) => {
    const activeObject = fabricInstance.getActiveObject();
    if (!activeObject) {
      return;
    }

    const objBounds = activeObject.getBoundingRect();
    const compLeft = canvasPadding + COMPOSITION_BORDER_SIZE;
    const compTop = canvasPadding + COMPOSITION_BORDER_SIZE;
    const compRight = compLeft + canvasWidth;
    const compBottom = compTop + canvasHeight;
    const compCenterX = compLeft + canvasWidth / 2;
    const compCenterY = compTop + canvasHeight / 2;

    // Calculate offset from object's origin to its bounds
    const offsetX = objBounds.left - activeObject.left;
    const offsetY = objBounds.top - activeObject.top;

    switch (alignment) {
      case "top-left":
        activeObject.set({
          left: compLeft - offsetX,
          top: compTop - offsetY,
        });
        break;
      case "top":
        activeObject.set({
          left: compCenterX - objBounds.width / 2 - offsetX,
          top: compTop - offsetY,
        });
        break;
      case "top-right":
        activeObject.set({
          left: compRight - objBounds.width - offsetX,
          top: compTop - offsetY,
        });
        break;
      case "left":
        activeObject.set({
          left: compLeft - offsetX,
          top: compCenterY - objBounds.height / 2 - offsetY,
        });
        break;
      case "center":
        activeObject.set({
          left: compCenterX - objBounds.width / 2 - offsetX,
          top: compCenterY - objBounds.height / 2 - offsetY,
        });
        break;
      case "right":
        activeObject.set({
          left: compRight - objBounds.width - offsetX,
          top: compCenterY - objBounds.height / 2 - offsetY,
        });
        break;
      case "bottom-left":
        activeObject.set({
          left: compLeft - offsetX,
          top: compBottom - objBounds.height - offsetY,
        });
        break;
      case "bottom":
        activeObject.set({
          left: compCenterX - objBounds.width / 2 - offsetX,
          top: compBottom - objBounds.height - offsetY,
        });
        break;
      case "bottom-right":
        // prettier-ignore
        activeObject.set({ left: compRight - objBounds.width - offsetX, top: compBottom - objBounds.height - offsetY });
        break;
    }

    activeObject.setCoords();
    fabricInstance.renderAll();

    // Save the changes
    saveAndUpdateSeed();
  };

  const isImageObject = (obj) => {
    // Check if object is one of our managed images
    return images.includes(obj);
  };

  // Helper function to apply transformation and save
  const applyTransformation = (obj, transformation) => {
    obj.set(transformation);
    obj.setCoords();
    fabricInstance.renderAll();
    saveAndUpdateSeed();
  };

  // Helper function to stretch image by dimension
  const stretchByDimension = (targetDimension, getCurrentDimension) => {
    const activeObject = fabricInstance.getActiveObject();
    if (!activeObject || !isImageObject(activeObject)) {
      return;
    }

    const currentDimension = getCurrentDimension(activeObject);
    const scaleFactor = targetDimension / currentDimension;

    applyTransformation(activeObject, {
      scaleX: activeObject.scaleX * scaleFactor,
      scaleY: activeObject.scaleY * scaleFactor,
    });
  };

  const stretchHorizontally = () => {
    stretchByDimension(canvasWidth, (obj) => obj.getScaledWidth());
  };

  const stretchVertically = () => {
    stretchByDimension(canvasHeight, (obj) => obj.getScaledHeight());
  };

  // Helper function to equalize dimension for multiple objects
  const equalizeDimension = (getDimension) => {
    const activeObject = fabricInstance.getActiveObject();
    if (!activeObject || activeObject.type !== "activeSelection") {
      return;
    }

    const objects = activeObject._objects.filter((obj) => isImageObject(obj));
    if (objects.length < 2) {
      return;
    }

    // Use the first object's dimension as reference
    const referenceDimension = getDimension(objects[0]);

    objects.forEach((obj, index) => {
      if (index === 0) return; // Skip the reference object
      const scale =
        referenceDimension /
        (getDimension === ((o) => o.getScaledHeight())
          ? obj.height
          : obj.width);
      obj.set({
        scaleX: scale,
        scaleY: scale,
      });
      obj.setCoords();
    });

    fabricInstance.renderAll();
    saveAndUpdateSeed();
  };

  const equalizeHeight = () => {
    equalizeDimension((obj) => obj.getScaledHeight());
  };

  const equalizeWidth = () => {
    equalizeDimension((obj) => obj.getScaledWidth());
  };

  // Helper function to distribute objects along an axis
  const distributeAlongAxis = (getCenterCoord, setPosition) => {
    const activeObject = fabricInstance.getActiveObject();
    if (!activeObject || activeObject.type !== "activeSelection") {
      return;
    }

    const objects = activeObject._objects.filter((obj) => isImageObject(obj));
    if (objects.length < 2) {
      return;
    }

    // Sort objects by their center position
    objects.sort((a, b) => getCenterCoord(a) - getCenterCoord(b));

    const firstCoord = getCenterCoord(objects[0]);
    const lastCoord = getCenterCoord(objects[objects.length - 1]);
    const spacing = (lastCoord - firstCoord) / (objects.length - 1);

    objects.forEach((obj, index) => {
      const newCoord = firstCoord + spacing * index;
      const currentCoord = getCenterCoord(obj);
      const delta = newCoord - currentCoord;
      setPosition(obj, delta);
      obj.setCoords();
    });

    fabricInstance.renderAll();
    saveAndUpdateSeed();
  };

  const distributeVertically = () => {
    distributeAlongAxis(
      (obj) => obj.getCenterPoint().y,
      (obj, delta) => obj.set({ top: snapToGrid(obj.top + delta) })
    );
  };

  const distributeHorizontally = () => {
    distributeAlongAxis(
      (obj) => obj.getCenterPoint().x,
      (obj, delta) => obj.set({ left: snapToGrid(obj.left + delta) })
    );
  };

  // Helper function to flip object along axis
  const flipAlongAxis = (scaleProperty) => {
    const activeObject = fabricInstance.getActiveObject();
    if (!activeObject) {
      return;
    }

    // Store original origin settings
    const originalOriginX = activeObject.originX;
    const originalOriginY = activeObject.originY;

    // Temporarily set origin to center for proper flipping
    activeObject.set({
      originX: "center",
      originY: "center",
    });

    // Flip by inverting scale
    const transformation = {
      [scaleProperty]: -activeObject[scaleProperty],
    };
    activeObject.set(transformation);

    // Restore original origin settings
    activeObject.set({
      originX: originalOriginX,
      originY: originalOriginY,
    });

    activeObject.setCoords();
    fabricInstance.renderAll();
    saveAndUpdateSeed();
  };

  const flipHorizontally = () => {
    flipAlongAxis("scaleX");
  };

  const flipVertically = () => {
    flipAlongAxis("scaleY");
  };

  const setSaveFolder = (folder) => {
    saveFolder = folder;
  };

  const restoreState = (dataString) => {
    // Deserialize and restore the entire compositor state
    // This should be called from loadedGraphNode when widget values are available
    try {
      const data = deserializeCompositorData(dataString);
      if (data) {
        // Update UI elements to reflect restored state
        updateUIAfterRestore();

        // Update canvas dimensions if they were restored
        if (fabricInstance && compositionArea && compositionBorder) {
          setCanvasSize(
            canvasWidth,
            canvasHeight,
            canvasPadding,
            COMPOSITION_BORDER_SIZE
          );

          // Update composition area
          compositionArea.set({
            left: canvasPadding + COMPOSITION_BORDER_SIZE,
            top: canvasPadding + COMPOSITION_BORDER_SIZE,
            width: canvasWidth,
            height: canvasHeight,
          });

          // Update composition border
          compositionBorder.set({
            left: canvasPadding - COMPOSITION_BORDER_SIZE,
            top: canvasPadding - COMPOSITION_BORDER_SIZE,
            width: canvasWidth + COMPOSITION_BORDER_SIZE * 2,
            height: canvasHeight + COMPOSITION_BORDER_SIZE * 2,
          });

          // Update container size
          if (containerEl) {
            containerEl.style.width =
              canvasWidth +
              canvasPadding * 2 +
              COMPOSITION_BORDER_SIZE * 2 +
              150 +
              "px";
            containerEl.style.height =
              canvasHeight +
              canvasPadding * 2 +
              COMPOSITION_BORDER_SIZE * 2 +
              "px";
          }

          fabricInstance.renderAll();
        }

        return true;
      }
    } catch (e) {
      console.error("Compositor3Debug Editor: could not restore state", e);
    }
    return false;
  };

  // public interface of the Editor
  return {
    initialize,
    getContainer,
    calculateNodeSize,
    appendImage,
    selectImageByIndex,
    updateCanvasDimensions,
    setSaveFolder,
    restoreState,
    cleanup,
    queuedSave, // Expose for configuration change handling
    saveAndUpdateSeed,
    saveBtn,
  };
};

// Utility function to interrupt the current workflow execution
async function interrupt() {
  try {
    const response = await fetch("/interrupt", {
      method: "POST",
      cache: "no-cache",
      headers: {
        "Content-Type": "text/html",
      },
    });
    return response;
  } catch (error) {
    console.error("Compositor3Debug: Failed to interrupt workflow", error);
    throw error;
  }
}
