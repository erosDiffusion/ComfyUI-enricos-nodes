import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { fabric } from "./fabric.js";

// Constants
const COMPOSITOR_4 = "Compositor4";
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
  name: "Comfy.Compositor4",

  async setup(app) {
    api.addEventListener("compositor4_init", executedMessageHandler);
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
  return node.constructor.comfyClass == COMPOSITOR_4;
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

function getSeedWidget(node) {
  return getWidget(node, "seed");
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

    // Set initial size - this will be updated in loadedGraphNode or compositor4_init
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
    console.error("Compositor4: Error restoring canvas state:", error);
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

  console.log("[Compositor4] executedMessageHandler: nodeId=", nodeId);

  // Check if node exists before checking type
  if (!node) {
    console.error("[Compositor4] Node not found");
    return;
  }

  const nodeFound = isCorrectType(node);

  if (nodeFound) {
    console.log("[Compositor4] 1 Node found");
    // This event is triggered when the Python backend executes the node
    // At this point, widget values are populated with actual config data
    // This is when we update the editor with canvas dimensions, images, etc.
    const e = event.detail.output;
    const editor = node.editor;

    // console.log("[Compositor4] Event data:", {
    //   // width: e.width,
    //   // height: e.height,
    //   // namesCount: e.names?.length,
    //   configSignature: e.configSignature,
    //   configChanged: e.configChanged,
    //   onConfigChangedContinue: e.onConfigChangedContinue,
    // });

    // Check if editor exists (it might not if node was just created)
    if (!editor) {
      console.warn("[Compositor4] 2 Editor not initialized yet");
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
      // console.log("[Compositor4] Loading images:", e.names);
      e.names.forEach((name, index) => editor.appendImage(name, index));
    }

    // Store applyMaskInConfig mode
    if (e.applyMaskInConfig !== undefined) {
      editor.setApplyMaskInConfig(Boolean(e.applyMaskInConfig?.[0]));
    }

    // Load mask filenames if available
    if (e.maskNames && Array.isArray(e.maskNames)) {
      editor.loadMasks(e.maskNames);
    }

    // Handle auto-save for "grab and continue" mode
    const onConfigChangedContinue = Boolean(e.onConfigChangedContinue?.[0]);
    const configChanged = Boolean(e.configChanged?.[0]);

    console.log("[Compositor4] 3 Auto-save check:", {
      configChanged,
      onConfigChangedContinue,
      rawConfigChanged: e.configChanged,
      rawOnConfigChangedContinue: e.onConfigChangedContinue,
    });

    // Generic wait utility function
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    // If config changed, IMMEDIATELY update the seed to invalidate cache
    // This must happen synchronously before any user action
    if (configChanged) {
      console.log(
        "[Compositor4] Config changed - updating seed with configSignature:",
        e.configSignature
      );
      editor.updateSeedValue(e.configSignature);
    }

    // If in "grab and continue" mode, auto-save and re-queue
    if (configChanged && onConfigChangedContinue) {
      console.log("[Compositor4] Auto-save mode triggered");

      // In "grab and continue" mode: auto-save snapshot and re-queue
      // Sequence: wait for images to load -> save -> wait -> enqueue
      wait(100)
        .then(() => {
          console.log("[Compositor4] Starting auto-save");
          return editor.queuedSave(false);
        })
        .then(() => wait(100))
        .then(() => {
          console.log("[Compositor4] Re-queueing workflow");
          app.queuePrompt(0, 1);
        })
        .catch((error) => {
          console.error("[Compositor4] Auto-save sequence failed:", error);
        });
    }
  }
}

const getNodeById = (nodeId) => {
  return app.graph.getNodeById(nodeId);
};

// Legacy wrappers for backward compatibility (use createButton instead)
const createToolbarButton = (text, onClick, parent) =>
  createButton({ type: "toolbar", content: text, onClick, parent });

const createIconButton = (icon, onClick, parent) =>
  createButton({ type: "icon", content: icon, onClick, parent });

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

const createHorizontalButtonGroup = (parent) => {
  const group = document.createElement("div");
  applyStyles(group, {
    display: "flex",
    flexDirection: "row",
    gap: "2px",
    alignItems: "center",
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

// Proposal 9: Array/Collection Utilities
const ArrayUtils = {
  // Create array filled with null values
  createNullArray: (length) => Array(length).fill(null),

  // Create sorted pairs of [index, position] for layer ordering
  createSortedIndexPositionPairs: (positions, descending = false) => {
    const pairs = positions.map((position, index) => ({ index, position }));
    return descending
      ? pairs.sort((a, b) => b.position - a.position)
      : pairs.sort((a, b) => a.position - b.position);
  },

  // Filter objects by type
  filterByType: (objects, type) => objects.filter((obj) => obj.type === type),

  // Filter image objects from a collection
  filterImageObjects: (objects, imageArray) =>
    objects.filter((obj) => imageArray.includes(obj)),

  // Apply function to each item with optional condition
  forEachIf: (array, condition, callback) => {
    array.forEach((item, index) => {
      if (!condition || condition(item, index)) {
        callback(item, index);
      }
    });
  },
};

// Legacy wrappers for backward compatibility
const createNullArray = ArrayUtils.createNullArray;
const createSortedIndexPositionPairs =
  ArrayUtils.createSortedIndexPositionPairs;

// ============================================================================
// REFACTORED UTILITIES (Proposals 1, 2, 5)
// ============================================================================

// Proposal 2: Style Presets
const STYLE_PRESETS = {
  button: {
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
  },
  iconButton: {
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
  },
  dragHandle: {
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
  },
  visibilityButton: {
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
  },
};

// Proposal 2: Add hover behavior to button
const addHoverBehavior = (button, getActiveState = null) => {
  button.onmouseover = () => {
    button.style.backgroundColor = COLOR_BUTTON_HOVER;
  };
  button.onmouseout = () => {
    if (getActiveState) {
      const isActive = getActiveState();
      button.style.backgroundColor = isActive
        ? COLOR_BUTTON_ACTIVE
        : COLOR_BUTTON_BG;
    } else {
      button.style.backgroundColor = COLOR_BUTTON_BG;
    }
  };
};

// Proposal 1: Unified Button Factory
const createButton = (config) => {
  const {
    type = "toolbar", // 'toolbar', 'icon', 'toggle', 'visibility', 'drag'
    content,
    onClick,
    parent,
    initialState = false,
    onLabel = "ON",
    offLabel = "OFF",
    customStyles = {},
    title = "",
  } = config;

  const button = document.createElement("button");
  button.textContent = content;
  if (title) button.title = title;

  // Apply preset styles based on type
  let baseStyles = {};
  switch (type) {
    case "icon":
      baseStyles = STYLE_PRESETS.iconButton;
      break;
    case "drag":
      baseStyles = STYLE_PRESETS.dragHandle;
      break;
    case "visibility":
      baseStyles = STYLE_PRESETS.visibilityButton;
      break;
    case "toggle":
      baseStyles = {
        ...STYLE_PRESETS.button,
        backgroundColor: initialState
          ? COLOR_BUTTON_ACTIVE
          : COLOR_BUTTON_DISABLED,
      };
      break;
    default:
      baseStyles = STYLE_PRESETS.button;
  }

  applyStyles(button, { ...baseStyles, ...customStyles });

  // Toggle button special behavior
  if (type === "toggle") {
    let state = initialState;
    const toggleHandler = () => {
      state = !state;
      button.textContent = state ? onLabel : offLabel;
      button.style.backgroundColor = state
        ? COLOR_BUTTON_ACTIVE
        : COLOR_BUTTON_DISABLED;
      if (onClick) onClick(state);
    };
    button.onclick = toggleHandler;
    addHoverBehavior(button, () => state);
  } else {
    button.onclick = onClick;
    addHoverBehavior(button);
  }

  if (parent) {
    parent.appendChild(button);
  }

  return button;
};

// Proposal 5: Transformation Engine
const TransformationEngine = {
  // Helper: Apply transformation and save
  applyAndSave: (obj, transformation, fabricInstance, saveCallback) => {
    obj.set(transformation);
    obj.setCoords();
    fabricInstance.renderAll();
    saveCallback();
  },

  // Stretch operations
  stretch: (fabricInstance, axis, canvasDimension, saveCallback) => {
    const activeObject = fabricInstance.getActiveObject();
    if (!activeObject || activeObject.type === "activeSelection") return;

    const currentDimension =
      axis === "horizontal"
        ? activeObject.getScaledWidth()
        : activeObject.getScaledHeight();
    const scaleFactor = canvasDimension / currentDimension;

    TransformationEngine.applyAndSave(
      activeObject,
      {
        scaleX: activeObject.scaleX * scaleFactor,
        scaleY: activeObject.scaleY * scaleFactor,
      },
      fabricInstance,
      saveCallback
    );
  },

  // Equalize operations
  equalize: (fabricInstance, axis, imageArray, saveCallback) => {
    const activeObject = fabricInstance.getActiveObject();
    if (!activeObject || activeObject.type !== "activeSelection") return;

    const objects = ArrayUtils.filterImageObjects(
      activeObject._objects,
      imageArray
    );
    if (objects.length < 2) return;

    const referenceDimension =
      axis === "horizontal"
        ? objects[0].getScaledWidth()
        : objects[0].getScaledHeight();

    objects.forEach((obj, index) => {
      if (index === 0) return;
      const scale =
        referenceDimension / (axis === "horizontal" ? obj.width : obj.height);
      obj.set({ scaleX: scale, scaleY: scale });
      obj.setCoords();
    });

    fabricInstance.renderAll();
    saveCallback();
  },

  // Distribute operations
  distribute: (
    fabricInstance,
    axis,
    isImageObject,
    snapToGrid,
    saveCallback
  ) => {
    const activeObject = fabricInstance.getActiveObject();
    if (!activeObject || activeObject.type !== "activeSelection") return;

    const objects = activeObject._objects.filter((obj) => isImageObject(obj));
    if (objects.length < 2) return;

    const getCenterCoord = (obj) =>
      axis === "horizontal" ? obj.getCenterPoint().x : obj.getCenterPoint().y;

    objects.sort((a, b) => getCenterCoord(a) - getCenterCoord(b));

    const firstCoord = getCenterCoord(objects[0]);
    const lastCoord = getCenterCoord(objects[objects.length - 1]);
    const spacing = (lastCoord - firstCoord) / (objects.length - 1);

    objects.forEach((obj, index) => {
      const newCoord = firstCoord + spacing * index;
      const currentCoord = getCenterCoord(obj);
      const delta = newCoord - currentCoord;

      if (axis === "horizontal") {
        obj.set({ left: snapToGrid(obj.left + delta) });
      } else {
        obj.set({ top: snapToGrid(obj.top + delta) });
      }
      obj.setCoords();
    });

    fabricInstance.renderAll();
    saveCallback();
  },

  // Flip operations
  flip: (fabricInstance, axis, saveCallback) => {
    const activeObject = fabricInstance.getActiveObject();
    if (!activeObject) return;

    const originalOriginX = activeObject.originX;
    const originalOriginY = activeObject.originY;

    activeObject.set({ originX: "center", originY: "center" });

    const scaleProperty = axis === "horizontal" ? "scaleX" : "scaleY";
    activeObject.set({ [scaleProperty]: -activeObject[scaleProperty] });

    activeObject.set({ originX: originalOriginX, originY: originalOriginY });
    activeObject.setCoords();
    fabricInstance.renderAll();
    saveCallback();
  },
};

// Proposal 3: Layer UI Component Factory
const createLayerUI = (config) => {
  const {
    index = null,
    type = "image", // 'image', 'foreground', 'background'
    label,
    isDraggable = true,
    hasColorPicker = false,
    icon = null,
    onVisibilityToggle,
    onSelect,
    onDragStart,
    onDragEnd,
    onDragOver,
    onDragLeave,
    onDrop,
    colorPickerValue = "#ffffff",
  } = config;

  const layerItem = document.createElement("div");
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
    cursor: type === "image" ? "default" : "pointer",
  });

  // Drag handle or icon placeholder
  let dragHandle = null;
  if (isDraggable && type === "image") {
    dragHandle = createButton({
      type: "drag",
      content: "☰",
    });
    dragHandle.draggable = true;
    if (onDragStart) dragHandle.ondragstart = onDragStart;
    if (onDragEnd) dragHandle.ondragend = onDragEnd;
    layerItem.appendChild(dragHandle);

    // Add drop handlers to layer item
    if (onDragOver) layerItem.ondragover = onDragOver;
    if (onDragLeave) layerItem.ondragleave = onDragLeave;
    if (onDrop) layerItem.ondrop = onDrop;
  } else {
    const iconPlaceholder = document.createElement("div");
    iconPlaceholder.textContent = icon || (type === "foreground" ? "✏" : "🖼");
    applyStyles(iconPlaceholder, {
      width: "20px",
      height: "20px",
      flexShrink: "0",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "14px",
      color: COLOR_BUTTON_TEXT,
    });
    layerItem.appendChild(iconPlaceholder);
  }

  // Thumbnail or color picker
  let thumbnail = null;
  let colorInput = null;
  if (hasColorPicker) {
    thumbnail = document.createElement("div");
    applyStyles(thumbnail, {
      width: "30px",
      height: "30px",
      backgroundColor: colorPickerValue,
      borderRadius: "2px",
      border: "1px solid rgba(255, 255, 255, 0.3)",
      cursor: "pointer",
      flexShrink: "0",
    });

    colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.value = colorPickerValue.startsWith("#")
      ? colorPickerValue
      : "#ffffff";
    colorInput.style.display = "none";

    thumbnail.onclick = () => colorInput.click();
    layerItem.appendChild(colorInput);
    layerItem.appendChild(thumbnail);
  } else {
    thumbnail = document.createElement("div");
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
      cursor: type === "image" || type === "foreground" ? "pointer" : "default",
      flexShrink: "0",
    });
    if (type === "background") {
      thumbnail.style.border = hasColorPicker
        ? "1px solid rgba(255, 255, 255, 0.3)"
        : `1px solid ${COLOR_BUTTON_BORDER}`;
    }
    if (onSelect && type === "image") {
      thumbnail.onclick = onSelect;
    }
    layerItem.appendChild(thumbnail);
  }

  // Mask preview (only for image layers)
  let maskThumbnail = null;
  let onMaskToggle = config.onMaskToggle; // Callback for mask toggle
  if (type === "image") {
    maskThumbnail = document.createElement("div");
    applyStyles(maskThumbnail, {
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
      fontSize: "9px", // Match image thumbnail font size
      cursor: "pointer", // Make clickable
      flexShrink: "0",
      // No border by default - matches image thumbnail
    });
    maskThumbnail.textContent = "";

    // Add click handler for mask toggle
    if (onMaskToggle) {
      maskThumbnail.onclick = (e) => {
        e.stopPropagation();
        onMaskToggle(index);
      };
    }

    layerItem.appendChild(maskThumbnail);
  }

  // Info container with label and visibility button
  const infoContainer = document.createElement("div");
  applyStyles(infoContainer, {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    flex: "1",
    gap: "3px",
  });

  const labelElement = document.createElement("div");
  labelElement.textContent = label;
  applyStyles(labelElement, {
    color: COLOR_BUTTON_TEXT,
    fontSize: "10px",
    fontWeight: "bold",
    width: type === "image" ? "auto" : "37px",
  });

  const visibilityButton = createButton({
    type: "visibility",
    content: "👁",
    onClick: (e) => {
      e.stopPropagation();
      if (onVisibilityToggle) onVisibilityToggle();
    },
  });

  infoContainer.appendChild(labelElement);
  infoContainer.appendChild(visibilityButton);
  layerItem.appendChild(infoContainer);

  // Add click handler for foreground/background layers
  if ((type === "foreground" || type === "background") && onSelect) {
    layerItem.onclick = onSelect;
  }

  return {
    layerItem,
    thumbnail,
    maskThumbnail,
    visibilityButton,
    colorInput,
    dragHandle,
  };
};

