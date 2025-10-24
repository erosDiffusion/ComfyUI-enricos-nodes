import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { fabric } from "./fabric.js";

function isCompositor3(node) {
  return node.constructor.comfyClass == "Compositor3";
}

function getCompositorWidget(node, widgetName) {
  return node.widgets.find((w) => {
    //console.log("checking widget", w.name, widgetName, node.widgetValues);
    return w.name === widgetName;
  });
}

function handleTogglePreciseSelection(e, currentNode) {
  const optionValue = e.data.value;
  currentNode.compositorInstance.preciseSelection = optionValue;
  const c = currentNode.compositorInstance.fcanvas;
  c.getObjects().map(function (i) {
    return i.set("perPixelTargetFind", optionValue);
  });
}

function handleResetOldTransform(e, currentNode) {
  const optionValue = e.data.value;
  const instance = currentNode.compositorInstance;

  const c = instance.fcanvas;
  c.getObjects().forEach(function (image, index) {
    instance.resetOldTransform(index);
  });
}

function centerSelected(e, currentNode) {
  const optionValue = e.data.value;
  const instance = currentNode.compositorInstance;

  const c = instance.fcanvas;
  // get the selected and set the
  instance.needsUpload = true;
  c.getActiveObjects().forEach((o) => o.center());
  c.renderAll();
  instance.uploadIfNeeded(instance);
}

