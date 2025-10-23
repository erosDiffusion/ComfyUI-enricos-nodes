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
const TOOLBAR_HEIGHT = 30;
const INDICATOR_RADIUS = 8;
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
      top: PADDING + COMPOSITION_BORDER_SIZE + TOOLBAR_HEIGHT,
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
      top: PADDING - COMPOSITION_BORDER_SIZE + TOOLBAR_HEIGHT,
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

  const setCanvasSize = (width, height, padding, borderSize, toolbarHeight) => {
    fabricInstance.setWidth(width + padding * 2 + borderSize * 2);
    fabricInstance.setHeight(
      toolbarHeight + height + padding * 2 + borderSize * 2
    );
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
    createCanvasElement();
    appendCanvasToContainer();
    initializeFabricCanvas();

    setCanvasSize(
      WIDTH,
      HEIGHT,
      PADDING,
      COMPOSITION_BORDER_SIZE,
      TOOLBAR_HEIGHT
    );

    createCompositionArea();
    fabricInstance.add(compositionArea);
    fabricInstance.sendToBack(compositionArea);

    createCompositionBorder();
    fabricInstance.add(compositionBorder);
    fabricInstance.bringToFront(compositionBorder);

    const saveButton = createButton(
      0,
      0,
      60,
      25,
      (event) => updateWidgetValues(event, node),
      "Save"
    );

    const resetButton = createButton(
      65,
      0,
      60,
      25,
      (event) => resetImagePositions(event, node),
      "Reset"
    );

    createSavingIndicator();

    fabricInstance.add(resetButton);
    fabricInstance.add(saveButton);

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
      top: PADDING + TOOLBAR_HEIGHT + COMPOSITION_BORDER_SIZE,
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
      top: PADDING + COMPOSITION_BORDER_SIZE + TOOLBAR_HEIGHT,
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
    images[index].top = PADDING + COMPOSITION_BORDER_SIZE + TOOLBAR_HEIGHT;
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

  const createButton = (left, top, width, height, onClick, label) => {
    // Create button background
    const buttonRect = new fabric.Rect({
      left: left,
      top: top,
      fill: "rgba(80, 31, 93, 0.9)",
      width: width,
      height: height,
      rx: 6, // rounded corners
      ry: 6,
      selectable: false,
      evented: true,
      hoverCursor: "pointer",
    });

    // Create button text
    const buttonText = new fabric.Text(label, {
      left: left + width / 2,
      top: top + height / 2,
      fill: "white",
      fontSize: 14,
      fontFamily: "Arial",
      originX: "center",
      originY: "center",
      selectable: false,
      evented: false,
      //fontWeight: "bold",
    });

    // Group button elements together
    const button = new fabric.Group([buttonRect, buttonText], {
      left: left,
      top: top,
      selectable: false,
      evented: true,
      hoverCursor: "pointer",
    });

    // Add click handler
    button.on("mouseup", (event) => {
      if (onClick) {
        onClick(event);
      }
    });

    return button;
  };

  const addCanvasEventListeners = () => {
    //this.fcanvas.on("object:modified", async function (opt) {

    fabricInstance.on("object:modified", function (opt) {
      console.log("compositor3Debug: async object modified event");
      // showSavingIndicator();
      const dataUrl = grabSnapshot();
      // await uploadSnapshot(dataURLToBlob, imageNameWidget.value);
      showSavingIndicator();
      uploadSnapshot(dataUrl, imageNameWidget.value).then(() => {
        hideSavingIndicator();
        updateSeedValue();
      });
      // hideSavingIndicator();
    });
  };

  const createSavingIndicator = () => {
    // the saving indicator is a pulsating red circle
    savingIndicator = new fabric.Circle({
      left: WIDTH + PADDING - 2 * INDICATOR_RADIUS,
      top: 0,
      radius: INDICATOR_RADIUS,
      fill: "red",
      selectable: false,
      evented: false,
    });
  };

  const showSavingIndicator = () => {
    // make the indicator visibile and start the pulsating effect, make sure it can be stopped later
    fabricInstance.add(savingIndicator);
    fabricInstance.renderAll();
  };

  const hideSavingIndicator = () => {
    // hide the saving indicator and stop the pulsating effect
    if (savingIndicator) {
      fabricInstance.remove(savingIndicator);
      fabricInstance.renderAll();
    }
  };

  const updateSeedValue = () => {
    fabricDataWidget.value = Math.random();
  };

  const toggleSnapToGrid = (enable, gridSize) => {

  // public interface of the Editor
  return {
    initialize,
    getContainer,
    calculateNodeSize,
    appendImage,
  };
};
