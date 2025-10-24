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
const COLOR_BUTTON_HOVER = "rgba(90, 90, 90, 0.9)";
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
    console.log("Compositor3Debug: extension setup");

    api.addEventListener("compositor_init", executedMessageHandler);
  },

  async nodeCreated(node) {
    // Initialize the basic editor UI structure when node is created
    // At this point, widget values are NOT yet available (they're populated later)
    if (isCorrectType(node)) {
      console.log("Compositor3Debug: nodeCreated, initializing UI", node);
      initializeCustomCanvasWidget(node);
    }
  },

  loadedGraphNode(node) {
    // This is called AFTER widget values have been populated from the workflow file
    // This is the correct place to restore saved state
    if (isCorrectType(node)) {
      console.log("Compositor3Debug: loadedGraphNode, restoring state", node);
      // Call the restoreCanvasState function which accesses widget values
      // and calls the editor's restoreState method
      restoreCanvasState(node);
    }
  },

  async afterConfigureGraph(args) {
    // All nodes have been created and loaded at this point
    console.log("Compositor3Debug: afterConfigureGraph", args);
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

const debugWidgetValues = (node) => {
  if (isCorrectType(node)) {
    console.log("Compositor3Debug: node created", node);
    const imageNameWidget = getImageNameWidget(node);
    const fabricDataWidget = getFabricDataWidget(node);

    const widgets_values = node.widgets_values;
    console.log(
      "Compositor3Debug: node widgets values iterator",
      node.widgets.values((w) => w)
    );
    console.log("Compositor3Debug: widget values", widgets_values);
    console.log(
      "Compositor3Debug: imageNameWidget",
      imageNameWidget.name,
      imageNameWidget?.value
    );
    console.log(
      "Compositor3Debug: fabricDataWidget",
      fabricDataWidget.name,
      fabricDataWidget?.value
    );
  }
};

const initializeCustomCanvasWidget = (node) => {
  if (isCorrectType(node)) {
    console.log(
      "Compositor3Debug: Initializing custom canvas widget for node",
      node.id
    );

    // Note: At this point (nodeCreated), widget values are NOT yet available
    // They will be populated later in loadedGraphNode when loading a workflow
    // or via compositor_init event when executing the workflow

    // attempt at hiding widgets, does not work as expected
    hideWidgets(node, ["imageName", "fabricData"]);

    const editor = Editor(node, fabric);
    editor.initialize(); // Initialize UI structure only, don't restore state yet

    const editorWidget = node.addDOMWidget(
      "compositorGui",
      "compositorGui",
      editor.getContainer(),
      {
        hideOnZoom: false,
        // serialize: false, // Don't serialize the DOM widget itself
      }
    );

    node.editorWidget = editorWidget;
    node.editor = editor;

    // Set initial size - this will be updated in loadedGraphNode or compositor_init
    node.setSize(editor.calculateNodeSize());
    node.resizable = false;
    node.setDirtyCanvas(true, true);
  }
};

// Restore canvas state when widget values are available (loadedGraphNode)
const restoreCanvasState = (node) => {
  if (!isCorrectType(node) || !node.editor) {
    console.log(
      "Compositor3Debug: Cannot restore state, node not initialized",
      node.id
    );
    return;
  }

  console.log(
    "Compositor3Debug: Restoring canvas state from widget values",
    node.id
  );

  try {
    // Get the fabricData widget which contains serialized canvas state
    const fabricDataWidget = node.widgets?.find((w) => w.name === "fabricData");

    if (
      fabricDataWidget &&
      fabricDataWidget.value &&
      fabricDataWidget.value !== "{}"
    ) {
      console.log(
        "Compositor3Debug: Found fabricData to restore, length:",
        fabricDataWidget.value.length
      );

      // Call the editor's restoreState method which will:
      // 1. Deserialize the compositor data
      // 2. Restore canvas dimensions, imagePositions, snap settings, grid size
      // 3. Store pending transforms
      // 4. Load images via appendImage (which applies the transforms)
      // 5. Update UI elements
      const restored = node.editor.restoreState(fabricDataWidget.value);

      if (restored) {
        console.log("Compositor3Debug: Canvas state restoration complete");
      } else {
        console.log(
          "Compositor3Debug: Canvas state restoration failed or no data"
        );
      }
    } else {
      console.log("Compositor3Debug: No fabricData to restore or empty data");
    }

    // Update node size after restoring state
    const newSize = node.editor.calculateNodeSize();
    console.log("Compositor3Debug: Setting node size to", newSize);
    node.setSize(newSize);
    node.setDirtyCanvas(true, true);
  } catch (error) {
    console.error("Compositor3Debug: Error restoring canvas state:", error);
  }
};

const hideWidget = (widget) => {
  if (widget) {
    //widget.computeSize = () => [0, 0];
    // if (!window.enrico) window.enrico = {};
    // window.enrico[widget.name] = widget;
    // window.enrico[widget.name].computeSize = () => [0, 0];
    // window.enrico[widget.name].hidden = true;
  }
};

const hideWidgets = (node, widgetNames) => {
  widgetNames.forEach((name) => {
    const widget = getWidget(node, name);
    hideWidget(widget);
  });
};

function executedMessageHandler(event, a, b) {
  const nodeId = event.detail.node;
  const node = getNodeById(nodeId);
  const nodeFound = isCorrectType(node);

  if (nodeFound) {
    // This event is triggered when the Python backend executes the node
    // At this point, widget values are populated with actual config data
    // This is when we update the editor with canvas dimensions, images, etc.
    const e = event.detail.output;
    const editor = node.editor;
    console.log("Compositor3Debug: received compositor_init", e, nodeId, a, b);
    console.log(
      "Compositor3Debug: initializing custom canvas widget",
      node,
      node.editor,
      node.editorWidget
    );

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

    // e.names -> array of image filenames or base64
    e.names.map((name, index) => editor.appendImage(name, index));
  }
}

const getNodeById = (nodeId) => {
  return app.graph.getNodeById(nodeId);
};

// Utility function to create styled toolbar buttons
const createToolbarButton = (text, onClick, parent) => {
  const button = document.createElement("button");
  button.textContent = text;
  button.style.height = BUTTON_HEIGHT;
  button.style.padding = "0 12px";
  button.style.backgroundColor = COLOR_BUTTON_BG;
  button.style.color = COLOR_BUTTON_TEXT;
  button.style.border = `1px solid ${COLOR_BUTTON_BORDER}`;
  button.style.borderRadius = "4px";
  button.style.cursor = "pointer";
  button.style.fontSize = BUTTON_FONT_SIZE;
  button.style.display = "flex";
  button.style.alignItems = "center";
  button.style.justifyContent = "center";
  button.style.whiteSpace = "nowrap";

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
  button.style.width = ICON_BUTTON_SIZE;
  button.style.height = ICON_BUTTON_SIZE;
  button.style.minWidth = ICON_BUTTON_SIZE;
  button.style.minHeight = ICON_BUTTON_SIZE;
  button.style.padding = "0";
  button.style.backgroundColor = COLOR_BUTTON_BG;
  button.style.color = COLOR_BUTTON_TEXT;
  button.style.border = `1px solid ${COLOR_BUTTON_BORDER}`;
  button.style.borderRadius = "4px";
  button.style.cursor = "pointer";
  button.style.fontSize = ICON_FONT_SIZE;
  button.style.display = "flex";
  button.style.alignItems = "center";
  button.style.justifyContent = "center";
  button.style.lineHeight = "1";

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
  separator.style.width = "1px";
  separator.style.height = "20px";
  separator.style.backgroundColor = COLOR_SEPARATOR;
  separator.style.margin = "0 5px";

  if (parent) {
    parent.appendChild(separator);
  }

  return separator;
};

// Utility function to create vertical button group
const createVerticalButtonGroup = (parent) => {
  const group = document.createElement("div");
  group.style.display = "flex";
  group.style.flexDirection = "column";
  group.style.gap = "2px";

  if (parent) {
    parent.appendChild(group);
  }

  return group;
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
  let images = [null, null, null, null, null, null, null, null, null];
  let imagePositions = [0, 1, 2, 3, 4, 5, 6, 7, 8]; // Z-index stacking order (0=bottom, 8=top)
  let draggedLayerIndex = null; // Track which layer is being dragged
  let pendingTransforms = [
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
  ]; // Store transforms to apply during restoration

  // Canvas dimensions - can be updated from config
  let canvasWidth = WIDTH;
  let canvasHeight = HEIGHT;
  let canvasPadding = PADDING;
  let saveFolder = "output"; // Default folder for saving images

  const imageNameWidget = getImageNameWidget(node);
  const fabricDataWidget = getFabricDataWidget(node);

  const createContainer = () => {
    containerEl = document.createElement("div");
    containerEl.style.backgroundColor = COLOR_CONTAINER_BG;
    containerEl.style.display = "flex";
    containerEl.style.flexDirection = "column";
    containerEl.style.width =
      canvasWidth +
      canvasPadding * 2 +
      COMPOSITION_BORDER_SIZE * 2 +
      150 +
      "px"; // Added 150px for layers panel
    containerEl.style.height =
      canvasHeight + canvasPadding * 2 + COMPOSITION_BORDER_SIZE * 2 + "px";
    containerEl.style.margin = "0px";
    containerEl.style.overflow = "visible";
    return containerEl;
  };

  const createToolbar = () => {
    toolbarEl = document.createElement("div");
    toolbarEl.style.width = "100%";
    toolbarEl.style.minHeight = "auto";
    toolbarEl.style.height = "118px";
    toolbarEl.style.backgroundColor = COLOR_TOOLBAR_BG;
    toolbarEl.style.display = "flex";
    toolbarEl.style.alignItems = "center";
    toolbarEl.style.borderRadius = "8px";
    toolbarEl.style.padding = "5px 10px";
    toolbarEl.style.boxSizing = "border-box";
    toolbarEl.style.gap = "5px";
    toolbarEl.style.position = "relative";
    toolbarEl.style.boxShadow = "inset 0 0 5px rgba(0, 0, 0, 0.2)";
    containerEl.appendChild(toolbarEl);

    // Create vertical group for Save and Reset buttons
    const mainButtonGroup = createVerticalButtonGroup(toolbarEl);

    // Create and append Save button with saving state tracking
    saveBtn = createToolbarButton(
      "Save",
      async (event) => {
        showSavingIndicator();
        await updateWidgetValues(event, node);
        hideSavingIndicator();
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
    alignmentGrid.style.display = "grid";
    alignmentGrid.style.gridTemplateColumns = "repeat(3, 1fr)";
    alignmentGrid.style.gap = "2px";
    alignmentGrid.style.width = "78px"; // 3 × 24px + 2 × 2px gaps

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
    const flipHRow = document.createElement("div");
    flipHRow.style.display = "flex";
    flipHRow.style.gap = "2px";
    flipButtonGroup.appendChild(flipHRow);

    const flipHBtn = createIconButton("⇄", () => flipHorizontally(), flipHRow);
    flipHBtn.title = "Flip selected object horizontally";

    const flipVBtn = createIconButton("⇵", () => flipVertically(), flipHRow);
    flipVBtn.title = "Flip selected object vertically";

    // Add separator before transformation buttons
    createSeparator(toolbarEl);

    // Create vertical group for transformation buttons (3 rows: stretch, equalize, distribute)
    const transformButtonGroup = createVerticalButtonGroup(toolbarEl);

    // Row 1: Stretch buttons (↔ ↕ symbols)
    const stretchRow = document.createElement("div");
    stretchRow.style.display = "flex";
    stretchRow.style.gap = "2px";
    transformButtonGroup.appendChild(stretchRow);

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
    const equalizeRow = document.createElement("div");
    equalizeRow.style.display = "flex";
    equalizeRow.style.gap = "2px";
    transformButtonGroup.appendChild(equalizeRow);

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
    const distributeRow = document.createElement("div");
    distributeRow.style.display = "flex";
    distributeRow.style.gap = "2px";
    transformButtonGroup.appendChild(distributeRow);

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

    // Add separator before grid controls
    createSeparator(toolbarEl);

    // Create vertical group for grid controls (Snap button and Grid slider)
    const gridControlGroup = createVerticalButtonGroup(toolbarEl);

    // Create and append Snap button with special toggle behavior
    snapBtn = createToolbarButton(
      snapEnabled ? "Snap: ON" : "Snap: OFF",
      () => {
        snapEnabled = !snapEnabled;
        snapBtn.textContent = snapEnabled ? "Snap: ON" : "Snap: OFF";
        snapBtn.style.backgroundColor = snapEnabled
          ? COLOR_BUTTON_ACTIVE
          : COLOR_BUTTON_DISABLED;
        console.log("Snap to grid:", snapEnabled);
      },
      gridControlGroup
    );

    // Override default styling for snap button based on initial state
    snapBtn.style.backgroundColor = snapEnabled
      ? COLOR_BUTTON_ACTIVE
      : COLOR_BUTTON_DISABLED;

    // Override hover behavior for snap button
    snapBtn.onmouseover = () => {
      if (snapEnabled) {
        snapBtn.style.backgroundColor = COLOR_BUTTON_HOVER;
      }
    };

    snapBtn.onmouseout = () => {
      snapBtn.style.backgroundColor = snapEnabled
        ? COLOR_BUTTON_ACTIVE
        : COLOR_BUTTON_DISABLED;
    };

    // Create grid size slider control
    const gridSizeContainer = document.createElement("div");
    gridSizeContainer.style.display = "flex";
    gridSizeContainer.style.flexDirection = "column";
    gridSizeContainer.style.gap = "2px";
    gridSizeContainer.style.minWidth = "80px";
    gridControlGroup.appendChild(gridSizeContainer);

    gridSizeLabel = document.createElement("label");
    gridSizeLabel.textContent = `Grid: ${gridSize}px`;
    gridSizeLabel.style.color = COLOR_BUTTON_TEXT;
    gridSizeLabel.style.fontSize = "10px";
    gridSizeLabel.style.textAlign = "center";
    gridSizeContainer.appendChild(gridSizeLabel);

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

    gridSizeContainer.appendChild(gridSizeSlider);

    // Create rotation slider control
    const rotationContainer = document.createElement("div");
    rotationContainer.style.display = "flex";
    rotationContainer.style.flexDirection = "column";
    rotationContainer.style.gap = "2px";
    rotationContainer.style.minWidth = "80px";
    rotationContainer.style.marginTop = "4px";
    gridControlGroup.appendChild(rotationContainer);

    rotationLabel = document.createElement("label");
    rotationLabel.textContent = "Rotate: 0°";
    rotationLabel.style.color = COLOR_BUTTON_TEXT;
    rotationLabel.style.fontSize = "10px";
    rotationLabel.style.textAlign = "center";
    rotationContainer.appendChild(rotationLabel);

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

      const angle = parseInt(e.target.value);
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
      }
    };

    rotationContainer.appendChild(rotationSlider);
  };

  const createLayerThumbnail = (index) => {
    const thumbnail = document.createElement("div");
    thumbnail.id = `layer-thumbnail-${index}`;
    thumbnail.style.width = "30px";
    thumbnail.style.height = "30px";
    thumbnail.style.backgroundColor = "rgba(0, 0, 0, 0.3)";
    thumbnail.style.borderRadius = "2px";
    thumbnail.style.backgroundSize = "contain";
    thumbnail.style.backgroundPosition = "center";
    thumbnail.style.backgroundRepeat = "no-repeat";
    thumbnail.style.display = "flex";
    thumbnail.style.alignItems = "center";
    thumbnail.style.justifyContent = "center";
    thumbnail.style.color = COLOR_BUTTON_TEXT;
    thumbnail.style.fontSize = "9px";
    thumbnail.style.cursor = "pointer";
    thumbnail.style.flexShrink = "0";

    thumbnail.onclick = () => selectImageByIndex(index);

    return thumbnail;
  };

  const createLayerLabel = (index) => {
    const label = document.createElement("div");
    label.textContent = `Image ${index + 1}`;
    label.style.color = COLOR_BUTTON_TEXT;
    label.style.fontSize = "10px";
    label.style.fontWeight = "bold";
    return label;
  };

  const createVisibilityButton = (index) => {
    const visibilityBtn = document.createElement("button");
    visibilityBtn.id = `layer-visibility-${index}`;
    visibilityBtn.textContent = "👁";
    visibilityBtn.style.width = "20px";
    visibilityBtn.style.height = "20px";
    visibilityBtn.style.padding = "0";
    visibilityBtn.style.backgroundColor = COLOR_BUTTON_BG;
    visibilityBtn.style.color = COLOR_BUTTON_TEXT;
    visibilityBtn.style.border = `1px solid ${COLOR_BUTTON_BORDER}`;
    visibilityBtn.style.borderRadius = "3px";
    visibilityBtn.style.cursor = "pointer";
    visibilityBtn.style.fontSize = "12px";
    visibilityBtn.style.display = "flex";
    visibilityBtn.style.alignItems = "center";
    visibilityBtn.style.justifyContent = "center";

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

    return visibilityBtn;
  };

  const createDragHandleButton = (index) => {
    const dragBtn = document.createElement("button");
    dragBtn.id = `layer-drag-${index}`;
    dragBtn.textContent = "☰";
    dragBtn.style.width = "20px";
    dragBtn.style.height = "20px";
    dragBtn.style.padding = "0";
    dragBtn.style.backgroundColor = COLOR_BUTTON_BG;
    dragBtn.style.color = COLOR_BUTTON_TEXT;
    dragBtn.style.border = `1px solid ${COLOR_BUTTON_BORDER}`;
    dragBtn.style.borderRadius = "3px";
    dragBtn.style.cursor = "grab";
    dragBtn.style.fontSize = "14px";
    dragBtn.style.display = "flex";
    dragBtn.style.alignItems = "center";
    dragBtn.style.justifyContent = "center";
    dragBtn.draggable = true;

    dragBtn.ondragstart = (e) => {
      draggedLayerIndex = index;
      dragBtn.style.cursor = "grabbing";
      const layerItem = document.getElementById(`layer-${index}`);
      if (layerItem) {
        layerItem.style.opacity = "0.5";
      }
      e.dataTransfer.effectAllowed = "move";
    };

    dragBtn.ondragend = (e) => {
      dragBtn.style.cursor = "grab";
      const layerItem = document.getElementById(`layer-${index}`);
      if (layerItem) {
        layerItem.style.opacity = "1";
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
    layerItem.id = `layer-${index}`;
    layerItem.style.width = "100%";
    layerItem.style.height = "40px";
    layerItem.style.backgroundColor = COLOR_BUTTON_BG;
    layerItem.style.border = `1px solid ${COLOR_BUTTON_BORDER}`;
    layerItem.style.borderRadius = "4px";
    layerItem.style.display = "flex";
    layerItem.style.flexDirection = "row";
    layerItem.style.alignItems = "center";
    layerItem.style.gap = "5px";
    layerItem.style.padding = "5px";
    layerItem.style.boxSizing = "border-box";
    layerItem.style.position = "relative";

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
    infoContainer.style.display = "flex";
    infoContainer.style.flexDirection = "row";
    infoContainer.style.alignItems = "center";
    infoContainer.style.flex = "1";
    infoContainer.style.gap = "3px";

    // Add label and visibility button
    const label = createLayerLabel(index);
    const visibilityBtn = createVisibilityButton(index);

    infoContainer.appendChild(label);
    infoContainer.appendChild(visibilityBtn);
    layerItem.appendChild(infoContainer);

    return layerItem;
  };

  const createLayersPanelTitle = () => {
    const title = document.createElement("div");
    title.textContent = "Layers";
    title.style.color = COLOR_BUTTON_TEXT;
    title.style.fontSize = "14px";
    title.style.fontWeight = "bold";
    title.style.marginBottom = "5px";
    title.style.textAlign = "center";
    return title;
  };

  const createLayersPanel = () => {
    // Create main content wrapper (canvas + layers side by side)
    const contentWrapper = document.createElement("div");
    contentWrapper.style.display = "flex";
    contentWrapper.style.flexDirection = "row";
    contentWrapper.style.gap = "10px";
    contentWrapper.style.width = "100%";

    containerEl.appendChild(contentWrapper);

    // Create layers panel
    layersPanelEl = document.createElement("div");
    layersPanelEl.style.width = "150px";
    layersPanelEl.style.height =
      HEIGHT - 8 + PADDING * 2 + COMPOSITION_BORDER_SIZE * 2 + "px";
    layersPanelEl.style.backgroundColor = COLOR_TOOLBAR_BG;
    layersPanelEl.style.borderRadius = "8px";
    layersPanelEl.style.padding = "4px";
    layersPanelEl.style.boxSizing = "border-box";
    layersPanelEl.style.overflowY = "auto";
    layersPanelEl.style.display = "flex";
    layersPanelEl.style.flexDirection = "column";
    layersPanelEl.style.marginTop = "8px";
    layersPanelEl.style.gap = "4px";
    layersPanelEl.style.boxShadow = "inset 0 0 5px rgba(0, 0, 0, 0.2)";

    // Add title
    const title = createLayersPanelTitle();
    layersPanelEl.appendChild(title);

    // Create layer items in order based on imagePositions (highest position first)
    const indexPositionPairs = imagePositions.map((position, index) => ({
      index,
      position,
    }));

    // Sort by position (higher position = higher in UI list)
    indexPositionPairs.sort((a, b) => b.position - a.position);

    indexPositionPairs.forEach(({ index }) => {
      const layerItem = createLayerItem(index);
      layersPanelEl.appendChild(layerItem);
    });

    contentWrapper.appendChild(layersPanelEl);

    return contentWrapper;
  };

  const updateLayerThumbnail = (index) => {
    const thumbnail = document.getElementById(`layer-thumbnail-${index}`);
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
    } else {
      console.log(`Layer ${index} is empty or hidden`);
    }
  };

  const toggleImageVisibility = (index) => {
    if (!images[index]) {
      console.log(`Layer ${index} is empty`);
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

    // Update visibility button appearance
    const visibilityBtn = document.getElementById(`layer-visibility-${index}`);
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
    const dataUrl = grabSnapshot();
    showSavingIndicator();
    uploadSnapshot(dataUrl, imageNameWidget.value).then(() => {
      hideSavingIndicator();
      updateSeedValue();
    });
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
    const dataUrl = grabSnapshot();
    showSavingIndicator();
    uploadSnapshot(dataUrl, imageNameWidget.value).then(() => {
      hideSavingIndicator();
      updateSeedValue();
    });
  };

  const updateLayerPanelOrder = () => {
    // Create array of [index, position] pairs and sort by position (highest first for UI)
    const indexPositionPairs = imagePositions.map((position, index) => ({
      index,
      position,
    }));

    // Sort by position (higher position = higher in UI list, since higher = more forward)
    indexPositionPairs.sort((a, b) => b.position - a.position);

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

      // Update visibility button state
      if (images[index]) {
        const visibilityBtn = document.getElementById(
          `layer-visibility-${index}`
        );
        if (visibilityBtn && images[index].visible === false) {
          visibilityBtn.textContent = "👁‍🗨";
          visibilityBtn.style.backgroundColor = COLOR_BUTTON_DISABLED;
        }
      }
    });
  };

  const updateCanvasZOrder = () => {
    // Create array of [index, position] pairs
    const indexPositionPairs = imagePositions.map((position, index) => ({
      index,
      position,
    }));

    // Sort by position (lower position = further back)
    indexPositionPairs.sort((a, b) => a.position - b.position);

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

  // const createClickableRect = (left, top, width, height) => {
  //   clickableRect = new fabric.Rect({
  //     left: left,
  //     top: top,
  //     fill: "rgba(255,0,0,0.3)",
  //     width: width,
  //     height: height,
  //   });
  // };

  const appendCanvasToContainer = (contentWrapper) => {
    // Append canvas to the content wrapper (left side)
    contentWrapper.insertBefore(canvasEl, layersPanelEl);
  };

  const buildImageName = (graphId, nodeId, format, isTemp) => {
    return `${graphId}_${nodeId}.${format}${isTemp ? " [temp]" : ""}`;
  };

  const updateWidgetValues = async (event, node) => {
    const imageName = buildImageName(app.graph.id, node.id, "png", false);
    imageNameWidget.value = imageName;

    // Store custom compositor data instead of full fabric JSON
    const compositorData = serializeCompositorData();
    fabricDataWidget.value = JSON.stringify(compositorData);

    const dataUrl = grabSnapshot();
    await uploadSnapshot(dataUrl, imageNameWidget.value, true);

    node.setDirtyCanvas(true, true); // Force UI update
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
      console.log(`Compositor3Debug: initialized imageName to ${imageName}`);
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

  const restoreImagePositions = () => {
    try {
      const widgetValue = fabricDataWidget.value;
      if (widgetValue && typeof widgetValue === "string") {
        const data = deserializeCompositorData(widgetValue);
        if (data) {
          // imagePositions, snapEnabled, and gridSize are restored in deserializeCompositorData
          console.log("Compositor3Debug: restored compositor data");
        }
      }
    } catch (e) {
      console.log("Compositor3Debug: could not restore compositor data", e);
    }
  };

  const getContainer = () => {
    return containerEl;
  };

  const updateCanvasDimensions = (width, height, padding) => {
    // Ensure numeric values to avoid string concatenation issues
    const w = Number(width);
    const h = Number(height);
    const p = Number(padding);

    console.log(
      `Compositor3Debug: updating canvas dimensions to ${w}x${h}, padding: ${p}`
    );

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
    //const toolbarSize = toolbarEl.getBoundingClientRect();
    //console.log("Compositor3Debug: toolbar size", toolbarSize);
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
    });

    let currentTransform = null;

    // First, check if there's a pending transform (from deserialization)
    if (pendingTransforms[index]) {
      currentTransform = pendingTransforms[index];
      console.log(
        "Compositor3Debug: applying pending transform for index",
        index,
        currentTransform
      );
      pendingTransforms[index] = null; // Clear after use
    }
    // Otherwise, check if there's an existing image to preserve its transform
    else if (hasImageAtIndex(index)) {
      currentTransform = getCurrentTransforms(index);
      console.log(
        "Compositor3Debug: preserving existing transform",
        currentTransform
      );
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

    // Update visibility button state if image is hidden
    const visibilityBtn = document.getElementById(`layer-visibility-${index}`);
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
      console.log(`Compositor3Debug: No image source for index ${index}`);
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

    console.log(
      `Compositor3Debug: Loading image ${index} from ${imageUrl.substring(
        0,
        100
      )}...`
    );

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
          console.warn(
            `Compositor3Debug: Failed to load image ${index} (file may not exist yet), using placeholder`
          );
          createPlaceholderImage(index, (placeholderImg) =>
            fromUrlCallback(placeholderImg, index)
          );
        } else {
          console.log(`Compositor3Debug: Successfully loaded image ${index}`);
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
        console.log(
          `Compositor3Debug: restoring canvas dimensions ${data.width}x${data.height}, padding: ${data.padding}`
        );
        // Just set the variables during restoration, don't call updateCanvasDimensions yet
        // because fabric instance and elements don't exist yet during initialization
        canvasWidth = Number(data.width);
        canvasHeight = Number(data.height);
        canvasPadding = Number(data.padding);
      }

      // Restore imagePositions if available
      if (data.imagePositions && Array.isArray(data.imagePositions)) {
        imagePositions = data.imagePositions;
        console.log(
          "Compositor3Debug: restored imagePositions",
          imagePositions
        );
      }

      // Restore snap settings if available
      if (data.snapEnabled !== undefined) {
        snapEnabled = data.snapEnabled;
        console.log("Compositor3Debug: restored snapEnabled", snapEnabled);
      }

      if (data.gridSize !== undefined) {
        gridSize = data.gridSize;
        console.log("Compositor3Debug: restored gridSize", gridSize);
      }

      // Store transforms for pending restoration
      if (data.transforms && Array.isArray(data.transforms)) {
        console.log(
          "Compositor3Debug: storing pending transforms",
          data.transforms
        );
        pendingTransforms = data.transforms.slice(); // Copy the array
      }

      // Restore images from imageNames if available
      if (data.imageNames && Array.isArray(data.imageNames)) {
        console.log(
          "Compositor3Debug: restoring images from imageNames",
          data.imageNames
        );
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
      console.log("Compositor3Debug: could not deserialize compositor data", e);
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
    });

    // Update rotation slider when selection changes
    fabricInstance.on("selection:created", function (opt) {
      updateRotationSlider();
      if (rotationSlider) rotationSlider.disabled = false;
    });

    fabricInstance.on("selection:updated", function (opt) {
      updateRotationSlider();
      if (rotationSlider) rotationSlider.disabled = false;
    });

    fabricInstance.on("selection:cleared", function (opt) {
      if (rotationSlider) {
        rotationSlider.disabled = true;
        rotationSlider.value = "0";
      }
      if (rotationLabel) {
        rotationLabel.textContent = "Rotate: 0°";
      }
    });

    // Save after object is modified
    fabricInstance.on("object:modified", function (opt) {
      console.log("compositor3Debug: async object modified event");
      const dataUrl = grabSnapshot();
      showSavingIndicator();
      uploadSnapshot(dataUrl, imageNameWidget.value).then(() => {
        hideSavingIndicator();
        updateSeedValue();
      });
    });
  };

  const updateSeedValue = () => {
    // Store custom compositor data with a random seed to trigger update
    const compositorData = serializeCompositorData();
    compositorData.seed = Math.random(); // Add seed to trigger change detection
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
      console.log("No object selected for alignment");
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
        activeObject.set({
          left: compRight - objBounds.width - offsetX,
          top: compBottom - objBounds.height - offsetY,
        });
        break;
    }

    activeObject.setCoords();
    fabricInstance.renderAll();
  };

  const isImageObject = (obj) => {
    // Check if object is one of our managed images
    return images.includes(obj);
  };

  const stretchHorizontally = () => {
    const activeObject = fabricInstance.getActiveObject();
    if (!activeObject || !isImageObject(activeObject)) {
      console.log("No image selected for stretching");
      return;
    }

    // Calculate scale to make scaled width equal to composition width
    const targetWidth = canvasWidth;
    const currentScaledWidth = activeObject.getScaledWidth();
    const scaleFactor = targetWidth / currentScaledWidth;

    // Apply the scale factor to both scaleX and scaleY to maintain proportions
    activeObject.set({
      scaleX: activeObject.scaleX * scaleFactor,
      scaleY: activeObject.scaleY * scaleFactor,
    });

    activeObject.setCoords();
    fabricInstance.renderAll();
  };

  const stretchVertically = () => {
    const activeObject = fabricInstance.getActiveObject();
    if (!activeObject || !isImageObject(activeObject)) {
      console.log("No image selected for stretching");
      return;
    }

    // Calculate scale to make scaled height equal to composition height
    const targetHeight = canvasHeight;
    const currentScaledHeight = activeObject.getScaledHeight();
    const scaleFactor = targetHeight / currentScaledHeight;

    // Apply the scale factor to both scaleX and scaleY to maintain proportions
    activeObject.set({
      scaleX: activeObject.scaleX * scaleFactor,
      scaleY: activeObject.scaleY * scaleFactor,
    });

    activeObject.setCoords();
    fabricInstance.renderAll();
  };

  const equalizeHeight = () => {
    const activeObject = fabricInstance.getActiveObject();
    if (!activeObject) {
      console.log("No object selected for equalizing");
      return;
    }

    // Check if it's a multi-selection (ActiveSelection in Fabric.js 4.6)
    if (activeObject.type !== "activeSelection") {
      console.log("Multiple objects must be selected for equalizing");
      return;
    }

    const objects = activeObject._objects.filter((obj) => isImageObject(obj));

    if (objects.length < 2) {
      console.log("At least 2 images must be selected");
      return;
    }

    // Use the first object's scaled height as reference
    const referenceHeight = objects[0].getScaledHeight();

    objects.forEach((obj, index) => {
      if (index === 0) return; // Skip the reference object

      const scale = referenceHeight / obj.height;
      obj.set({
        scaleX: scale,
        scaleY: scale,
      });
      obj.setCoords();
    });

    fabricInstance.renderAll();
  };

  const equalizeWidth = () => {
    const activeObject = fabricInstance.getActiveObject();
    if (!activeObject) {
      console.log("No object selected for equalizing");
      return;
    }

    // Check if it's a multi-selection (ActiveSelection in Fabric.js 4.6)
    if (activeObject.type !== "activeSelection") {
      console.log("Multiple objects must be selected for equalizing");
      return;
    }

    const objects = activeObject._objects.filter((obj) => isImageObject(obj));

    if (objects.length < 2) {
      console.log("At least 2 images must be selected");
      return;
    }

    // Use the first object's scaled width as reference
    const referenceWidth = objects[0].getScaledWidth();

    objects.forEach((obj, index) => {
      if (index === 0) return; // Skip the reference object

      const scale = referenceWidth / obj.width;
      obj.set({
        scaleX: scale,
        scaleY: scale,
      });
      obj.setCoords();
    });

    fabricInstance.renderAll();
  };

  const distributeVertically = () => {
    const activeObject = fabricInstance.getActiveObject();
    if (!activeObject) {
      console.log("No object selected for distribution");
      return;
    }

    // Check if it's a multi-selection (ActiveSelection in Fabric.js 4.6)
    if (activeObject.type !== "activeSelection") {
      console.log("Multiple objects must be selected for distribution");
      return;
    }

    const objects = activeObject._objects.filter((obj) => isImageObject(obj));

    if (objects.length < 2) {
      console.log("At least 2 images must be selected");
      return;
    }

    // Sort objects by their center Y position
    objects.sort((a, b) => {
      const aCenterY = a.getCenterPoint().y;
      const bCenterY = b.getCenterPoint().y;
      return aCenterY - bCenterY;
    });

    const firstObj = objects[0];
    const lastObj = objects[objects.length - 1];

    // Get center Y positions of first and last objects
    const firstCenterY = firstObj.getCenterPoint().y;
    const lastCenterY = lastObj.getCenterPoint().y;

    // Calculate even spacing between centers
    const totalSpace = lastCenterY - firstCenterY;
    const spacing = totalSpace / (objects.length - 1);

    // Distribute objects by their centers
    objects.forEach((obj, index) => {
      const newCenterY = firstCenterY + spacing * index;
      const currentCenter = obj.getCenterPoint();

      // Calculate the offset needed to move center to new position
      const deltaY = newCenterY - currentCenter.y;

      obj.set({
        top: snapToGrid(obj.top + deltaY),
      });
      obj.setCoords();
    });

    fabricInstance.renderAll();
  };

  const distributeHorizontally = () => {
    const activeObject = fabricInstance.getActiveObject();
    if (!activeObject) {
      console.log("No object selected for distribution");
      return;
    }

    // Check if it's a multi-selection (ActiveSelection in Fabric.js 4.6)
    if (activeObject.type !== "activeSelection") {
      console.log("Multiple objects must be selected for distribution");
      return;
    }

    const objects = activeObject._objects.filter((obj) => isImageObject(obj));

    if (objects.length < 2) {
      console.log("At least 2 images must be selected");
      return;
    }

    // Sort objects by their center X position
    objects.sort((a, b) => {
      const aCenterX = a.getCenterPoint().x;
      const bCenterX = b.getCenterPoint().x;
      return aCenterX - bCenterX;
    });

    const firstObj = objects[0];
    const lastObj = objects[objects.length - 1];

    // Get center X positions of first and last objects
    const firstCenterX = firstObj.getCenterPoint().x;
    const lastCenterX = lastObj.getCenterPoint().x;

    // Calculate even spacing between centers
    const totalSpace = lastCenterX - firstCenterX;
    const spacing = totalSpace / (objects.length - 1);

    // Distribute objects by their centers
    objects.forEach((obj, index) => {
      const newCenterX = firstCenterX + spacing * index;
      const currentCenter = obj.getCenterPoint();

      // Calculate the offset needed to move center to new position
      const deltaX = newCenterX - currentCenter.x;

      obj.set({
        left: snapToGrid(obj.left + deltaX),
      });
      obj.setCoords();
    });

    fabricInstance.renderAll();
  };

  const flipHorizontally = () => {
    const activeObject = fabricInstance.getActiveObject();
    if (!activeObject) {
      console.log("No object selected for flipping");
      return;
    }

    // Store original origin settings
    const originalOriginX = activeObject.originX;
    const originalOriginY = activeObject.originY;

    // Get the center point before flipping
    const center = activeObject.getCenterPoint();

    // Temporarily set origin to center for proper flipping
    activeObject.set({
      originX: "center",
      originY: "center",
    });

    // Flip by inverting scaleX
    activeObject.set({
      scaleX: -activeObject.scaleX,
    });

    // Restore original origin settings
    activeObject.set({
      originX: originalOriginX,
      originY: originalOriginY,
    });

    activeObject.setCoords();
    fabricInstance.renderAll();
  };

  const flipVertically = () => {
    const activeObject = fabricInstance.getActiveObject();
    if (!activeObject) {
      console.log("No object selected for flipping");
      return;
    }

    // Store original origin settings
    const originalOriginX = activeObject.originX;
    const originalOriginY = activeObject.originY;

    // Get the center point before flipping
    const center = activeObject.getCenterPoint();

    // Temporarily set origin to center for proper flipping
    activeObject.set({
      originX: "center",
      originY: "center",
    });

    // Flip by inverting scaleY
    activeObject.set({
      scaleY: -activeObject.scaleY,
    });

    // Restore original origin settings
    activeObject.set({
      originX: originalOriginX,
      originY: originalOriginY,
    });

    activeObject.setCoords();
    fabricInstance.renderAll();
  };

  const setSaveFolder = (folder) => {
    saveFolder = folder;
    console.log(`Compositor3Debug: saveFolder set to ${saveFolder}`);
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

        console.log("Compositor3Debug Editor: state restored successfully");
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
  };
};
