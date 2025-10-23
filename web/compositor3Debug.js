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
const SNAP_ENABLED = true; // toggle snap to grid on/off
// wether to overwrite existing images on upload
const OVERWRITE = true;

app.registerExtension({
  name: "Comfy.Compositor3Debug",

  async setup(app) {
    console.log("Compositor3Debug: extension setup");

    api.addEventListener("compositor_init", executedMessageHandler);
  },

  //   async beforeRegisterNodeDef(nodeType, nodeData) {
  //     if (nodeData?.name === COMPOSITOR_3_DEBUG) {
  //       console.log(
  //         "Compositor3Debug: before register node def",
  //         nodeType,
  //         nodeData
  //       );
  //     }
  //   },
  async nodeCreated(node) {
    // debugWidgetValues(node);
  },

  // at this point the graph is fully loaded and the nodes are created and the values in widget can be retrieved
  async afterConfigureGraph(args) {
    console.log("Compositor3Debug: after configure graph", args);

    const nodes = app.graph.findNodesByType(COMPOSITOR_3_DEBUG);

    // nodes.forEach(debugWidgetValues);
    nodes.forEach(initializeCustomCanvasWidget);
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
    // attempt at hiding widgets, does not work as expected
    hideWidgets(node, ["imageName", "fabricData"]);

    const editor = Editor(node, fabric);
    editor.initialize();

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

    // w, h
    // node.setSize([
    //   COMPOSITION_BORDER_SIZE * 2 + WIDTH + LITEGRAPH_NODE_PADDING * 2,
    //   1024,
    // ]);

    node.setSize(editor.calculateNodeSize());

    editorWidget.get;
    node.resizable = false;
    node.setDirtyCanvas(true, true);
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
    const e = event.detail.output;
    const editor = node.editor;
    console.log("Compositor3Debug: received compositor_init", e, nodeId, a, b);
    console.log(
      "Compositor3Debug: initializing custom canvas widget",
      node,
      node.editor,
      node.editorWidget
    );

    // e.names -> array of base64 images
    e.names.map((name, index) => editor.appendImage(name, index));
  }
}

const getNodeById = (nodeId) => {
  return app.graph.getNodeById(nodeId);
};

// Utility function to create styled toolbar buttons
const createToolbarButton = (text, onClick) => {
  const button = document.createElement("button");
  button.textContent = text;
  button.style.padding = "4px 12px";
  button.style.backgroundColor = "rgba(70, 70, 70, 0.9)";
  button.style.color = "white";
  button.style.border = "1px solid rgba(100, 100, 100, 0.5)";
  button.style.borderRadius = "4px";
  button.style.cursor = "pointer";
  button.style.fontSize = "12px";

  button.onmouseover = () => {
    button.style.backgroundColor = "rgba(90, 90, 90, 0.9)";
  };

  button.onmouseout = () => {
    button.style.backgroundColor = "rgba(70, 70, 70, 0.9)";
  };

  button.onclick = onClick;

  return button;
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
  let savingIndicator = null;
  let toolbarEl = null;
  let snapEnabled = SNAP_ENABLED; // Editor property for snap to grid
  let images = [null, null, null, null, null, null, null, null, null];

  const imageNameWidget = getImageNameWidget(node);
  const fabricDataWidget = getFabricDataWidget(node);

  const createContainer = () => {
    containerEl = document.createElement("div");
    containerEl.style.backgroundColor = "rgba(172, 95, 224, 0)";
    containerEl.style.textAlign = "center";
    containerEl.style.width =
      WIDTH + PADDING * 2 + COMPOSITION_BORDER_SIZE * 2 + "px";
    containerEl.style.height =
      HEIGHT + PADDING * 2 + COMPOSITION_BORDER_SIZE * 2 + "px";
    containerEl.style.margin = "0px";
    containerEl.style.overflow = "hidden";
    return containerEl;
  };

  const createToolbar = () => {
    toolbarEl = document.createElement("div");
    toolbarEl.style.width = "100%";
    toolbarEl.style.minHeight = "auto";
    toolbarEl.style.backgroundColor = "rgba(50, 50, 50, 0.9)";
    toolbarEl.style.display = "flex";
    toolbarEl.style.alignItems = "center";
    toolbarEl.style.padding = "5px 10px";
    toolbarEl.style.boxSizing = "border-box";
    toolbarEl.style.gap = "5px";
    toolbarEl.style.position = "relative";
    containerEl.appendChild(toolbarEl);

    // Create and append Save button
    const saveBtn = createToolbarButton("Save", (event) =>
      updateWidgetValues(event, node)
    );
    toolbarEl.appendChild(saveBtn);

    // Create and append Reset button
    const resetBtn = createToolbarButton("Reset", (event) =>
      resetImagePositions(event, node)
    );
    toolbarEl.appendChild(resetBtn);

    // Create and append Snap button with special toggle behavior
    const snapBtn = createToolbarButton(
      snapEnabled ? "Snap: ON" : "Snap: OFF",
      () => {
        snapEnabled = !snapEnabled;
        snapBtn.textContent = snapEnabled ? "Snap: ON" : "Snap: OFF";
        snapBtn.style.backgroundColor = snapEnabled
          ? "rgba(70, 70, 70, 0.9)"
          : "rgba(100, 100, 100, 0.7)";
        console.log("Snap to grid:", snapEnabled);
      }
    );

    // Override default styling for snap button based on initial state
    snapBtn.style.backgroundColor = snapEnabled
      ? "rgba(70, 70, 70, 0.9)"
      : "rgba(100, 100, 100, 0.7)";

    // Override hover behavior for snap button
    snapBtn.onmouseover = () => {
      if (snapEnabled) {
        snapBtn.style.backgroundColor = "rgba(90, 90, 90, 0.9)";
      }
    };

    snapBtn.onmouseout = () => {
      snapBtn.style.backgroundColor = snapEnabled
        ? "rgba(70, 70, 70, 0.9)"
        : "rgba(100, 100, 100, 0.7)";
    };

    toolbarEl.appendChild(snapBtn);

    // Add spacing separator
    const separator = document.createElement("div");
    separator.style.width = "1px";
    separator.style.height = "20px";
    separator.style.backgroundColor = "rgba(100, 100, 100, 0.5)";
    separator.style.margin = "0 5px";
    toolbarEl.appendChild(separator);

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
    alignmentGrid.style.width = "72px";

    alignments.forEach(({ label, align, title }) => {
      const btn = createToolbarButton(label, () => alignSelected(align));
      btn.style.padding = "2px 4px";
      btn.style.fontSize = "14px";
      btn.style.minWidth = "22px";
      btn.title = title;
      alignmentGrid.appendChild(btn);
    });

    toolbarEl.appendChild(alignmentGrid);

    // Add spacer to push saving indicator to the right
    const spacer = document.createElement("div");
    spacer.style.flex = "1";
    toolbarEl.appendChild(spacer);

    // Create HTML saving indicator
    savingIndicator = document.createElement("div");
    savingIndicator.style.width = INDICATOR_RADIUS * 2 + "px";
    savingIndicator.style.height = INDICATOR_RADIUS * 2 + "px";
    savingIndicator.style.borderRadius = "50%";
    savingIndicator.style.backgroundColor = "red";
    savingIndicator.style.display = "none";
    savingIndicator.style.animation = "pulse 1s infinite";
    toolbarEl.appendChild(savingIndicator);

    // Add CSS animation for pulsing effect
    if (!document.getElementById("saving-indicator-style")) {
      const style = document.createElement("style");
      style.id = "saving-indicator-style";
      style.textContent = `
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `;
      document.head.appendChild(style);
    }
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
      backgroundColor: "transparent",
      selectionColor: "transparent",
      selectionLineWidth: 1,
      preserveObjectStacking: true,
      altSelectionKey: "ctrlKey",
      altActionKey: "ctrlKey",
      centeredKey: "altKey",
    });
  };

  const createCompositionArea = () => {
    // a rectangle represengint the composition area
    //p, w, h, node
    compositionArea = new fabric.Rect({
      left: PADDING + COMPOSITION_BORDER_SIZE,
      top: PADDING + COMPOSITION_BORDER_SIZE,
      fill: COMPOSITION_BACKGROUND_COLOR,
      width: WIDTH,
      height: HEIGHT,
      selectable: false,
    });
  };

  const createCompositionBorder = () => {
    // a border around (and external to) the composition area
    // p, w, h, node

    compositionBorder = new fabric.Rect({
      left: PADDING - COMPOSITION_BORDER_SIZE,
      top: PADDING - COMPOSITION_BORDER_SIZE,
      fill: "transparent",
      width: WIDTH + COMPOSITION_BORDER_SIZE * 2,
      height: HEIGHT + COMPOSITION_BORDER_SIZE * 2,
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

  const appendCanvasToContainer = () => {
    containerEl.appendChild(canvasEl);
  };

  const buildImageName = (graphId, nodeId, format, isTemp) => {
    return `${graphId}_${nodeId}.${format}${isTemp ? " [temp]" : ""}`;
  };

  const updateWidgetValues = (event, node) => {
    const imageName = buildImageName(app.graph.id, node.id, "png", false);
    imageNameWidget.value = imageName;
    fabricDataWidget.value = JSON.stringify(fabricInstance);

    const dataUrl = grabSnapshot();
    uploadSnapshot(dataUrl, imageNameWidget.value, true);

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
    createContainer();
    createToolbar();
    createCanvasElement();
    appendCanvasToContainer();
    initializeFabricCanvas();

    setCanvasSize(WIDTH, HEIGHT, PADDING, COMPOSITION_BORDER_SIZE);

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

  const getContainer = () => {
    return containerEl;
  };

  const grabSnapshot = () => {
    const data = fabricInstance.toDataURL({
      format: "png",
      quality: QUALITY,
      left: PADDING + COMPOSITION_BORDER_SIZE,
      top: PADDING + COMPOSITION_BORDER_SIZE,
      width: WIDTH,
      height: HEIGHT,
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
    body.append("type", "temp");
    body.append("overwrite", OVERWRITE);

    const result = await api.fetchApi(UPLOAD_ENDPOINT, {
      method: "POST",
      body,
    });
  };

  const calculateNodeSize = () => {
    const ch = fabricInstance.getHeight();
    const cw = fabricInstance.getWidth();
    return [cw + 21, ch + 111];
  };

  const fromUrlCallback = (img, index) => {
    // callback when loading image from url, appends to fabric canvas
    img.set({
      left: PADDING + COMPOSITION_BORDER_SIZE,
      top: PADDING + COMPOSITION_BORDER_SIZE,
      selectable: true,
      evented: true,
    });

    let currentTransform = null;
    if (hasImageAtIndex(index)) {
      currentTransform = getCurrentTransforms(index);
      console.log("Compositor3Debug: currentTransform", currentTransform);
    }

    fabricInstance.remove(getImageAtIndex(index));

    if (currentTransform) {
      img.set(currentTransform);
    }

    setImageAtIndex(index, img);

    fabricInstance.add(img);

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

  const appendImage = (b64, index) => {
    fabric.Image.fromURL(b64, (img) => fromUrlCallback(img, index));
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

  const resetTransforms = (index) => {
    images[index].left = PADDING + COMPOSITION_BORDER_SIZE;
    images[index].top = PADDING + COMPOSITION_BORDER_SIZE;
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
        target.set({
          left: snapToGrid(target.left),
          top: snapToGrid(target.top),
        });
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

  const showSavingIndicator = () => {
    if (savingIndicator) {
      savingIndicator.style.display = "block";
    }
  };

  const hideSavingIndicator = () => {
    if (savingIndicator) {
      savingIndicator.style.display = "none";
    }
  };

  const updateSeedValue = () => {
    fabricDataWidget.value = Math.random();
  };

  const snapToGrid = (value) => {
    return Math.round(value / GRID_SIZE) * GRID_SIZE;
  };

  const alignSelected = (alignment) => {
    const activeObject = fabricInstance.getActiveObject();
    if (!activeObject) {
      console.log("No object selected for alignment");
      return;
    }

    const objBounds = activeObject.getBoundingRect();
    const compLeft = PADDING + COMPOSITION_BORDER_SIZE;
    const compTop = PADDING + COMPOSITION_BORDER_SIZE;
    const compRight = compLeft + WIDTH;
    const compBottom = compTop + HEIGHT;
    const compCenterX = compLeft + WIDTH / 2;
    const compCenterY = compTop + HEIGHT / 2;

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

  // public interface of the Editor
  return {
    initialize,
    getContainer,
    calculateNodeSize,
    appendImage,
  };
};