app.registerExtension({
  name: "Comfy.Compositor3",
  async getCustomWidgets(app) {
    return {};
  },
  async setup(app) {
    Editor.addCompositorSettings();

    // function hook(nodeId) {
    //   return app.graph.getNodeById(nodeId);
    // }

    function executingMessageHandler(event) {
      const current = app.graph.getNodeById(event.detail);
    }

    function executedMessageHandler(event, a, b) {
      const e = event.detail.output;
      const nodeId = event.detail.node;
      const node = Editor.hook(nodeId);
      if (!node || node.type != "Compositor3") {
        // console.log("no compositor3 node found for id", nodeId);
        return;
      }
      const instance = node.compositorInstance;

      node.compositorInstance.w.value = e.width[0];
      node.compositorInstance.h.value = e.height[0];
      node.compositorInstance.p.value = e.padding[0];
      node.compositorInstance.onWidthChange(e.width[0]);
      node.compositorInstance.onHeightChange(e.height[0]);
      node.compositorInstance.onPaddingChange(e.padding[0]);
      // node.compositorInstance.onCaptureOnQueueChange(e.captureOnQueue[0]);

      const images = [...e.names];

      // console.log("deserializing fabric data for node", nodeId, node);
      const restore = Editor.deserializeStuff(node.fabricDataWidget.value);
      const three = Editor.getConfigWidgetValue(node, 3);
      // console.log("restoreVal", three);
      const shouldRestore = restore ?? false; // Editor.getConfigWidgetValue(node, 3);
      const normalizeHeight = Editor.getConfigWidgetValue(node, 3);
      const onConfigChanged = Editor.getConfigWidgetValue(node, 4);
      const five = Editor.getConfigWidgetValue(node, 5);
      const six = Editor.getConfigWidgetValue(node, 6);

      // console.log(three, five, six);

      instance.normalizeHeigh = normalizeHeight;
      instance.onConfigChanged = onConfigChanged;
      instance.configChanged = e.configChanged[0];

      images.map((b64, index) => {
        function fromUrlCallback(oImg) {
          node.compositorInstance.addOrReplaceImage(
            oImg,
            index,
            nodeId,
            restore,
            shouldRestore
          );
        }

        fabric.Image.fromURL(b64, fromUrlCallback);
      });

      if (instance.configChanged) {
        instance.needsUpload = true;

        if (onConfigChanged) {
          const reEnqueue = () => {
            interrupt();
            instance.continue();
          };

          instance.uploadIfNeeded(instance, reEnqueue);
        } else {
          instance.uploadIfNeeded(instance);
        }
      }
    }

    api.addEventListener("compositor_init", executedMessageHandler);
    //api.addEventListener("graphChanged", graphChangedHandler);
    //api.addEventListener("change_workflow", changeWorkflowHandler);
    //api.addEventListener("execution_start", executionStartHandler);
    //api.addEventListener("execution_cached", executionCachedHandler);
    api.addEventListener("executing", executingMessageHandler);

    api.addEventListener("executed", executedMessageHandler);

    //api.addEventListener("progress", progressHandler);

    // api.addEventListener("configure", configureHandler);
  },

  async afterConfigureGraph(args) {
    const configs = app.graph.findNodesByType("CompositorConfig3");
    configs.forEach((c) => {
      const initialized = getCompositorWidget(c, "initialized");
      initialized.value = Date.now();
    });

    const nodes = app.graph.findNodesByType("Compositor3");

    nodes.forEach((currentNode) => {
      const tools = currentNode.getInputNode(1);

      if (!tools) {
        // console.log(
        //   "No tools node connected to input 1 for Compositor3 node:",
        //   currentNode.id
        // );
        return; // Skip this node
      }

      const CHANNELNAME = `Tools${tools.id}`;

      const channel = new BroadcastChannel(CHANNELNAME);
      channel.addEventListener("message", (e) => {
        switch (e.data.action) {
          case "togglePreciseSelection":
            handleTogglePreciseSelection(e, currentNode);
            break;
          case "resetTransforms":
            handleResetOldTransform(e, currentNode);
            break;
          case "centerSelected":
            centerSelected(e, currentNode);
            break;
          default:
            console.warn("unknown broadcast event", e);
        }
      });

      currentNode.channel = channel;
    });
    app.graph.setDirtyCanvas(true, true);
  },

  async nodeCreated(node) {
    if (!isCompositor3(node)) return;

    debugger;

    node.imageNameWidget = getCompositorWidget(node, "imageName");
    const originalCallback = node.imageNameWidget.callback;
    node.imageNameWidget.callback = () => {
      originalCallback(arguments);
    };
    //node.imageNameWidget.hidden = true;
    // node.imageNameWidget.locked = true;
    //node.imageNameWidget.disabled = true;
    //node.imageNameWidget.computeSize = () => [0, 0];

    //hideWidgetForGood(node, node.imageNameWidget);
    node.configWidget = getCompositorWidget(node, "config");

    node.fabricDataWidget = getCompositorWidget(node, "fabricData");
    //node.fabricDataWidget.computeSize = () => [0, 0];
    //hideWidgetForGood(node, node.fabricDataWidget);
    // console.log("fabricDataWidget", node.fabricDataWidget);
    //const firstRun = Editor.deserializeStuff(node.fabricDataWidget.value);
    // console.log("firstRun", firstRun);
    // firstRun["firstRun"] = Date.now();
    // node.fabricDataWidget.value = JSON.stringify(firstRun);

    const containerDiv = Editor.createCompositorContainerDiv(node);

    const c = document.createElement("canvas");
    c.id = "c_" + node.id;
    containerDiv.appendChild(c);

    node.editorWidget = node.addDOMWidget("test", "test", containerDiv, {
      hideOnZoom: false,
    });
    const fc = new fabric.Canvas(c, {
      backgroundColor: "transparent",
      selectionColor: "transparent",
      selectionLineWidth: 1,
      preserveObjectStacking: true,
      altSelectionKey: "ctrlKey",
      altActionKey: "ctrlKey",
      centeredKey: "altKey",
    });

    const compositorInstance = new Editor(node, containerDiv);
    compositorInstance.initFabric(fc);

    node.continue = node.addWidget(
      "button",
      "continue",
      "continue",
      compositorInstance.continue.bind(compositorInstance)
    );

    node.onMouseOut = function (e, pos, canvas) {
      const original_onMouseDown = node.onMouseOut;
      return original_onMouseDown?.apply(this, arguments);
    };
  },
});

// function hideWidgetForGood(node, widget, suffix = "") {
//   widget.origType = widget.type;
//   widget.origComputeSize = widget.computeSize;
//   widget.origSerializeValue = widget.serializeValue;
//   widget.computeSize = () => [0, -4]; // -4 is due to the gap litegraph adds between widgets automatically
//   widget.type = "converted-widget" + suffix;

//   if (widget.linkedWidgets) {
//     for (const w of widget.linkedWidgets) {
//       hideWidgetForGood(node, w, ":" + widget.name);
//     }
//   }
// }

/** will be added on node created to the node via addDOMWidget */
class Editor {
  id;
  canvasEl;
  fcanvas;
  containerDiv;
  cblob;
  c1;
  c2;
  sameHash;
  selected;

  CANVAS_BORDER_COLOR = "#00b300b0";
  COMPOSITION_BORDER_COLOR = "#00b300b0";
  COMPOSITION_BORDER_SIZE = 2;
  COMPOSITION_BACKGROUND_COLOR = "rgba(0,0,0,0.2)";