// Proposal 7: Input Control Factory
const createControl = (config) => {
  const {
    type = "slider", // 'slider', 'number'
    label = "",
    min = 0,
    max = 100,
    value = 0,
    disabled = false,
    onChange,
    parent,
    unit = "",
  } = config;

  if (type === "slider") {
    // Create slider with label
    const container = document.createElement("div");
    applyStyles(container, {
      display: "flex",
      flexDirection: "column",
      gap: "2px",
      //minWidth: "80px",
    });

    // Label element
    const labelElement = document.createElement("label");
    labelElement.textContent = `${label}: ${value}${unit}`;
    applyStyles(labelElement, {
      color: COLOR_BUTTON_TEXT,
      fontSize: "10px",
      textAlign: "center",
      height: "24px",
      lineHeight: "24px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    });
    container.appendChild(labelElement);

    // Slider container
    const sliderContainer = document.createElement("div");
    applyStyles(sliderContainer, {
      height: "24px",
      display: "flex",
      alignItems: "center",
    });
    container.appendChild(sliderContainer);

    // Slider input
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = min.toString();
    slider.max = max.toString();
    slider.value = value.toString();
    slider.disabled = disabled;
    applyStyles(slider, {
      width: "100%",
      cursor: disabled ? "not-allowed" : "pointer",
    });

    slider.oninput = (e) => {
      const newValue =
        type === "number"
          ? parseInt(e.target.value)
          : parseFloat(e.target.value);
      labelElement.textContent = `${label}: ${newValue}${unit}`;
      if (onChange) onChange(newValue, e);
    };

    sliderContainer.appendChild(slider);

    if (parent) {
      parent.appendChild(container);
    }

    return { container, slider, label: labelElement };
  } else if (type === "number") {
    // Create number input with label
    const container = document.createElement("div");
    applyStyles(container, {
      display: "flex",
      gap: "3px",
      alignItems: "center",
      height: "24px",
    });

    const labelElement = document.createElement("label");
    labelElement.textContent = label;
    applyStyles(labelElement, {
      color: COLOR_BUTTON_TEXT,
      fontSize: "10px",
      minWidth: "15px",
    });
    container.appendChild(labelElement);

    const input = document.createElement("input");
    input.type = "number";
    input.value = value.toString();
    input.disabled = disabled;
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

    if (onChange) {
      input.onchange = (e) => onChange(parseFloat(e.target.value), e);
    }

    container.appendChild(input);

    if (parent) {
      parent.appendChild(container);
    }

    return { container, input, label: labelElement };
  }
};

// ============================================================================
// END REFACTORED UTILITIES
// ============================================================================

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
  let backgroundColor = COMPOSITION_BACKGROUND_COLOR; // Background color for composition area
  const IMAGE_COUNT = 9;
  let images = createNullArray(IMAGE_COUNT);
  let maskImages = createNullArray(IMAGE_COUNT); // Store Fabric mask image objects for clipPath
  let maskNames = createNullArray(IMAGE_COUNT); // Store mask filenames for each layer
  let maskStates = Array.from({ length: IMAGE_COUNT }, () => true); // Track if mask is enabled per layer (default: true)
  let applyMaskInConfig = true; // Global setting: true = masks applied in config (RGBA), false = frontend clipPath
  let imagePositions = Array.from({ length: IMAGE_COUNT }, (_, i) => i); // Z-index stacking order (0=bottom, 8=top)
  let draggedLayerIndex = null; // Track which layer is being dragged
  let pendingTransforms = createNullArray(IMAGE_COUNT); // Store transforms to apply during restoration

  // Store direct references to layer UI elements (avoids getElementById issues with multiple nodes)
  let layerItems = createNullArray(IMAGE_COUNT);
  let layerThumbnails = createNullArray(IMAGE_COUNT);
  let layerMaskThumbnails = createNullArray(IMAGE_COUNT); // Store mask preview elements
  let layerVisibilityButtons = createNullArray(IMAGE_COUNT);

  // Store references to background layer UI elements
  let backgroundColorInput = null;
  let backgroundColorThumbnail = null;
  let backgroundVisibilityButton = null;
  let backgroundColorOpaque = COMPOSITION_BACKGROUND_COLOR; // Store the opaque color when toggling to transparent
  let backgroundIsVisible = true; // Track if background is visible (not transparent)

  // Store references to foreground drawing layer
  let foregroundLayer = null; // Fabric image object for drawing layer
  let foregroundLayerItem = null; // UI element
  let foregroundThumbnail = null; // Thumbnail preview element
  let foregroundVisibilityButton = null;
  let isDrawingMode = false; // Track if drawing mode is active
  let foregroundIsVisible = true; // Track if FG layer is visible
  let toolMode = "select"; // 'select', 'draw', or 'erase'
  let brushColor = "#ff0000"; // Red by default
  let brushWidth = 3; // 3px by default
  let brushShape = "circle"; // 'circle' or 'square'
  let isCanvasDrawing = false; // Track if using canvas primitives for eraser
  let canvasDrawingPath = []; // Store path points for canvas drawing
  let storedSelectedLayerIndex = null; // Store layer selection when switching to draw/erase
  let isCtrlPressed = false; // Track Ctrl key for temporary mode switching
  let tempToolMode = null; // Temporary tool mode when Ctrl is held

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
  let colorChangeDebounceTimeout = null; // Debounce timer for background color changes
  const COLOR_CHANGE_DEBOUNCE_DELAY = 250; // milliseconds

  const imageNameWidget = getImageNameWidget(node);
  const fabricDataWidget = getFabricDataWidget(node);
  const seedWidget = getSeedWidget(node);

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
  ) =>
    createButton({
      type: "toggle",
      content: initialState ? onLabel : offLabel,
      onClick: onChange,
      parent,
      initialState,
      onLabel,
      offLabel,
    });

  // Helper function to create number input
  // Legacy wrapper for backward compatibility
  const createNumberInput = (labelText, parent) =>
    createControl({ type: "number", label: labelText, parent, disabled: true });

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
      minWidth: "400px",
      minHeight: "80px",
      height: "80px",
      backgroundColor: COLOR_TOOLBAR_BG,
      display: "flex",
      alignItems: "center",
      borderRadius: "8px",
      padding: "5px 10px",
      boxSizing: "border-box",
      gap: "5px",
      position: "relative",
      boxShadow: "inset 0 0 5px rgba(0, 0, 0, 0.2)",
      overflowX: "auto",
      overflowY: "hidden",
      scrollbarWidth: "none", // Firefox
      msOverflowStyle: "none", // IE/Edge
    });

    // Hide scrollbar for Chrome/Safari/Opera
    const style = document.createElement("style");
    style.textContent = `
      #${toolbarEl.id || "toolbar"}::-webkit-scrollbar {
        display: none;
      }
    `;
    document.head.appendChild(style);

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
    // COMMENTED OUT: Not reliable, but functionality is kept
    // const equalizeRow = createButtonRow(transformButtonGroup);

    // const equalizeWidthBtn = createIconButton(
    //   "=W",
    //   () => equalizeWidth(),
    //   equalizeRow
    // );
    // equalizeWidthBtn.title =
    //   "Equalize width of all selected images (keeping proportions)";

    // const equalizeHeightBtn = createIconButton(
    //   "=H",
    //   () => equalizeHeight(),
    //   equalizeRow
    // );
    // equalizeHeightBtn.title =
    //   "Equalize height of all selected images (keeping proportions)";

    // Row 3: Distribute buttons (⋮ ⋯ symbols for distribute)
    // COMMENTED OUT: Not reliable, but functionality is kept
    // const distributeRow = createButtonRow(transformButtonGroup);

    // const distributeHBtn = createIconButton(
    //   "⋯",
    //   () => distributeHorizontally(),
    //   distributeRow
    // );
    // distributeHBtn.title = "Distribute selected images horizontally";

    // const distributeVBtn = createIconButton(
    //   "⋮",
    //   () => distributeVertically(),
    //   distributeRow
    // );
    // distributeVBtn.title = "Distribute selected images vertically";

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
    snapBtn.title = "Toggle snap-to-grid for precise alignment";

    // Create grid size slider
    const gridControl = createControl({
      type: "slider",
      label: "Grid",
      min: 1,
      max: 50,
      value: gridSize,
      unit: "px",
      onChange: (newValue) => {
        gridSize = newValue;
      },
    });
    snapGridContainer.appendChild(gridControl.container);
    gridSizeSlider = gridControl.slider;
    gridSizeLabel = gridControl.label;

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
        ArrayUtils.forEachIf(
          images,
          (img) => img !== null,
          (img) => img.set("perPixelTargetFind", preciseSelection)
        );
        fabricInstance.renderAll();
      },
      rotationPreciseContainer
    );
    preciseBtn.title =
      "Toggle precise pixel-level selection (ignores transparent areas)";

    // Create rotation slider
    const rotationControl = createControl({
      type: "slider",
      label: "Rotate",
      min: 0,
      max: 360,
      value: 0,
      unit: "°",
      disabled: true,
      onChange: (angle, e) => {
        if (isUpdatingRotationSlider) return; // Prevent circular updates

        // Constrain to 5-degree steps if Shift is pressed
        if (e.shiftKey) {
          angle = Math.round(angle / 5) * 5;
          rotationSlider.value = angle; // Update slider to snapped value
          rotationLabel.textContent = `Rotate: ${angle}°`;
        }

        const activeObject = fabricInstance.getActiveObject();
        if (activeObject) {
          const center = activeObject.getCenterPoint();
          activeObject.set({
            angle: angle,
            originX: "center",
            originY: "center",
            left: center.x,
            top: center.y,
          });
          activeObject.setCoords();
          fabricInstance.renderAll();
          saveAndUpdateSeed().then(() => {
            api.enqueuePrompt(0, 1);
          });
        }
      },
    });
    rotationPreciseContainer.appendChild(rotationControl.container);
    rotationSlider = rotationControl.slider;
    rotationLabel = rotationControl.label;

    // Add separator before brush controls
    createSeparator(toolbarEl);

    // Create tool mode container (always visible)
    const toolModeContainer = document.createElement("div");
    applyStyles(toolModeContainer, {
      display: "flex",
      flexDirection: "column",
      gap: "2px",
      minWidth: "80px",
    });
    toolbarEl.appendChild(toolModeContainer);

    // Tool mode buttons stacked vertically
    const toolModeGroup = createVerticalButtonGroup(toolModeContainer);

    // Create three mutually exclusive tool mode buttons
    let selectModeBtn, drawModeBtn, eraseModeBtn;

    const updateToolModeButtons = () => {
      const activeMode = tempToolMode || toolMode;
      // Update button styles and text based on active mode
      selectModeBtn.textContent = "Select";
      drawModeBtn.textContent = "Draw";
      eraseModeBtn.textContent = "Erase";

      selectModeBtn.style.backgroundColor =
        activeMode === "select" ? COLOR_BUTTON_ACTIVE : COLOR_BUTTON_BG;
      drawModeBtn.style.backgroundColor =
        activeMode === "draw" ? COLOR_BUTTON_ACTIVE : COLOR_BUTTON_BG;
      eraseModeBtn.style.backgroundColor =
        activeMode === "erase" ? COLOR_BUTTON_ACTIVE : COLOR_BUTTON_BG;
    };

    const setToolMode = (newMode) => {
      if (toolMode === newMode) return;

      const previousMode = toolMode;
      toolMode = newMode;
      tempToolMode = null;

      if (fabricInstance) {
        if (toolMode === "select") {
          // Select mode: enable layer selection, disable drawing
          isDrawingMode = false;
          fabricInstance.isDrawingMode = false;
          cleanupCanvasEraser();

          // Make image layers selectable
          fabricInstance.getObjects().forEach((obj) => {
            if (obj !== foregroundLayer && obj.type === "image") {
              obj.set({ selectable: true, evented: true });
            }
          });

          // Restore previously selected layer if stored
          if (storedSelectedLayerIndex !== null) {
            const layerToSelect = images[storedSelectedLayerIndex];
            if (layerToSelect) {
              fabricInstance.setActiveObject(layerToSelect);
            }
          } else {
            fabricInstance.discardActiveObject();
          }

          // Hide all tool controls and separators
          tools1Container.style.display = "none";
          tools1Separator.style.display = "none";
          tools2Container.style.display = "none";
          tools2Separator.style.display = "none";

          // Update layer highlights
          updateLayerSelectionHighlight();
        } else {
          // Draw or Erase mode
          // Store current selection if coming from select mode
          if (previousMode === "select") {
            const activeObj = fabricInstance.getActiveObject();
            if (
              activeObj &&
              activeObj.type === "image" &&
              activeObj !== foregroundLayer
            ) {
              storedSelectedLayerIndex = images.indexOf(activeObj);
            }
            fabricInstance.discardActiveObject();
          }

          // Make image layers non-selectable
          fabricInstance.getObjects().forEach((obj) => {
            if (obj !== foregroundLayer && obj.type === "image") {
              obj.set({ selectable: false, evented: false });
            }
          });

          // Select foreground layer automatically (but don't show transform controls)
          if (foregroundLayer) {
            fabricInstance.setActiveObject(foregroundLayer);
            fabricInstance.discardActiveObject(); // Don't show transform controls
          }

          // Enable drawing mode
          isDrawingMode = true;

          // Update layer highlights to show FG is active
          updateLayerSelectionHighlight();

          if (toolMode === "draw") {
            // Pencil mode: use Fabric drawing
            cleanupCanvasEraser();
            fabricInstance.isDrawingMode = true;
            if (fabricInstance.freeDrawingBrush) {
              fabricInstance.freeDrawingBrush.color = brushColor;
              fabricInstance.freeDrawingBrush.width = brushWidth;
              fabricInstance.freeDrawingBrush.globalCompositeOperation =
                "source-over";
              // Apply brush shape
              if (brushShape === "square") {
                fabricInstance.freeDrawingBrush.strokeLineCap = "square";
                fabricInstance.freeDrawingBrush.strokeLineJoin = "miter";
              } else {
                fabricInstance.freeDrawingBrush.strokeLineCap = "round";
                fabricInstance.freeDrawingBrush.strokeLineJoin = "round";
              }
            }
          } else {
            // Erase mode: use canvas primitives
            fabricInstance.isDrawingMode = false;
            setupCanvasEraser();
          }

          // Show tools1 and tools2 containers
          tools1Container.style.display = "flex";
          tools1Separator.style.display = "block";
          tools2Container.style.display = "flex";
          tools2Separator.style.display = "block";

          // Show/hide specific controls based on mode
          if (toolMode === "draw") {
            colorPickerGroup.style.display = "flex";
            eraseControlsContainer.style.display = "none";
          } else {
            // Erase mode
            colorPickerGroup.style.display = "none";
            eraseControlsContainer.style.display = "flex";
          }
        }

        updateToolModeButtons();
        fabricInstance.renderAll();
      }
    };

    selectModeBtn = createToolbarButton(
      "Select",
      () => setToolMode("select"),
      toolModeGroup
    );
    selectModeBtn.title =
      "Select and transform images (hold Ctrl to temporarily switch modes)";

    drawModeBtn = createToolbarButton(
      "Draw",
      () => setToolMode("draw"),
      toolModeGroup
    );
    drawModeBtn.title =
      "Draw on foreground layer with brush (hold Ctrl to temporarily erase)";

    eraseModeBtn = createToolbarButton(
      "Erase",
      () => setToolMode("erase"),
      toolModeGroup
    );
    eraseModeBtn.title =
      "Erase from foreground layer (hold Ctrl to temporarily draw)";

    // Make buttons more compact
    applyStyles(selectModeBtn, { minWidth: "50px", padding: "0 6px" });
    applyStyles(drawModeBtn, { minWidth: "50px", padding: "0 6px" });
    applyStyles(eraseModeBtn, { minWidth: "50px", padding: "0 6px" });

    // Override hover behavior to maintain active state
    const setupModeButtonHover = (btn) => {
      btn.onmouseover = () => {
        btn.style.backgroundColor = COLOR_BUTTON_HOVER;
      };
      btn.onmouseout = () => {
        const activeMode = tempToolMode || toolMode;
        const isActive =
          (btn === selectModeBtn && activeMode === "select") ||
          (btn === drawModeBtn && activeMode === "draw") ||
          (btn === eraseModeBtn && activeMode === "erase");
        btn.style.backgroundColor = isActive
          ? COLOR_BUTTON_ACTIVE
          : COLOR_BUTTON_BG;
      };
    };

    setupModeButtonHover(selectModeBtn);
    setupModeButtonHover(drawModeBtn);
    setupModeButtonHover(eraseModeBtn);

    // Initialize button states
    updateToolModeButtons();

    // Add separator before tools1 (hidden in select mode)
    const tools1Separator = createSeparator(toolbarEl);
    tools1Separator.style.display = "none";

    // Create tools1 container (color picker, clear button, width slider)
    const tools1Container = document.createElement("div");
    applyStyles(tools1Container, {
      display: "none",
      flexDirection: "column",
      gap: "2px",
      minWidth: "80px",
    });
    toolbarEl.appendChild(tools1Container);

    // Row 1: Color picker (for draw mode only)
    const colorPickerGroup = createHorizontalButtonGroup(tools1Container);

    // Brush color picker
    const brushColorContainer = document.createElement("div");
    applyStyles(brushColorContainer, {
      display: "flex",
      gap: "3px",
      alignItems: "center",
      height: "24px",
    });
    colorPickerGroup.appendChild(brushColorContainer);

    const brushColorLabel = document.createElement("label");
    brushColorLabel.textContent = "Draw Color:";
    applyStyles(brushColorLabel, {
      color: COLOR_BUTTON_TEXT,
      fontSize: "9px",
      minWidth: "55px",
    });
    brushColorContainer.appendChild(brushColorLabel);

    const brushColorInput = document.createElement("input");
    brushColorInput.type = "color";
    brushColorInput.value = brushColor;
    applyStyles(brushColorInput, {
      width: "30px",
      height: "20px",
      border: "none",
      cursor: "pointer",
    });
    brushColorInput.oninput = (e) => {
      brushColor = e.target.value;
      if (
        toolMode === "draw" &&
        fabricInstance &&
        fabricInstance.freeDrawingBrush
      ) {
        fabricInstance.freeDrawingBrush.color = brushColor;
      }
    };
    brushColorContainer.appendChild(brushColorInput);

    // Row 2: Clear FG button (for erase mode only) - shown above slider
    const eraseControlsContainer = document.createElement("div");
    applyStyles(eraseControlsContainer, {
      display: "none",
      flexDirection: "column",
      gap: "2px",
    });
    tools1Container.appendChild(eraseControlsContainer);

    const clearFgBtn = createToolbarButton(
      "Clear FG",
      async () => {
        if (!fabricInstance) return;

        // Remove all drawing paths
        const pathsToRemove = ArrayUtils.filterByType(
          fabricInstance.getObjects(),
          "path"
        );
        pathsToRemove.forEach((path) => {
          fabricInstance.remove(path);
        });

        // Create a completely empty transparent canvas
        const emptyCanvas = document.createElement("canvas");
        emptyCanvas.width = canvasWidth;
        emptyCanvas.height = canvasHeight;

        // CRITICAL: Update the eraser canvas if it exists (keeps them synchronized)
        if (fabricInstance._eraserCanvas) {
          const eraserCtx = fabricInstance._eraserCanvas.getContext("2d");
          eraserCtx.clearRect(0, 0, canvasWidth, canvasHeight);
        }

        // Update foreground layer with empty canvas element (no need for dataUrl/Image)
        if (foregroundLayer) {
          foregroundLayer.setElement(emptyCanvas);
          fabricInstance.renderAll();
        }

        // Update thumbnail to show empty state
        if (foregroundThumbnail) {
          foregroundThumbnail.style.backgroundImage = "none";
        }

        // Save the cleared state (this will persist the empty canvas)
        await saveForegroundLayer();
        saveAndUpdateSeed();
      },
      eraseControlsContainer
    );
    clearFgBtn.title = "Clear all drawings from the foreground layer";

    // Row 3: Brush width slider (for both draw and erase)
    const brushWidthControl = createControl({
      type: "slider",
      label: "Width",
      min: 1,
      max: 50,
      value: brushWidth,
      unit: "px",
      onChange: (newValue) => {
        brushWidth = newValue;
        if (fabricInstance && fabricInstance.freeDrawingBrush) {
          fabricInstance.freeDrawingBrush.width = brushWidth;
        }
      },
      parent: tools1Container,
    });

    // Add separator before tools2
    const tools2Separator = createSeparator(toolbarEl);
    tools2Separator.style.display = "none";

    // Create tools2 container (brush shape selector - for both draw and erase)
    const tools2Container = document.createElement("div");
    applyStyles(tools2Container, {
      display: "none",
      flexDirection: "column",
      gap: "2px",
      maxWidth: "fit-content",
    });
    toolbarEl.appendChild(tools2Container);

    // Brush shape selector (circle/square) - applies to both draw and erase
    const brushShapeGroup = createVerticalButtonGroup(tools2Container);
    brushShapeGroup.style.maxWidth = "fit-content";

    let circleShapeBtn, squareShapeBtn;

    const updateBrushShapeButtons = () => {
      circleShapeBtn.style.backgroundColor =
        brushShape === "circle" ? COLOR_BUTTON_ACTIVE : COLOR_BUTTON_BG;
      squareShapeBtn.style.backgroundColor =
        brushShape === "square" ? COLOR_BUTTON_ACTIVE : COLOR_BUTTON_BG;
    };

    const setBrushShape = (shape) => {
      brushShape = shape;
      updateBrushShapeButtons();

      // Update Fabric brush if in draw mode
      if (
        toolMode === "draw" &&
        fabricInstance &&
        fabricInstance.freeDrawingBrush
      ) {
        // Fabric.js doesn't have built-in square brush, but we can simulate it
        // by setting the brush to have sharp corners (strokeLineCap)
        if (brushShape === "square") {
          fabricInstance.freeDrawingBrush.strokeLineCap = "square";
          fabricInstance.freeDrawingBrush.strokeLineJoin = "miter";
        } else {
          fabricInstance.freeDrawingBrush.strokeLineCap = "round";
          fabricInstance.freeDrawingBrush.strokeLineJoin = "round";
        }
      }
    };

    circleShapeBtn = createIconButton(
      "●",
      () => setBrushShape("circle"),
      brushShapeGroup
    );
    circleShapeBtn.title = "Round brush shape";

    squareShapeBtn = createIconButton(
      "■",
      () => setBrushShape("square"),
      brushShapeGroup
    );
    squareShapeBtn.title = "Square brush shape";

    // Setup hover behavior for shape buttons
    const setupShapeButtonHover = (btn) => {
      btn.onmouseover = () => {
        btn.style.backgroundColor = COLOR_BUTTON_HOVER;
      };
      btn.onmouseout = () => {
        const isActive =
          (btn === circleShapeBtn && brushShape === "circle") ||
          (btn === squareShapeBtn && brushShape === "square");
        btn.style.backgroundColor = isActive
          ? COLOR_BUTTON_ACTIVE
          : COLOR_BUTTON_BG;
      };
    };

    setupShapeButtonHover(circleShapeBtn);
    setupShapeButtonHover(squareShapeBtn);
    updateBrushShapeButtons();

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

  const createLayerItem = (index) => {
    const {
      layerItem,
      thumbnail,
      maskThumbnail,
      visibilityButton,
      dragHandle,
    } = createLayerUI({
      index,
      type: "image",
      label: `${index + 1}`,
      isDraggable: true,
      onVisibilityToggle: () => toggleImageVisibility(index),
      onMaskToggle: (idx) => toggleMaskEnabled(idx),
      onSelect: () => selectImageByIndex(index),
      onDragStart: (e) => {
        draggedLayerIndex = index;
        dragHandle.style.cursor = "grabbing";
        if (layerItems[index]) {
          layerItems[index].style.opacity = "0.5";
        }
        e.dataTransfer.effectAllowed = "move";
      },
      onDragEnd: (e) => {
        dragHandle.style.cursor = "grab";
        if (layerItems[index]) {
          layerItems[index].style.opacity = "1";
        }
        draggedLayerIndex = null;
      },
      onDragOver: (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (draggedLayerIndex !== null && draggedLayerIndex !== index) {
          layerItem.style.borderColor = COLOR_BUTTON_ACTIVE;
          layerItem.style.borderWidth = "2px";
        }
      },
      onDragLeave: (e) => {
        layerItem.style.borderColor = COLOR_BUTTON_BORDER;
        layerItem.style.borderWidth = "1px";
      },
      onDrop: (e) => {
        e.preventDefault();
        layerItem.style.borderColor = COLOR_BUTTON_BORDER;
        layerItem.style.borderWidth = "1px";
        if (draggedLayerIndex !== null && draggedLayerIndex !== index) {
          swapLayerPositions(draggedLayerIndex, index);
        }
      },
    });

    // Store references in arrays
    layerItems[index] = layerItem;
    layerThumbnails[index] = thumbnail;
    layerMaskThumbnails[index] = maskThumbnail;
    layerVisibilityButtons[index] = visibilityButton;

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

  const createForegroundLayer = () => {
    const { layerItem, thumbnail, visibilityButton } = createLayerUI({
      type: "foreground",
      label: "FG",
      isDraggable: false,
      icon: "✏",
      onVisibilityToggle: () => {
        foregroundIsVisible = !foregroundIsVisible;

        if (foregroundIsVisible) {
          visibilityButton.textContent = "👁";
          visibilityButton.style.backgroundColor = COLOR_BUTTON_BG;
          if (foregroundLayer) {
            foregroundLayer.set({
              visible: true,
              opacity: 1,
              selectable: false,
              evented: false,
            });
          }
        } else {
          visibilityButton.textContent = "👁‍🗨";
          visibilityButton.style.backgroundColor = COLOR_BUTTON_DISABLED;
          if (foregroundLayer) {
            foregroundLayer.set({
              visible: false,
              opacity: 0,
              selectable: false,
              evented: false,
            });
          }

          if (isDrawingMode) {
            isDrawingMode = false;
            fabricInstance.isDrawingMode = false;
            images.forEach((img) => {
              if (img && img.visible !== false) {
                img.set({ selectable: true, evented: true });
              }
            });
            if (foregroundLayerItem) {
              foregroundLayerItem.style.backgroundColor = COLOR_BUTTON_BG;
            }
            thumbnail.style.backgroundColor = COLOR_BUTTON_BG;
          }
        }

        fabricInstance.renderAll();

        if (colorChangeDebounceTimeout) {
          clearTimeout(colorChangeDebounceTimeout);
        }
        colorChangeDebounceTimeout = setTimeout(() => {
          colorChangeDebounceTimeout = null;
          saveAndUpdateSeed();
        }, COLOR_CHANGE_DEBOUNCE_DELAY);
      },
      onSelect: () => {
        if (typeof setToolMode === "function") {
          setToolMode("select");
        }
      },
    });

    foregroundLayerItem = layerItem;
    foregroundThumbnail = thumbnail;
    foregroundVisibilityButton = visibilityButton;

    return layerItem;
  };

  const createBackgroundLayer = () => {
    const { layerItem, thumbnail, visibilityButton, colorInput } =
      createLayerUI({
        type: "background",
        label: "BG",
        isDraggable: false,
        hasColorPicker: true,
        icon: "🖼",
        colorPickerValue: backgroundColor,
        onVisibilityToggle: () => {
          if (backgroundIsVisible) {
            backgroundColorOpaque = backgroundColor;
            backgroundColor = "transparent";
            visibilityButton.textContent = "👁‍🗨";
            visibilityButton.style.backgroundColor = COLOR_BUTTON_DISABLED;
          } else {
            backgroundColor = backgroundColorOpaque;
            visibilityButton.textContent = "👁";
            visibilityButton.style.backgroundColor = COLOR_BUTTON_BG;
          }

          backgroundIsVisible = !backgroundIsVisible;
          thumbnail.style.backgroundColor = backgroundColor;

          if (compositionArea) {
            compositionArea.set({ fill: backgroundColor });
            fabricInstance.renderAll();
          }

          if (colorChangeDebounceTimeout) {
            clearTimeout(colorChangeDebounceTimeout);
          }
          colorChangeDebounceTimeout = setTimeout(() => {
            colorChangeDebounceTimeout = null;
            saveAndUpdateSeed();
          }, COLOR_CHANGE_DEBOUNCE_DELAY);
        },
      });

    // Set up color picker input handler
    colorInput.oninput = (e) => {
      const newColor = e.target.value;
      backgroundColor = newColor;
      thumbnail.style.backgroundColor = newColor;

      if (compositionArea) {
        compositionArea.set({ fill: newColor });
        fabricInstance.renderAll();
      }

      if (colorChangeDebounceTimeout) {
        clearTimeout(colorChangeDebounceTimeout);
      }
      colorChangeDebounceTimeout = setTimeout(() => {
        colorChangeDebounceTimeout = null;
        saveAndUpdateSeed();
      }, COLOR_CHANGE_DEBOUNCE_DELAY);
    };

    backgroundColorInput = colorInput;
    backgroundColorThumbnail = thumbnail;
    backgroundVisibilityButton = visibilityButton;

    return layerItem;
  };

  // Helper function to convert rgba/hex to hex format for color input
  const rgbaToHex = (color) => {
    // If already hex, return as-is
    if (color.startsWith("#")) {
      return color.length === 7 ? color : color.substring(0, 7);
    }

    // If rgba format, extract rgb values
    const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgbaMatch) {
      const r = parseInt(rgbaMatch[1]);
      const g = parseInt(rgbaMatch[2]);
      const b = parseInt(rgbaMatch[3]);
      return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

    // Default to transparent (white)
    return "#ffffff";
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

    // Add foreground drawing layer at the top (fixed)
    const foregroundLayer = createForegroundLayer();
    layersPanelEl.appendChild(foregroundLayer);

    // Create layer items in order based on imagePositions (highest position first)
    const indexPositionPairs = createSortedIndexPositionPairs(
      imagePositions,
      true
    );

    indexPositionPairs.forEach(({ index }) => {
      const layerItem = createLayerItem(index);
      layersPanelEl.appendChild(layerItem);
    });

    // Add background layer at the bottom (fixed)
    const backgroundLayer = createBackgroundLayer();
    layersPanelEl.appendChild(backgroundLayer);

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
    ArrayUtils.forEachIf(
      layerItems,
      (item) => item !== null,
      (item) => (item.style.backgroundColor = COLOR_BUTTON_BG)
    );

    // Clear foreground layer highlight
    if (foregroundLayerItem) {
      foregroundLayerItem.style.backgroundColor = COLOR_BUTTON_BG;
    }

    // In draw/erase mode, highlight foreground layer
    if ((toolMode === "draw" || toolMode === "erase") && foregroundLayerItem) {
      foregroundLayerItem.style.backgroundColor = COLOR_BUTTON_ACTIVE;
      return;
    }

    // In select mode, highlight the selected object
    const activeObject = fabricInstance.getActiveObject();
    if (!activeObject) return;

    // If it's the foreground layer, highlight it
    if (activeObject === foregroundLayer && foregroundLayerItem) {
      foregroundLayerItem.style.backgroundColor = COLOR_BUTTON_ACTIVE;
      return;
    }

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

    // Store references to fixed layers (title, FG, BG)
    const title = layersPanelEl.children[0]; // Title
    const fgLayer = layersPanelEl.children[1]; // Foreground layer (always second)

    // Remove only the image layer items (not title, FG, or BG)
    // Keep removing the 3rd child until we hit the BG layer at the end
    while (layersPanelEl.children.length > 3) {
      // Remove the element after FG layer (index 2)
      layersPanelEl.removeChild(layersPanelEl.children[2]);
    }

    // Store BG layer reference (now it should be the last child)
    const bgLayer = layersPanelEl.lastChild;

    // Re-insert image layer items in the new order (between FG and BG)
    indexPositionPairs.forEach(({ index }) => {
      const layerItem = createLayerItem(index);
      // Insert before BG layer
      layersPanelEl.insertBefore(layerItem, bgLayer);

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

    // Bring FG layer above images but keep it below border
    if (foregroundLayer) {
      fabricInstance.bringToFront(foregroundLayer);
    }

    // Finally bring border to front (above everything)
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
      fill: backgroundColor,
      width: canvasWidth,
      height: canvasHeight,
      selectable: false,
    });
  };

  const createCompositionBorder = () => {
    // a border around (and external to) the composition area
    // The stroke is centered on the rectangle edge, so we need to account for half the stroke width
    // to ensure the inner edge aligns perfectly with the export area

    compositionBorder = new fabric.Rect({
      left:
        canvasPadding + COMPOSITION_BORDER_SIZE - COMPOSITION_BORDER_SIZE / 2,
      top:
        canvasPadding + COMPOSITION_BORDER_SIZE - COMPOSITION_BORDER_SIZE / 2,
      fill: "transparent",
      width: canvasWidth,
      height: canvasHeight,
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
          console.error("Compositor4: save failed", error);
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

    // Initialize foreground drawing layer
    initializeForegroundLayer();

    addCanvasEventListeners();

    // Ensure select mode is active by default
    // This must happen after fabricInstance and all layers are created
    setTimeout(() => {
      if (typeof setToolMode === "function") {
        setToolMode("select");
      }
    }, 100);

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

    // Update background color picker and thumbnail
    if (backgroundColorInput) {
      backgroundColorInput.value = rgbaToHex(backgroundColor);
    }
    if (backgroundColorThumbnail) {
      backgroundColorThumbnail.style.backgroundColor = backgroundColor;
    }

    // Update background visibility button state
    if (backgroundVisibilityButton) {
      backgroundIsVisible = backgroundColor !== "transparent";
      backgroundVisibilityButton.textContent = backgroundIsVisible
        ? "👁"
        : "👁‍🗨";
      backgroundVisibilityButton.style.backgroundColor = backgroundIsVisible
        ? COLOR_BUTTON_BG
        : COLOR_BUTTON_DISABLED;

      // If transparent, store a default opaque color for when user toggles back
      if (
        !backgroundIsVisible &&
        backgroundColorOpaque === COMPOSITION_BACKGROUND_COLOR
      ) {
        backgroundColorOpaque = "#ffffff"; // Default to white if no color was stored
      }
    }

    // Update foreground visibility button state if it exists
    if (foregroundVisibilityButton && foregroundLayer) {
      foregroundVisibilityButton.textContent = foregroundIsVisible
        ? "👁"
        : "👁‍🗨";
      foregroundVisibilityButton.style.backgroundColor = foregroundIsVisible
        ? COLOR_BUTTON_BG
        : COLOR_BUTTON_DISABLED;
    }
  };

  // const restoreImagePositions = () => {
  //   try {
  //     const widgetValue = fabricDataWidget.value;
  //     if (widgetValue && typeof widgetValue === "string") {
  //       const data = deserializeCompositorData(widgetValue);
  //     }
  //   } catch (e) {
  //     console.error("Compositor4: could not restore compositor data", e);
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

    // Get foreground image filename if it exists
    const foregroundImageName = foregroundLayer ? `fg_${node.id}.png` : null;

    return {
      transforms: transforms,
      bboxes: bboxes,
      imageNames: imageNames,
      imagePositions: imagePositions,
      maskStates: maskStates, // V4: Save mask enabled/disabled states
      applyMaskInConfig: applyMaskInConfig, // V4: Save mask application mode
      snapEnabled: snapEnabled,
      gridSize: gridSize,
      width: canvasWidth,
      height: canvasHeight,
      padding: canvasPadding,
      backgroundColor: backgroundColor,
      foregroundImageName: foregroundImageName,
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

      // V4: Restore mask states if available
      if (data.maskStates && Array.isArray(data.maskStates)) {
        maskStates = data.maskStates.slice(); // Copy the array
      }

      // V4: Restore mask application mode if available
      if (data.applyMaskInConfig !== undefined) {
        applyMaskInConfig = data.applyMaskInConfig;
      }

      // Restore background color if available
      if (data.backgroundColor !== undefined) {
        backgroundColor = data.backgroundColor;
      }

      // Restore foreground layer if available
      if (data.foregroundImageName) {
        loadForegroundLayer(data.foregroundImageName);
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
      console.error("Compositor4: could not deserialize compositor data", e);
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

  const loadForegroundLayer = (fgImageName) => {
    if (!fgImageName || !fabricInstance) return;

    // Add timestamp and random param to break browser cache completely
    const cacheBuster = `t=${Date.now()}&r=${Math.random()}`;
    const fgImageUrl = `/view?filename=${encodeURIComponent(
      fgImageName
    )}&type=${saveFolder}&subfolder=compositor&${cacheBuster}`;

    // Load the image with cache-busting
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      // Check if image loaded successfully
      if (img.naturalWidth === 0) {
        return;
      }

      if (foregroundLayer) {
        // Update existing layer (no flash)
        foregroundLayer.setElement(img);
        fabricInstance.renderAll();
      } else {
        // Create new layer
        fabric.Image.fromURL(
          fgImageUrl,
          (fabricImg) => {
            foregroundLayer = fabricImg;
            fabricImg.set({
              left: canvasPadding + COMPOSITION_BORDER_SIZE,
              top: canvasPadding + COMPOSITION_BORDER_SIZE,
              selectable: false,
              evented: false,
              visible: foregroundIsVisible,
              opacity: foregroundIsVisible ? 1 : 0,
              scaleX: 1,
              scaleY: 1,
            });
            fabricInstance.add(fabricImg);
            updateCanvasZOrder();
            fabricInstance.renderAll();
          },
          { crossOrigin: "anonymous" }
        );
      }
    };
    img.src = fgImageUrl;
  };

  const setupCanvasEraser = () => {
    // Use canvas primitives for true pixel erasing with destination-out
    if (!fabricInstance) return;

    // First, flatten the foreground layer if it exists into a temporary offscreen canvas
    let fgCanvas = null;
    if (foregroundLayer) {
      fgCanvas = document.createElement("canvas");
      fgCanvas.width = foregroundLayer.width;
      fgCanvas.height = foregroundLayer.height;
      const fgCtx = fgCanvas.getContext("2d");
      fgCtx.drawImage(foregroundLayer.getElement(), 0, 0);
    } else {
      // Create empty canvas for FG layer
      fgCanvas = document.createElement("canvas");
      fgCanvas.width = canvasWidth;
      fgCanvas.height = canvasHeight;
    }

    const fgCtx = fgCanvas.getContext("2d");
    const previewCtx = fabricInstance.contextTop;

    // Mouse down - start erasing
    const onMouseDown = (opt) => {
      isCanvasDrawing = true;
      const p = fabricInstance.getPointer(opt.e);
      canvasDrawingPath = [p];

      fgCtx.beginPath();
      fgCtx.moveTo(
        p.x - (canvasPadding + COMPOSITION_BORDER_SIZE),
        p.y - (canvasPadding + COMPOSITION_BORDER_SIZE)
      );

      previewCtx.clearRect(0, 0, fabricInstance.width, fabricInstance.height);
    };

    // Mouse move - erase and show preview
    const onMouseMove = (opt) => {
      if (!isCanvasDrawing) return;
      const p = fabricInstance.getPointer(opt.e);
      canvasDrawingPath.push(p);

      // Draw preview
      previewCtx.clearRect(0, 0, fabricInstance.width, fabricInstance.height);
      previewCtx.strokeStyle = "rgba(255, 0, 0, 0.5)";
      previewCtx.lineWidth = brushWidth;
      previewCtx.lineCap = "round";
      previewCtx.lineJoin = "round";
      previewCtx.globalCompositeOperation = "source-over";

      previewCtx.beginPath();
      previewCtx.moveTo(canvasDrawingPath[0].x, canvasDrawingPath[0].y);
      for (let i = 1; i < canvasDrawingPath.length; i++) {
        previewCtx.lineTo(canvasDrawingPath[i].x, canvasDrawingPath[i].y);
      }
      previewCtx.stroke();

      // Actually erase on FG canvas with destination-out
      fgCtx.globalCompositeOperation = "destination-out";
      fgCtx.lineWidth = brushWidth;
      fgCtx.lineCap = "round";
      fgCtx.lineJoin = "round";
      fgCtx.lineTo(
        p.x - (canvasPadding + COMPOSITION_BORDER_SIZE),
        p.y - (canvasPadding + COMPOSITION_BORDER_SIZE)
      );
      fgCtx.stroke();

      // Update foreground layer image with erased version
      if (foregroundLayer) {
        foregroundLayer.setElement(fgCanvas);
        fabricInstance.renderAll();
      }
    };

    // Mouse up - finalize erasing
    const onMouseUp = async () => {
      if (!isCanvasDrawing) return;
      isCanvasDrawing = false;

      // Clear preview
      previewCtx.clearRect(0, 0, fabricInstance.width, fabricInstance.height);

      // Reset composite operation
      fgCtx.globalCompositeOperation = "source-over";

      // Update foreground layer with final erased image
      if (foregroundLayer) {
        foregroundLayer.setElement(fgCanvas);
      } else {
        // Create new foreground layer from erased canvas
        const dataUrl = fgCanvas.toDataURL("image/png");
        fabric.Image.fromURL(dataUrl, (img) => {
          foregroundLayer = img;
          img.set({
            left: canvasPadding + COMPOSITION_BORDER_SIZE,
            top: canvasPadding + COMPOSITION_BORDER_SIZE,
            selectable: false,
            evented: false,
            scaleX: 1,
            scaleY: 1,
          });
          fabricInstance.add(img);
          updateCanvasZOrder();
          fabricInstance.renderAll();
        });
      }

      canvasDrawingPath = [];
      fabricInstance.renderAll();

      // Trigger save
      if (colorChangeDebounceTimeout) {
        clearTimeout(colorChangeDebounceTimeout);
      }
      colorChangeDebounceTimeout = setTimeout(async () => {
        colorChangeDebounceTimeout = null;
        await saveForegroundLayer();
        saveAndUpdateSeed();
      }, COLOR_CHANGE_DEBOUNCE_DELAY);
    };

    // Attach event handlers
    fabricInstance.on("mouse:down", onMouseDown);
    fabricInstance.on("mouse:move", onMouseMove);
    fabricInstance.on("mouse:up", onMouseUp);

    // Store handlers and canvas for cleanup
    fabricInstance._eraserHandlers = { onMouseDown, onMouseMove, onMouseUp };
    fabricInstance._eraserCanvas = fgCanvas;
  };

  const cleanupCanvasEraser = () => {
    if (!fabricInstance || !fabricInstance._eraserHandlers) return;

    const { onMouseDown, onMouseMove, onMouseUp } =
      fabricInstance._eraserHandlers;
    fabricInstance.off("mouse:down", onMouseDown);
    fabricInstance.off("mouse:move", onMouseMove);
    fabricInstance.off("mouse:up", onMouseUp);

    // Clear preview context
    fabricInstance.contextTop.clearRect(
      0,
      0,
      fabricInstance.width,
      fabricInstance.height
    );

    delete fabricInstance._eraserHandlers;
    delete fabricInstance._eraserCanvas;
    isCanvasDrawing = false;
    canvasDrawingPath = [];
  };

  const initializeForegroundLayer = async () => {
    // Try to load existing foreground drawing using simplified filename
    const fgImageName = `fg_${node.id}.png`;
    loadForegroundLayer(fgImageName);

    // Tool mode is initialized to "select" by default in setToolMode function
    // which automatically hides brush controls (tools1Container and tools2Container)
  };

  const saveForegroundLayer = async () => {
    if (!fabricInstance) return;

    // Export only the drawing layer (pencil paths)
    const drawingObjects = ArrayUtils.filterByType(
      fabricInstance.getObjects(),
      "path"
    ).filter((obj) => !obj.isEraserStroke);

    // Check if we have any content (foreground layer or paths)
    if (!foregroundLayer && drawingObjects.length === 0) {
      return;
    }

    // Create a temporary canvas for the drawing layer
    const tempCanvas = new fabric.StaticCanvas(null, {
      width: canvasWidth,
      height: canvasHeight,
    });

    // Load existing foreground layer (already has erasing applied)
    if (foregroundLayer) {
      await new Promise((resolve) => {
        foregroundLayer.clone((clonedBg) => {
          // Position at 0,0 in temp canvas (no padding offset needed)
          clonedBg.set({
            left: 0,
            top: 0,
            scaleX: 1,
            scaleY: 1,
          });
          tempCanvas.add(clonedBg);
          resolve();
        });
      });
    }

    // Clone and add pencil paths to temp canvas
    if (drawingObjects.length > 0) {
      const clonePromises = drawingObjects.map((path) => {
        return new Promise((resolve) => {
          path.clone((cloned) => {
            // Adjust position: subtract padding and border offset
            cloned.set({
              left: cloned.left - (canvasPadding + COMPOSITION_BORDER_SIZE),
              top: cloned.top - (canvasPadding + COMPOSITION_BORDER_SIZE),
            });
            tempCanvas.add(cloned);
            resolve();
          });
        });
      });
      await Promise.all(clonePromises);
    }

    tempCanvas.renderAll();

    // Export as data URL
    const dataUrl = tempCanvas.toDataURL({
      format: "png",
      quality: 1,
    });

    // Upload the foreground layer with simplified filename
    const fgImageName = `fg_${node.id}.png`;
    const blob = dataURLToBlob(dataUrl);
    const file = new File([blob], fgImageName);
    const body = new FormData();

    body.append("image", file);
    body.append("subfolder", STORE_FOLDER);
    body.append("type", saveFolder);
    body.append("overwrite", "true");

    await api.fetchApi(UPLOAD_ENDPOINT, {
      method: "POST",
      body,
    });

    // Remove all drawing paths from canvas
    drawingObjects.forEach((path) => {
      fabricInstance.remove(path);
    });

    // CRITICAL: Immediately update foreground layer with the new dataUrl
    // This ensures the in-memory state matches what was saved to disk
    // and breaks browser cache on the blob URL
    if (foregroundLayer) {
      // Create new image from dataUrl and update existing layer
      const img = new Image();
      img.onload = () => {
        foregroundLayer.setElement(img);
        fabricInstance.renderAll();

        // Update thumbnail after layer is updated
        if (foregroundThumbnail) {
          foregroundThumbnail.style.backgroundImage = `url(${dataUrl})`;
        }
      };
      img.src = dataUrl;
    } else {
      // Create new foreground layer if it doesn't exist
      fabric.Image.fromURL(dataUrl, (img) => {
        foregroundLayer = img;
        img.set({
          left: canvasPadding + COMPOSITION_BORDER_SIZE,
          top: canvasPadding + COMPOSITION_BORDER_SIZE,
          selectable: false,
          evented: false,
          visible: foregroundIsVisible,
          opacity: foregroundIsVisible ? 1 : 0,
          scaleX: 1,
          scaleY: 1,
        });
        fabricInstance.add(img);
        updateCanvasZOrder();
        fabricInstance.renderAll();

        // Update thumbnail after layer is created
        if (foregroundThumbnail) {
          foregroundThumbnail.style.backgroundImage = `url(${dataUrl})`;
        }
      });
    }
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

    // Sync mask during transform (moving, scaling, rotating)
    fabricInstance.on("object:moving", function (opt) {
      if (!applyMaskInConfig && opt.target) {
        const imgIndex = images.indexOf(opt.target);
        if (imgIndex !== -1 && maskImages[imgIndex] && maskStates[imgIndex]) {
          syncMaskWithImage(imgIndex);
        }
      }
    });

    fabricInstance.on("object:scaling", function (opt) {
      if (!applyMaskInConfig && opt.target) {
        const imgIndex = images.indexOf(opt.target);
        if (imgIndex !== -1 && maskImages[imgIndex] && maskStates[imgIndex]) {
          syncMaskWithImage(imgIndex);
        }
      }
    });

    fabricInstance.on("object:rotating", function (opt) {
      if (!applyMaskInConfig && opt.target) {
        const imgIndex = images.indexOf(opt.target);
        if (imgIndex !== -1 && maskImages[imgIndex] && maskStates[imgIndex]) {
          syncMaskWithImage(imgIndex);
        }
      }
    });

    // Save after object is modified
    fabricInstance.on("object:modified", function (opt) {
      updateSizeInputs();

      // Sync mask transforms in frontend clipPath mode
      if (!applyMaskInConfig && opt.target) {
        const imgIndex = images.indexOf(opt.target);
        if (imgIndex !== -1 && maskImages[imgIndex] && maskStates[imgIndex]) {
          syncMaskWithImage(imgIndex);
        }
      }

      saveAndUpdateSeed();
    });

    // Save when user draws on foreground layer
    fabricInstance.on("path:created", function (opt) {
      // Tag the path with current brush mode for processing during save
      if (opt.path) {
        const activeMode = tempToolMode || toolMode;
        opt.path.set({
          selectable: false,
          evented: false,
          isEraserStroke: activeMode === "erase",
        });
      }

      // Debounce the save
      if (colorChangeDebounceTimeout) {
        clearTimeout(colorChangeDebounceTimeout);
      }
      colorChangeDebounceTimeout = setTimeout(async () => {
        colorChangeDebounceTimeout = null;
        await saveForegroundLayer();
        saveAndUpdateSeed();
      }, COLOR_CHANGE_DEBOUNCE_DELAY);
    });

    // Add keyboard navigation for selected objects
    keyboardHandler = handleKeyboardNavigation;
    document.addEventListener("keydown", keyboardHandler);

    // Add Ctrl key handler for temporary mode switching
    const handleCtrlKeyDown = (e) => {
      if (e.key === "Control" && !isCtrlPressed) {
        isCtrlPressed = true;
        // Only switch if we're in draw or erase mode
        if (toolMode === "draw" || toolMode === "erase") {
          tempToolMode = toolMode === "draw" ? "erase" : "draw";

          if (fabricInstance) {
            if (tempToolMode === "draw") {
              // Temporarily switch to pencil
              cleanupCanvasEraser();
              fabricInstance.isDrawingMode = true;
              if (fabricInstance.freeDrawingBrush) {
                fabricInstance.freeDrawingBrush.color = brushColor;
                fabricInstance.freeDrawingBrush.width = brushWidth;
                fabricInstance.freeDrawingBrush.globalCompositeOperation =
                  "source-over";
                // Apply brush shape
                if (brushShape === "square") {
                  fabricInstance.freeDrawingBrush.strokeLineCap = "square";
                  fabricInstance.freeDrawingBrush.strokeLineJoin = "miter";
                } else {
                  fabricInstance.freeDrawingBrush.strokeLineCap = "round";
                  fabricInstance.freeDrawingBrush.strokeLineJoin = "round";
                }
              }
            } else {
              // Temporarily switch to eraser
              fabricInstance.isDrawingMode = false;
              setupCanvasEraser();
            }
          }
        }
      }
    };

    const handleCtrlKeyUp = (e) => {
      if (e.key === "Control" && isCtrlPressed) {
        isCtrlPressed = false;
        if (tempToolMode) {
          // Restore original mode
          tempToolMode = null;

          if (fabricInstance) {
            if (toolMode === "draw") {
              // Restore pencil mode
              cleanupCanvasEraser();
              fabricInstance.isDrawingMode = true;
              if (fabricInstance.freeDrawingBrush) {
                fabricInstance.freeDrawingBrush.color = brushColor;
                fabricInstance.freeDrawingBrush.width = brushWidth;
                fabricInstance.freeDrawingBrush.globalCompositeOperation =
                  "source-over";
                // Apply brush shape
                if (brushShape === "square") {
                  fabricInstance.freeDrawingBrush.strokeLineCap = "square";
                  fabricInstance.freeDrawingBrush.strokeLineJoin = "miter";
                } else {
                  fabricInstance.freeDrawingBrush.strokeLineCap = "round";
                  fabricInstance.freeDrawingBrush.strokeLineJoin = "round";
                }
              }
            } else {
              // Restore eraser mode
              fabricInstance.isDrawingMode = false;
              setupCanvasEraser();
            }
          }
        }
      }
    };

    document.addEventListener("keydown", handleCtrlKeyDown);
    document.addEventListener("keyup", handleCtrlKeyUp);
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

    // Cancel any pending color change debounced saves
    if (colorChangeDebounceTimeout) {
      clearTimeout(colorChangeDebounceTimeout);
      colorChangeDebounceTimeout = null;
    }
  };

  const updateSeedValue = (signature = false) => {
    // Store custom compositor data with a random seed to trigger update
    const compositorData = serializeCompositorData();
    const seedValue = signature != false ? signature : Math.random();
    compositorData.seed = seedValue; // Add seed to trigger change detection
    fabricDataWidget.value = JSON.stringify(compositorData);

    // Update the seed widget to trigger node re-execution
    if (seedWidget) {
      seedWidget.value = seedValue;
    }
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

  const stretchHorizontally = () => {
    TransformationEngine.stretch(
      fabricInstance,
      "horizontal",
      canvasWidth,
      saveAndUpdateSeed
    );
  };

  const stretchVertically = () => {
    TransformationEngine.stretch(
      fabricInstance,
      "vertical",
      canvasHeight,
      saveAndUpdateSeed
    );
  };

  const equalizeHeight = () => {
    TransformationEngine.equalize(
      fabricInstance,
      "vertical",
      isImageObject,
      saveAndUpdateSeed
    );
  };

  const equalizeWidth = () => {
    TransformationEngine.equalize(
      fabricInstance,
      "horizontal",
      isImageObject,
      saveAndUpdateSeed
    );
  };

  const distributeVertically = () => {
    TransformationEngine.distribute(
      fabricInstance,
      "vertical",
      isImageObject,
      snapToGrid,
      saveAndUpdateSeed
    );
  };

  const distributeHorizontally = () => {
    TransformationEngine.distribute(
      fabricInstance,
      "horizontal",
      isImageObject,
      snapToGrid,
      saveAndUpdateSeed
    );
  };

  const flipHorizontally = () => {
    TransformationEngine.flip(fabricInstance, "horizontal", saveAndUpdateSeed);
  };

  const flipVertically = () => {
    TransformationEngine.flip(fabricInstance, "vertical", saveAndUpdateSeed);
  };

  const setSaveFolder = (folder) => {
    saveFolder = folder;
  };

  const loadMasks = async (maskFilenames) => {
    // Load mask filenames and update layer panel previews
    for (
      let index = 0;
      index < maskFilenames.length && index < IMAGE_COUNT;
      index++
    ) {
      const maskName = maskFilenames[index];
      maskNames[index] = maskName;

      // If in frontend clipPath mode and mask exists, load it as Fabric image
      if (!applyMaskInConfig && maskName && images[index]) {
        try {
          await loadMaskAsClipPath(index);

          // Apply clipPath if mask is enabled
          if (maskStates[index]) {
            images[index].set({ clipPath: maskImages[index] });
            syncMaskWithImage(index);
          }
        } catch (error) {
          console.error(`[Compositor4] Failed to load mask ${index}:`, error);
        }
      }

      updateMaskThumbnail(index);
    }

    if (fabricInstance) {
      fabricInstance.renderAll();
    }
  };

  const updateMaskThumbnail = (index) => {
    const maskThumbnail = layerMaskThumbnails[index];
    if (!maskThumbnail) return;

    if (maskNames[index]) {
      // Load mask image preview
      const maskUrl = `/view?filename=${encodeURIComponent(
        maskNames[index]
      )}&subfolder=${STORE_FOLDER}&type=${saveFolder}`;
      maskThumbnail.style.backgroundImage = `url(${maskUrl})`;
      maskThumbnail.textContent = ""; // Clear the "M" placeholder

      // Update visual state based on mask enabled/disabled and mode
      if (!applyMaskInConfig) {
        // Frontend clipPath mode - show enabled/disabled state via opacity only
        maskThumbnail.style.cursor = "pointer";
        maskThumbnail.style.opacity = maskStates[index] ? "1" : "0.5";
      } else {
        // Config mode - masks already applied, non-interactive
        maskThumbnail.style.cursor = "default";
        maskThumbnail.style.opacity = "1";
      }
    } else {
      // No mask - show same background color as preview (no M letter)
      maskThumbnail.style.backgroundImage = "none";
      maskThumbnail.textContent = "";
      maskThumbnail.style.cursor = "default";
      maskThumbnail.style.opacity = "1";
    }
  };

  const setApplyMaskInConfig = (value) => {
    applyMaskInConfig = value;
    console.log(`[Compositor4] applyMaskInConfig set to: ${applyMaskInConfig}`);

    // Update all mask thumbnails to reflect the mode
    for (let i = 0; i < IMAGE_COUNT; i++) {
      updateMaskThumbnail(i);
    }
  };

  const toggleMaskEnabled = async (index) => {
    // Only allow toggling when in frontend clipPath mode
    if (applyMaskInConfig) {
      console.log(
        "[Compositor4] Mask toggling only available in frontend clipPath mode"
      );
      return;
    }

    if (!maskNames[index]) {
      console.log(`[Compositor4] No mask for layer ${index + 1}`);
      return;
    }

    // Toggle the mask state
    maskStates[index] = !maskStates[index];
    console.log(
      `[Compositor4] Toggled mask for layer ${index + 1}: ${maskStates[index]}`
    );

    // Apply or remove clipPath from the image
    const img = images[index];
    if (img && maskImages[index]) {
      if (maskStates[index]) {
        // Enable mask - apply clipPath
        img.set({ clipPath: maskImages[index] });
      } else {
        // Disable mask - remove clipPath
        img.set({ clipPath: null });
      }
      img.setCoords();
      fabricInstance.renderAll();
    }

    // Update thumbnail visual state
    updateMaskThumbnail(index);

    // Save the state
    await saveAndUpdateSeed();
  };

  const loadMaskAsClipPath = async (index) => {
    // Load mask image from disk and create Fabric image for clipPath
    if (!maskNames[index]) return;

    const maskUrl = `/view?filename=${encodeURIComponent(
      maskNames[index]
    )}&subfolder=${STORE_FOLDER}&type=${saveFolder}`;

    return new Promise((resolve, reject) => {
      fabric.Image.fromURL(
        maskUrl,
        (maskImg) => {
          if (!maskImg) {
            console.error(
              `[Compositor4] Failed to load mask for layer ${index + 1}`
            );
            reject(new Error("Mask load failed"));
            return;
          }

          // Configure mask image
          maskImg.set({
            originX: "left",
            originY: "top",
            absolutePositioned: true, // Keep mask in absolute coordinates
            inverted: true, // White = visible, black = hidden
          });

          // Store mask image reference
          maskImages[index] = maskImg;
          console.log(`[Compositor4] Loaded mask for layer ${index + 1}`);

          resolve(maskImg);
        },
        { crossOrigin: "anonymous" }
      );
    });
  };

  const syncMaskWithImage = (index) => {
    // Sync mask transform with image transform for clipPath
    const img = images[index];
    const mask = maskImages[index];

    if (!img || !mask) return;

    // Copy transforms from image to mask
    mask.set({
      left: img.left,
      top: img.top,
      scaleX: img.scaleX,
      scaleY: img.scaleY,
      angle: img.angle,
      flipX: img.flipX,
      flipY: img.flipY,
    });

    mask.setCoords();
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

          // Update composition area (including restored background color)
          compositionArea.set({
            left: canvasPadding + COMPOSITION_BORDER_SIZE,
            top: canvasPadding + COMPOSITION_BORDER_SIZE,
            width: canvasWidth,
            height: canvasHeight,
            fill: backgroundColor,
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

        // Ensure all images are selectable after restoration (select mode is default)
        setTimeout(() => {
          if (fabricInstance) {
            fabricInstance.getObjects().forEach((obj) => {
              if (obj !== foregroundLayer && obj.type === "image") {
                obj.set({ selectable: true, evented: true });
              }
            });
            // Ensure tool mode buttons reflect correct state
            if (typeof updateToolModeButtons === "function") {
              updateToolModeButtons();
            }
            // Update layer highlights
            if (typeof updateLayerSelectionHighlight === "function") {
              updateLayerSelectionHighlight();
            }
            fabricInstance.renderAll();
          }
        }, 150);

        return true;
      }
    } catch (e) {
      console.error("Compositor4 Editor: could not restore state", e);
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
    setApplyMaskInConfig,
    loadMasks,
    restoreState,
    cleanup,
    queuedSave, // Expose for configuration change handling
    saveAndUpdateSeed,
    updateSeedValue, // Expose for auto-save with configSignature
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
    console.error("Compositor4: Failed to interrupt workflow", error);
    throw error;
  }
}