  compositionArea;
  compositionBorder;
  preciseSelection = false;

  p;
  w;
  h;

  inputImages = [null, null, null, null, null, null, null, null];
  fabricDataWidget;
  needsUpload = false;

  configurationNode;

  static hook(nodeId) {
    // console.log("hooking", nodeId);
    return app.graph.getNodeById(nodeId);
  }

  static deserializeStuff(value) {
    //console.log("deserializing fabric data", value);
    try {
      return JSON.parse(value);
    } catch (e) {
      // console.warn("deserializeStuff", e, value);
      return undefined;
    }
  }

  /**
   * serializes some info from the node, currently the transforms supplied to the images
   * this is currently called on capture (regardless of the flag)
   */
  static serializeStuff(node) {
    const instance = node.compositorInstance;
    const result = {
      // or the widget ? boh
      width: instance.w.value,
      height: instance.h.value,
      padding: instance.p.value,
      transforms: undefined,
    };
    const res = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
      try {
        let t = instance.getOldTransform(i);
        return t;
      } catch (e) {
        return undefined;
      }
    });
    result.transforms = res;

    const bboxes = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
      try {
        let t = instance.getBoundingBox(i);
        return t;
      } catch (e) {
        return undefined;
      }
    });

    result.bboxes = bboxes;

    return JSON.stringify(result);
  }

  /**
   * in CompositorConfig
   * - 4 is pause ->3 removed
   * - 5 is storeTransforms ->3 removed
   * - 6 initialized ->3
   */
  static getConfigWidgetValue(node, slot) {
    const connected = node.getInputNode(0);
    return connected.widgets[slot].value;
  }

  static getToolWidget(instance) {
    return instance.node.getInputNode(1);
  }

  /**
   * in CompositorConfig
   * - 4 is pause >removed
   * - 5 is storeTransforms >removed
   * - 6 initialized -> 2
   */
  static setConfigWidgetValue(node, slot, value) {
    const connected = node.getInputNode(0);
    return (connected.widgets[slot].value = value);
  }

  static addCanvasBorderColorSetting() {
    app.extensionManager.setting.set({
      id: "Compositor3.Canvas.BORDER_COLOR",
      name: "Border Color",
      tooltip:
        "give an hex code with alpha, e.g.: #00b300b0, it's the area controlled by 'padding' size outside the  output that will not be exported but used for manipulation",
      type: "text",
      defaultValue: "#00b300b0",
    });
  }

  static addCompositionBorderColorSetting() {
    app.extensionManager.setting.set({
      id: "Compositor3.Composition.BORDER_COLOR",
      name: "Border Color (not rendered)",
      type: "text",
      tooltip:
        "give hex code with alpha eg.: #00b300b0, this will help identifying what is withing the output",
      defaultValue: "#00b300b0",
    });
  }

  static addCompositionBorderSizeSetting() {
    app.extensionManager.setting.set({
      id: "Compositor3.Composition.BORDER_SIZE",
      name: "Border Size",
      type: "slider",
      attrs: {
        min: 0,
        max: 2,
        step: 1,
      },
      defaultValue: 2,
      tooltip:
        "Border size, 0 for invisible, overlayed and unselectable, not part of the node ouptut",
    });
  }

  static addCompositionBackgroundColorSetting() {
    app.extensionManager.setting.set({
      id: "Compositor3.Composition.BACKGROUND_COLOR",
      name: "Background Color - Output",
      type: "text",
      tooltip:
        "give hex code with alpha eg.: #00b300b0, this will help identifying what is withing the output",
      defaultValue: "rgba(0,0,0,0.2)",
    });
  }

  static addCompositorSettings() {
    Editor.addCanvasBorderColorSetting();
    Editor.addCompositionBorderColorSetting();
    Editor.addCompositionBorderSizeSetting();
    Editor.addCompositionBackgroundColorSetting();
  }

  getCompositorSettings() {
    // this.CANVAS_BORDER_COLOR = app.extensionManager.setting.get("Compositor3.Canvas.BORDER_COLOR");
    // this.COMPOSITION_BORDER_COLOR = app.extensionManager.setting.get("Compositor3.Composition.BORDER_COLOR");
    // this.COMPOSITION_BORDER_SIZE = app.extensionManager.setting.get("Compositor3.Composition.BORDER_SIZE");
    // this.COMPOSITION_BACKGROUND_COLOR = app.extensionManager.setting.get("Compositor3.Composition.BACKGROUND_COLOR");
  }

  static getRandomCompositorUniqueId() {
    const randomUniqueIds = new Uint32Array(10);
    const compositorId =
      "c_" +
      self.crypto.getRandomValues(randomUniqueIds)[0] +
      "_" +
      self.crypto.getRandomValues(randomUniqueIds)[1];
    return compositorId;
  }

  static createCompositorContainerDiv() {
    const container = document.createElement("div");
    container.style.backgroundColor = "rgba(15,0,25,0.25)";
    container.style.textAlign = "center";
    return container;
  }

  static createCanvasElement() {
    const canvas = document.createElement("canvas");
    canvas.id = Editor.getRandomCompositorUniqueId();
    return canvas;
  }

  onHeightChange(value) {
    this.fcanvas.setHeight(value + this.p.value * 2);
    this.compositionArea.setHeight(value);
    this.compositionBorder.setHeight(value + this.COMPOSITION_BORDER_SIZE * 2);

    this.node.setSize(this.calculateNodeSize());
    this.fcanvas.renderAll();
  }

  onWidthChange(value) {
    this.fcanvas.setWidth(value + this.p.value * 2);
    this.compositionArea.setWidth(value);
    this.compositionBorder.setWidth(this.COMPOSITION_BORDER_SIZE * 2);
    this.node.setSize(this.calculateNodeSize());
    this.fcanvas.renderAll();
  }

  onPaddingChange(padding) {
    this.compositionArea.setHeight(this.h.value);
    this.compositionArea.setWidth(this.w.value);
    this.compositionArea.setLeft(padding);
    this.compositionArea.setTop(padding);

    this.compositionBorder.setHeight(
      this.h.value + this.COMPOSITION_BORDER_SIZE * 2
    );
    this.compositionBorder.setWidth(
      this.w.value + this.COMPOSITION_BORDER_SIZE * 2
    );
    this.compositionBorder.setLeft(padding - this.COMPOSITION_BORDER_SIZE);
    this.compositionBorder.setTop(padding - this.COMPOSITION_BORDER_SIZE);

    this.fcanvas.setHeight(this.compositionArea.getHeight() + padding * 2);
    this.fcanvas.setWidth(this.compositionArea.getWidth() + padding * 2);
    this.fcanvas.renderAll();
    this.node.setSize(this.calculateNodeSize());
  }

  getOldTransform(index) {
    const ref = this.inputImages[this.imageNameAt(index)];
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
  }

  getBoundingBox(index) {
    const ref = this.inputImages[this.imageNameAt(index)].getBoundingRect();
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
  }

  resetOldTransform(index) {
    this.inputImages[this.imageNameAt(index)].left = 0;
    this.inputImages[this.imageNameAt(index)].top = 0;
    this.inputImages[this.imageNameAt(index)].scaleX = 1;
    this.inputImages[this.imageNameAt(index)].scaleY = 1;
    this.inputImages[this.imageNameAt(index)].angle = 0;
    this.inputImages[this.imageNameAt(index)].flipX = false;
    this.inputImages[this.imageNameAt(index)].flipY = false;
    this.inputImages[this.imageNameAt(index)].originX = "top";
    this.inputImages[this.imageNameAt(index)].originY = "left";

    this.inputImages[this.imageNameAt(index)].skewY = 0;
    this.inputImages[this.imageNameAt(index)].skewX = 0;
    this.inputImages[this.imageNameAt(index)].perPixelTargetFind =
      this.preciseSelection;
    this.fcanvas.renderAll();
  }

  hasImageAtIndex(index) {
    return this.inputImages[this.imageNameAt(index)] != null;
  }

  imageNameAt(index) {
    return "image" + (index + 1);
  }

  addImage(index, theImage) {
    this.inputImages[this.imageNameAt(index)] = theImage;
    this.fcanvas.add(theImage);
  }

  replaceImage(index, theImage) {
    const oldTransform = this.getOldTransform(index);
    // Remove the old image from the canvas
    this.fcanvas.remove(this.inputImages[this.imageNameAt(index)]);
    // this breaks if we have width and height so renamed to xwidth and xheight
    theImage.set(oldTransform);
    this.fcanvas.add(theImage);
    this.inputImages[this.imageNameAt(index)] = theImage;
  }

  addOrReplaceImage(theImage, index, nodeId, r, shouldRestore) {
    const node = app.graph.getNodeById(nodeId);
    const instance = node.compositorInstance;
    if (instance.hasImageAtIndex(index)) {
      instance.replaceImage(index, theImage);
    } else {
      instance.addImage(index, theImage);
    }

    if (shouldRestore) {
      try {
        if (theImage) {
          // restore the transforms
          const restoreParams = r.transforms[index];
          theImage.scaleX = restoreParams.scaleX;
          theImage.scaleY = restoreParams.scaleY;
          theImage.angle = restoreParams.angle;
          theImage.left = restoreParams.left;
          theImage.top = restoreParams.top;
          theImage.flipX = restoreParams.flipX;
          theImage.flipY = restoreParams.flipY;
          theImage.originX = restoreParams.originX;
          theImage.originY = restoreParams.originY;
          theImage.skewY = restoreParams.skewY;
          theImage.skewX = restoreParams.skewX;
        }
      } catch (e) {
        // console.log(e);
      }
    }

    // whatever it happens, ensure the composition border is on top
    instance.fcanvas.bringToFront(instance.compositionBorder);
    instance.fcanvas.renderAll();
  }

  static createFabricCanvas(id) {
    const canvasElement = document.getElementById(id);
    const fcanvas = new fabric.Canvas(canvasElement, {
      backgroundColor: "transparent",
      selectionColor: "transparent",
      selectionLineWidth: 1,
      preserveObjectStacking: true,
      altSelectionKey: "ctrlKey",
      altActionKey: "ctrlKey",
      centeredKey: "altKey",
    });

    return fcanvas;
  }

  static dataURLToBlob = (dataURL) => {
    const parts = dataURL.split(",");
    const mime = parts[0].match(/:(.*?);/)[1];
    const binary = atob(parts[1]);
    const array = [];
    for (let i = 0; i < binary.length; i++) {
      array.push(binary.charCodeAt(i));
    }
    return new Blob([new Uint8Array(array)], { type: mime });
  };

  static uploadImage = (blob, imageNameWidget, node_id, setDone, callback) => {
    const node = app.graph.getNodeById(node_id);

    node.compositorInstance.compositionBorder.set("stroke", "orange");
    node.compositorInstance.fcanvas.renderAll();

    const UPLOAD_ENDPOINT = "/upload/image";

    const name = `${+new Date()}.png`;
    const file = new File([blob], name);
    const body = new FormData();

    body.append("image", file);
    body.append("subfolder", "compositor");
    body.append("type", "temp");

    api
      .fetchApi(UPLOAD_ENDPOINT, {
        method: "POST",
        body,
      })
      .then(
        (value) => {
          const outputValue = `compositor/${name} [temp]`;
          debugger;
          imageNameWidget.value = outputValue;

          const body = new FormData();
          body.append("filename", outputValue);
          body.append("node_id", node_id);
          body.append("overwrite", "true");

          node.compositorInstance.compositionBorder.set(
            "stroke",
            node.compositorInstance.COMPOSITION_BORDER_COLOR
          );
          node.compositorInstance.fcanvas.renderAll();

          node.setDirtyCanvas(true, true);
          if (callback) callback();
          // deprecated, not really needed anymore
          if (setDone)
            api.fetchApi("/compositor/done", { method: "POST", body });
        },
        () => {
          console.log("some error");
        }
      );
  };

  /** if we have no blob stored in memory, this should be the first run */
  hasNeverRun() {
    return this.cblob == undefined;
  }

  /** this can't be async so resort to promise resolving and callbacks
   * @params setDone  **deprecated** when setDone is true, it will raise a /compositor/done event for the backend
   * @params callback  will be passed to uploadImage and called when the upload has finished
   * */
  grabUploadAndSetOutput(instance, setDone, callback) {
    const img = new Image();
    // load something existing into it via view api, for testing
    // api/view?filename=R.jpg&type=input&subfolder=&rand=0.6726800041773884
    // img.src = "/api/view?filename=R.jpg&type=input&subfolder=&rand=0.6726800041773884";
    this.fcanvas.discardActiveObject().renderAll();
    const data = this.fcanvas.toDataURL({
      format: "jpeg",
      quality: 0.8,
      left: this.p.value,
      top: this.p.value,
      width: this.w.value,
      height: this.h.value,
    });

    img.src = data;
    // once finished, export image , upload id with temp name simulating compositing
    // and update the output name value
    img.onload = (e) => {
      const blob = Editor.dataURLToBlob(data);

      if (this.hasNeverRun()) {
        Editor.uploadImage(
          blob,
          this.node.imageNameWidget,
          this.node.id,
          false,
          callback
        );
      } else {
        /**
         * grabUploadAndSetOutput callback can't be async, so this one cant wait for the result and name
         * pass the widget in upload image as well, so we can just process it.
         * not sure if it creates problems if we run a "capture on queue"
         */
        Editor.uploadImage(
          blob,
          this.node.imageNameWidget,
          this.node.id,
          setDone,
          callback
        );
      }

      this.cblob = blob;

      // serialization of transforms
      const serialized = Editor.serializeStuff(this.node);
      if (!serialized.includes("[null,null,null,null,null,null,null,null]")) {
        this.node.fabricDataWidget.value = serialized;
      }
    };
  }

  continue(setDone) {
    app.queuePrompt(0, 1);
  }

  /**
   * moves the active object in the fabric canvas
   * @param direction array with [x,y] coords in range -1 +1 with 0 for no  movement
   * @param withShift
   */
  moveSelected(direction = [], withShift = false) {
    const STEP = withShift ? 10 : 1;
    const activeObject = this.fcanvas.getActiveObject();
    if (activeObject) {
      activeObject.set({
        left: activeObject.left + direction[0] * STEP,
        top: activeObject.top + direction[1] * STEP,
      });
      this.fcanvas.renderAll();
      instance.fcanvas.bringToFront(instance.compositionBorder);
    }
  }

  setupfCanvasEvents(compositorInstance) {
    function isSubmit(key, ctl) {
      return key === 13 && ctl;
    }

    function isLeft(key) {
      return key === 37;
    }

    function isTop(key) {
      return key === 38;
    }

    function isRight(key) {
      return key === 39;
    }

    function isDown(key) {
      return key === 40;
    }

    function downDirection() {
      return [-1, 0];
    }

    function topDirection() {
      return [0, -1];
    }

    function rightDirection() {
      return [1, 0];
    }

    this.fcanvas.on("selection:created", function (opt) {
      this.selected = opt.selected;

      opt.e.preventDefault();
      opt.e.stopPropagation();
    });

    this.fcanvas.on("selection:updated", function (opt) {
      this.selected = opt.selected;

      opt.e.preventDefault();
      opt.e.stopPropagation();
    });

    this.fcanvas.on("selection:cleared", function (opt) {
      this.selected = undefined;
    });

    this.fcanvas.on("mouse:out", function (opt) {
      // moving outside editor, this might fail to be intercepted depending on how full the canvas is
      if (
        opt.target === null ||
        opt.target === undefined ||
        (opt.target && opt.nextTarget === undefined)
      ) {
        compositorInstance.uploadIfNeeded(compositorInstance);
      }
    });

    this.fcanvas.on("object:modified", function (opt) {
      // mark as needing upload so when we mouse out we doit then reset
      // mouse out is flimsy, sometimes it's not triggering
      compositorInstance.needsUpload = true;
      compositorInstance.fcanvas.bringToFront(
        compositorInstance.compositionBorder
      );
      compositorInstance.fcanvas.renderAll();
    });

    this.fcanvas.on("mouse:wheel", function (opt) {
      try {
        if (opt.target.cacheKey !== this.selected[0].cacheKey) return;
        if (!this.selected) return;

        const sign = Math.sign(opt.e.deltaY);
        opt.target.scaleX = opt.target.scaleX + sign * 0.01;
        opt.target.scaleY = opt.target.scaleY + sign * 0.01;
        opt.target.dirty = true;

        opt.e.preventDefault();
        opt.e.stopPropagation();

        this.renderAll();
      } catch (e) {
        return;
      }
    });

    fabric.util.addListener(
      document.body,
      "keydown",
      function keydownHandler(options) {
        var key = options.which || options.keyCode; // key detection
        if (isLeft(key)) {
          this.moveSelected(downDirection(), options.shiftKey);
        } else if (isTop(key)) {
          this.moveSelected(topDirection(), options.shiftKey);
        } else if (isRight(key)) {
          this.moveSelected(rightDirection(), options.shiftKey);
        } else if (isDown(key)) {
          this.moveSelected([0, 1], options.shiftKey);
        } else if (isSubmit(key, options.ctrlKey)) {
          compositorInstance.uploadIfNeeded(compositorInstance);
        }
      }.bind(this)
    );
  }

  uploadIfNeeded(
    compositorInstance,
    callback = () => {
      // console.log("upload if needed...");
    }
  ) {
    if (compositorInstance.needsUpload) {
      //console.log("...uploading");
      compositorInstance.needsUpload = false;
      const serialized = Editor.serializeStuff(compositorInstance.node);
      //console.log("serialized data:", serialized);
      compositorInstance.node.fabricDataWidget.value = serialized;

      compositorInstance.grabUploadAndSetOutput(
        compositorInstance,
        false,
        callback
      );
    } else {
      console.warn("...no upload needed to be done");
    }
  }

  /**
   * The actual area of WxH dimensions that will be exported as output
   */
  createCompositionArea() {
    //p, w, h, node
    return new fabric.Rect({
      left: this.p.value,
      top: this.p.value,
      fill: this.COMPOSITION_BACKGROUND_COLOR,
      width: this.w.value,
      height: this.h.value,
      selectable: false,
    });
  }

  /**
   * A non-interactive rectangle with transparent content and
   * colored border around that frames the composition from the outside
   * and is overlaid on top of all passed images
   * the size and position are calculated given the width height and
   * COMPOSITION_BORDER_SIZE
   * COMPOSITION_BORDER_COLOR
   */
  createCompositionBorder() {
    // p, w, h, node

    const compositionBorder = new fabric.Rect({
      left: this.p.value - this.COMPOSITION_BORDER_SIZE,
      top: this.p.value - this.COMPOSITION_BORDER_SIZE,
      fill: "transparent",
      width: this.w.value + this.COMPOSITION_BORDER_SIZE * 2,
      height: this.h.value + this.COMPOSITION_BORDER_SIZE * 2,
      selectable: false,
      evented: false,
    });

    compositionBorder.set("strokeWidth", this.COMPOSITION_BORDER_SIZE);
    compositionBorder.set("stroke", this.COMPOSITION_BORDER_COLOR);
    compositionBorder.set("selectable", false);
    compositionBorder.set("evented", false);

    return compositionBorder;
  }

  calculateNodeSize() {
    const ch = this.fcanvas.getHeight();
    const cw = this.fcanvas.getWidth();
    return [cw + 21, ch + 91];
  }

  initFabric(c) {
    this.getCompositorSettings();

    // wannabe widgets
    this.w = {
      value: 512,
      callback: (value, graphCanvas, node) => {},
    };
    this.h = {
      value: 512,
      callback: (value, graphCanvas, node) => {},
    };
    this.p = {
      value: 100,
      callback: (value, graphCanvas, node) => {},
    };

    this.containerDiv.width = this.w.value + 2 * this.p.value;
    this.containerDiv.height = this.h.value + 2 * this.p.value;

    if (!c) {
      this.canvasEl = Editor.createCanvasElement();

      this.containerDiv.appendChild(this.canvasEl);

      this.containerDiv.style.overflow = "hidden";
      this.canvasEl.width = this.w.value + 2 * this.p.value;
      this.canvasEl.height = this.h.value + 2 * this.p.value;

      this.fcanvas = Editor.createFabricCanvas(this.canvasEl);
    } else {
      this.containerDiv.style.overflow = "hidden";
      this.fcanvas = c;
      this.fcanvas.setWidth(this.w.value + 2 * this.p.value);
      this.fcanvas.setHeight(this.h.value + 2 * this.p.value);
    }

    this.compositionArea = this.createCompositionArea();
    this.compositionBorder = this.createCompositionBorder();

    this.fcanvas.add(this.compositionArea);
    this.fcanvas.add(this.compositionBorder);

    this.setupfCanvasEvents(this);

    this.fcanvas.renderAll();

    this.node["compositorInstance"] = this;

    this.node.setSize(this.calculateNodeSize());
    this.node.setDirtyCanvas(true, true);
  }

  constructor(context, container) {
    this.node = context;
    this.containerDiv = container;
    this.node["compositorInstance"] = this;
    this.reference = context.widgets.find((w) => w.name === "widgetName");
  }
}

async function interrupt() {
  const response = await fetch("/interrupt", {
    method: "POST",
    cache: "no-cache",
    headers: {
      "Content-Type": "text/html",
    },
  });
  //return await response.json();
  return response;
}
