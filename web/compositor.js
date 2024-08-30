// author: erosdiffusionai@gmail.com
import {app} from "../../scripts/app.js";
import {api} from "../../scripts/api.js";

import {fabric} from "./fabric.js";

const COMPOSITOR = Symbol();
const TEST_IMAGE_2 = "./extensions/ComfyUI-enricos-nodes/empty.png"

/**
 * Initialize a fabric js instance.
 * Fabric is the engine that makes it possible to  manipulate the images
 * and extract the final composite image
 * @param canvasId
 * @return {fabric.Canvas}
 */
const createCanvas = (canvasId) => new fabric.Canvas(canvasId, {
    backgroundColor: 'transparent',
    selectionColor: 'transparent',
    selectionLineWidth: 1,
    // F-10 preserve object stacking
    preserveObjectStacking: true,
});

/**
 * setup compositor metadata/references in the node
 */
function initStuff(node, compositorId, CANVAS_BORDER_COLOR, COMPOSITION_BORDER_COLOR , COMPOSITION_BORDER_SIZE, COMPOSITION_BACKGROUND_COLOR) {
    node.stuff = {
        canvasId: compositorId,
        canvas: null,
        compositionBorder: null,
        c1: "",
        c2: "",
        /** contains the last image, i probably just need the hash anyways */
        cblob: undefined,
        /** contains the last uploaded image file name, will be sent again if hashes match (same content with cblob) */
        lastUpload: undefined,
        CANVAS_BORDER_COLOR:CANVAS_BORDER_COLOR,
        COMPOSITION_BORDER_COLOR:COMPOSITION_BORDER_COLOR,
        COMPOSITION_BORDER_SIZE:COMPOSITION_BORDER_SIZE,
        COMPOSITION_BACKGROUND_COLOR:COMPOSITION_BACKGROUND_COLOR,


    }
}

/**
 * takes a given dataURL and transforms into a binary large object
 */
function dataURLToBlob(dataURL) {
    const parts = dataURL.split(',');
    const mime = parts[0].match(/:(.*?);/)[1];
    const binary = atob(parts[1]);
    const array = [];
    for (let i = 0; i < binary.length; i++) {
        array.push(binary.charCodeAt(i));
    }
    return new Blob([new Uint8Array(array)], {type: mime});
}

/**
 * uploads the composite image passed as blob
 * via api to the /uppload/image enpoint as post
 * with option to save to the temp folder
 * @return the uploaded image filename
 */
const uploadImage = async (blob) => {
    const UPLOAD_ENDPOINT = "/upload/image";
    const name = `${+new Date()}.png`;
    const file = new File([blob], name);
    const body = new FormData();

    body.append("image", file);
    body.append("subfolder", "compositor");
    body.append("type", "temp");

    const resp = await api.fetchApi(UPLOAD_ENDPOINT, {
        method: "POST",
        body,
    });

    if (resp.status !== 200) {
        const err = `Error uploading composition image: ${resp.status} - ${resp.statusText}`;
        throw new Error(err);
    }
    /** return the last upload name */
    return `compositor/${name} [temp]`;
}

/**
 * calculates the widget size given the contents, a bit flaky
 * @param v the fabric canvas reference
 * @return the size array [w,h]
 */
const calculateWidgetSize = (v) => {
    return [v.getWidth() + 100, v.getHeight() + 558];
}


/**
 * given a blob, calculate its checksum and returns as promise of string
 * @return cheksum string as promise
 */
async function getChecksumSha256(blob) {
    const uint8Array = new Uint8Array(await blob.arrayBuffer());
    const hashBuffer = await crypto.subtle.digest('SHA-256', uint8Array);
    const hashArray = Array.from(new Uint8Array(hashBuffer));

    return hashArray.map((h) => h.toString(16).padStart(2, '0')).join('');
}

/**
 * checks if there is anything in the medatada,
 * the previous generation is stored in node.stuff.cblob
 */
const isImageStored = (node) => {
    return node.stuff.cblob == undefined
}

const createCompositionArea = (p, w, h) => {
    return new fabric.Rect({
        left: p.value,
        top: p.value,
        fill: 'rgba(0,0,0,0.2)',
        width: w.value,
        height: h.value,
        selectable: false,
    });
}


/**
 * Web page load
 * invokeExtensionsAsync init
 * invokeExtensionsAsync addCustomNodeDefs
 * invokeExtensionsAsync getCustomWidgets
 * invokeExtensionsAsync beforeRegisterNodeDef    [repeated multiple times]
 * invokeExtensionsAsync registerCustomNodes
 * invokeExtensionsAsync beforeConfigureGraph
 * invokeExtensionsAsync nodeCreated
 * invokeExtensions      loadedGraphNode
 * invokeExtensionsAsync afterConfigureGraph
 * invokeExtensionsAsync setup
 */

/**
 * Loading workflow
 * invokeExtensionsAsync beforeConfigureGraph
 * invokeExtensionsAsync beforeRegisterNodeDef   [zero, one, or multiple times]
 * invokeExtensionsAsync nodeCreated             [repeated multiple times]
 * invokeExtensions      loadedGraphNode         [repeated multiple times]
 * invokeExtensionsAsync afterConfigureGraph
 */

/**
 * Adding new node
 * invokeExtensionsAsync nodeCreated
 */


function setupReferences(node, p, w, h, v, composite, img, compositionArea, capture) {
    node.stuff.p = p;
    node.stuff.w = w;
    node.stuff.h = h;
    /** the fabric canvas:v */
    node.stuff.v = v;
    node.stuff.composite = composite;
    node.stuff.i = img;
    node.stuff.compositionArea = compositionArea;
    node.stuff.compositionBorder = compositionBorder;
    node.stuff.capture = capture;
}

/**
 * checks if the reference at index for an image is not null
 * references are stored in "node.stuff"
 * @param node
 * @param index
 * @return {boolean}
 */
function stuffHasImageAtIndex(node, index) {
    return node.stuff[imageNameAt(index)] != null;
}

/**
 * returns a string in the format image1...
 * the array is zero based
 * but the named property is named after the input so 0 -> image1
 * @param index
 * @return {string}
 */
function imageNameAt(index) {
    return 'image' + (index + 1);
}

function getOldTransform(node, index) {
    return {
        left: node.stuff[imageNameAt(index)].left,
        top: node.stuff[imageNameAt(index)].top,
        scaleX: node.stuff[imageNameAt(index)].scaleX,
        scaleY: node.stuff[imageNameAt(index)].scaleY,
        angle: node.stuff[imageNameAt(index)].angle,
        flipX: node.stuff[imageNameAt(index)].flipX,
        flipY: node.stuff[imageNameAt(index)].flipY,
        originX: node.stuff[imageNameAt(index)].originX,
        originY: node.stuff[imageNameAt(index)].originY,
    };
}

/**
 * a border around and outside the composition with
 * COMPOSITION_BORDER_SIZE
 * COMPOSITION_BORDER_COLOR
 * that is overlaid, brought to front and not overlapping the composition itself
 */
function createCompositionBorder(p, w, h, node) {
    return new fabric.Rect({
        left: p.value - node.stuff.COMPOSITION_BORDER_SIZE,
        top: p.value - node.stuff.COMPOSITION_BORDER_SIZE,
        fill: node.stuff.COMPOSITION_BACKGROUND_COLOR,
        width: w.value + node.stuff.COMPOSITION_BORDER_SIZE*2,
        height: h.value + node.stuff.COMPOSITION_BORDER_SIZE*2,
        selectable: false,
    });
}

app.registerExtension({
    name: "Comfy.Compositor",
    async getCustomWidgets(app) {
        return {
            COMPOSITOR(node, inputName, inputData, app) {

                // preferences
                // https://docs.comfy.org/essentials/javascript_examples

                let CANVAS_BORDER_COLOR = app.ui.settings.getSettingValue("Compositor.Canvas.BORDER_COLOR", "#FF0000B0");
                let COMPOSITION_BORDER_COLOR = app.ui.settings.getSettingValue("Compositor.Composition.BORDER_COLOR", "#00b300b0");
                // overlay;
                let COMPOSITION_BORDER_SIZE = app.ui.settings.getSettingValue("Compositor.Composition.BORDER_SIZE", 2);
                let COMPOSITION_BACKGROUND_COLOR = app.ui.settings.getSettingValue("Compositor.Composition.COMPOSITION_BACKGROUND_COLOR", "#000000b0");

                const array = new Uint32Array(10);
                const compositorId = 'c_' + self.crypto.getRandomValues(array)[0] + '_' + self.crypto.getRandomValues(array)[1];

                initStuff(node, compositorId, CANVAS_BORDER_COLOR, COMPOSITION_BORDER_COLOR , COMPOSITION_BORDER_SIZE, COMPOSITION_BACKGROUND_COLOR);

                // console.log("getCustomWidgets", node, node.id, inputName, inputData, app, node.stuff);
                let res;
                node[COMPOSITOR] = new Promise((resolve) => (res = resolve));

                const container = document.createElement("div");
                container.style.background = "rgba(0,0,0,0.25)";
                container.style.textAlign = "center";

                const canvas = document.createElement("canvas");
                canvas.id = node.stuff.canvasId;
                canvas.style = `outline:1px solid ${CANVAS_BORDER_COLOR}`;
                // canvas.width = 'auto';
                // canvas.height = 'auto';
                // node.resizable = false;

                container.appendChild(canvas);
                // https://docs.comfy.org/essentials/javascript_objects_and_hijacking


                // NOTE: hideOnZoom:false FIXES not being able to take screenshot and disappearing on zomout
                return {widget: node.addDOMWidget(inputName, "COMPOSITOR", container, {hideOnZoom: false})}; // hideOnZoom:false ,ccanvas: canvas
                // return {widget: node.addDOMWidget(inputName, "COMPOSITOR", container, {})}; // hideOnZoom:false ,ccanvas: canvas
            },
        };
    },
    /**
     * Called at the end of the startup process.
     * A good place to add event listeners (either for Comfy events, or DOM events), or adding to the global menus,
     * both of which are discussed elsewhere.
     */
    async setup(app) {


        // app.ui.settings.addSetting({
        //     id: "Compositor.Canvas.BORDER_COLOR",
        //     name: "Border Color",
        //     tooltip: "give an hex code with alpha, e.g.: #00b300b0, it's the area controlled by 'padding' size outside the  output that will not be exported but used for manipulation",
        //     type: "text",
        //     defaultValue: "#00b300b0",
        //     onChange: (newVal, oldVal) => {
        //         console.log(newVal, this);
        //     },
        //
        // });
        //
        // app.ui.settings.addSetting({
        //     id: "Compositor.Composition.BORDER_COLOR",
        //     name: "Border Color (not rendered)",
        //     type: "text",
        //     tooltip: "give hex code with alpha eg.: #00b300b0, this will help identifying what is withing the output",
        //     defaultValue: "#00b300b0",
        //     onChange: (newVal, oldVal) => {
        //         console.log(newVal, this);
        //     },
        //
        // });

        // app.ui.settings.addSetting({
        //     id: "Compositor.Composition.BORDER_SIZE",
        //     name: "Border Size",
        //     type: "slider",
        //     attrs: {
        //         min: 0,
        //         max: 2,
        //         step: 1
        //     },
        //     defaultValue: 2,
        //     tooltip: "Border size, 0 for invisible, overlayed and unselectable, not part of the node ouptut",
        //
        //     onChange: (newVal, oldVal) => {
        //         console.log(newVal, this);
        //     },
        // });

        // app.ui.settings.addSetting({
        //     id: "Compositor.Composition.COMPOSITION_BACKGROUND_COLOR",
        //     name: "Background Color - Output",
        //     type: "text",
        //     tooltip: "give hex code with alpha eg.: #00b300b0, this will help identifying what is withing the output",
        //     defaultValue: "#00b300b0",
        //     onChange: (newVal, oldVal) => {
        //         console.log(newVal, this);
        //     },
        // });


        // need to have a unique node key
        // and leverage theImage.cacheKey if it's the same image, do nothing
        function addOrReplace(theImage, index, nodeId) {
            //
            // console.log(app.graph.getNodeById(nodeId));
            const node = app.graph.getNodeById(nodeId);
            // debugger;
            if (node.stuff[imageNameAt(index)] == null) {
                node.stuff[imageNameAt(index)] = theImage;
                node.stuff.canvas.add(theImage);

                //
            }

            if (stuffHasImageAtIndex(node, index)) {
                const oldTransform = getOldTransform(node, index);
                // Remove the old image from the canvas
                node.stuff.canvas.remove(node.stuff[imageNameAt(index)]);
                theImage.set(oldTransform);
                node.stuff.canvas.add(theImage);
                node.stuff[imageNameAt(index)] = theImage;
            }
            // node.stuff.canvas.bringToFront(node.stuff.compositionBorder)
        }

        /**
         * once the node processes in python, we finally know from the event
         * what are the connected images
         * they are passed as base64 encoded or null if not connected
         * and the unique name id of the node.
         * @param event
         *
         */
        function imageMessageHandler(event) {
            const nodeId = event.detail.node;
            // as base64 or null, always at same index
            const images = [...event.detail.names];

            images.map((b64, index) => {

                fabric.Image.fromURL(b64, function (oImg) {
                    addOrReplace(oImg, index, nodeId);
                });
                // stuff.canvas.renderAll();
            });
        }

        api.addEventListener("compositor.images", imageMessageHandler);
    },
    /**
     * Called when the Comfy webpage is loaded (or reloaded).
     * The call is made after the graph object has been created,
     * but before any nodes are registered or created.
     * It can be used to modify core Comfy behavior by hijacking methods of the app, or of the graph
     * (a LiteGraph object).
     * This is discussed further in Comfy Objects.
     */
    // async init(args) {
    //     console.log("init", args)
    // },
    /**
     * Called once for each node type (the list of nodes available in the AddNode menu), and is used to modify the behaviour of the node.
     *
     * async beforeRegisterNodeDef(nodeType, nodeData, app)
     * The object passed in the nodeType parameter essentially serves as a template for all nodes that will be created of this type,
     * so modifications made to nodeType.prototype will apply to all nodes of this type.
     * nodeData is an encapsulation of aspects of the node defined in the Python code,
     * such as its category, inputs, and outputs.
     * app is a reference to the main Comfy app object (which you have already imported anyway!)
     */
    // async beforeRegisterNodeDef(nodeType, nodeData, app) {
    //
    //     if (nodeType.comfyClass == 'Compositor') {
    // //         console.log("beforeRegisterNodeDef", nodeType, nodeData, app);
    //
    //         const orig_nodeCreated = nodeType.prototype.onNodeCreated;
    //         nodeType.prototype.onNodeCreated = async function () {
    //             // console.log("onNodeCreated", this);
    //             orig_nodeCreated?.apply(this, arguments)
    //             this.setSize([this.stuff.v.getWidth() + 100, this.stuff.v.getHeight() + 556])
    //         }
    //
    //         const onExecuted = nodeType.prototype.onExecuted;
    //         nodeType.prototype.onExecuted = function (message) {
    //             // console.log("onExecuted", this, message);
    //             const r = onExecuted?.apply?.(this, arguments)
    //             return r;
    //         }
    //     }
    //

    // },
    /** loadedGraphNode */
    async loadedGraphNode(node, app) {
        // node.type == "Compositor" && console.log("loadedGraphNode", node, app, node.stuff);

        // const ns = node.stuff;
        //
        // ns.compositionArea.setHeight(ns.h.value);
        // ns.compositionArea.setWidth(ns.w.value);
        // ns.compositionArea.setLeft(ns.p.value);
        // ns.compositionArea.setTop(ns.p.value);
        //
        // ns.compositionBorder.setHeight(ns.h.value + 2);
        // ns.compositionBorder.setWidth(ns.w.value + 2);
        // ns.compositionBorder.setLeft(ns.p.value - 1);
        // ns.compositionBorder.setTop(ns.p.value - 1);
        // ns.compositionBorder.set("strokeWidth", 1);
        // ns.compositionBorder.set("stroke", IMAGE_BOUNDARY_AREA_BORDER_COLOR);
        // ns.compositionBorder.bringToFront()
        //
        // ns.canvas.bringToFront(ns.compositionBorder);
        //
        // //console.log(v.getWidth(), v.getHeight(), value);
        // ns.v.setHeight(ns.compositionArea.getHeight() + (ns.p.value * 2));
        // ns.v.setWidth(ns.compositionArea.getWidth() + (ns.p.value * 2));
        // ns.v.renderAll();
        // ns.node.setSize([ns.v.getWidth() + 100, ns.v.getHeight() + 556]);
        // ns.capture();

    },
    /**
     * Called when a specific instance of a node gets created
     * (right at the end of the ComfyNode() function on nodeType which serves as a constructor).
     * In this hook you can make modifications to individual instances of your node.
     *
     * node ref
     * https://docs.comfy.org/essentials/javascript_objects_and_hijacking
     */
    async nodeCreated(node) {
        if ((node.type, node.constructor.comfyClass !== "Compositor")) return;
        // node.stuff.SAFE_AREA_BORDER_SIZE = 2;
        // console.log("nodeCreated", node)


        const composite = node.widgets.find((w) => w.name === "image");
        const w = node.widgets.find((w) => w.name === "width");
        const h = node.widgets.find((w) => w.name === "height");
        const p = node.widgets.find((w) => w.name === "padding");
        const captureOnQueue = node.widgets.find((w) => w.name === "capture_on_queue");

        const v = createCanvas(node.stuff.canvasId);


        /**
         * the actual area of WxH dimensions that will be exported as output
         */
        var compositionArea = createCompositionArea(p, w, h);

        var compositionBorder = createCompositionBorder(p, w, h, node);
        //
        compositionBorder.set("strokeWidth", node.stuff.COMPOSITION_BORDER_SIZE);
        compositionBorder.set("stroke", node.stuff.COMPOSITION_BORDER_COLOR);
        node.stuff.compositionBorder = compositionBorder;

        v.add(compositionArea);
        // v.add(compositionBorder);
        // v.bringToFront(compositionBorder);

        w.origCalback = w.callback;
        w.callback = (value, graphCanvas, node, pos, event) => {

            v.setWidth(value + (p.value * 2));
            compositionArea.setWidth(value);
            compositionBorder.setWidth(value + node.stuff.COMPOSITION_BORDER_SIZE);
            node.setSize(calculateWidgetSize(v))

            v.renderAll();
        }

        h.origCalback = h.callback;
        h.callback = (value, graphCanvas, node, pos, event) => {

            v.setHeight(value + (p.value * 2));
            compositionArea.setHeight(value);
            //compositionBorder.setHeight(value + 2);

            node.setSize(calculateWidgetSize(v))
            v.renderAll();
        }

        // padding change
        p.origCallback = p.callback;
        p.callback = (value, graphCanvas, node, pos, event) => {

            compositionArea.setHeight(h.value);
            compositionArea.setWidth(w.value);
            compositionArea.setLeft(value);
            compositionArea.setTop(value);

            compositionBorder.setHeight(h.value + node.stuff.COMPOSITION_BORDER_SIZE*2);
            compositionBorder.setWidth(w.value + node.stuff.COMPOSITION_BORDER_SIZE*2);
            compositionBorder.setLeft(value - node.stuff.COMPOSITION_BORDER_SIZE);
            compositionBorder.setTop(value - node.stuff.COMPOSITION_BORDER_SIZE);

            v.setHeight(compositionArea.getHeight() + (value * 2));
            v.setWidth(compositionArea.getWidth() + (value * 2));
            v.renderAll();
            node.setSize(calculateWidgetSize(v))
        }

        /** the fabric canvas:v */
        node.stuff.canvas = v;

        // final image to be associated to the node preview
        const img = new Image();


        // data url
        let data = null;
        const capture = () => {
            data = v.toDataURL({
                format: 'jpeg',
                quality: 0.8,
                left: p.value,
                top: p.value,
                width: w.value,
                height: h.value
            });
            img.onload = () => {
                node.imgs = [img];
                app.graph.setDirtyCanvas(true);
                requestAnimationFrame(() => {
                    node.setSizeForImage?.();
                });
            };
            img.src = data;
        };

        // grab some references in the node.
        // hopefully they are not serialized :D

        setupReferences(node, p, w, h, v, composite, img, compositionArea, capture);


        const btn = node.addWidget("button", "capture", "capture", capture);


        btn.serializeValue = () => undefined;
        // composite is the input node widget that's mapped to the output, in practice we are pretending we
        // gave the composite as input
        composite.serializeValue = async () => {
            // we can simply return a path, of an ideally uploaded file and be happy with it
            try {
                if (captureOnQueue.value) {
                    capture();
                } else if (!node.imgs?.length) {
                    const err = `Composition not saved`;
                    throw new Error(err);
                }
                // remove selection if any or it would render
                v.discardActiveObject().renderAll();

                // attempt creating an image
                let blob = dataURLToBlob(data)

                // do we have anything stored ?
                if (isImageStored(node)) {
                    // if no, it's likely the first run, go on with the blob
                } else {
                    // else, check if the image stored in the node as last upload is the same as the one we are making
                    // by comparing the checksums
                    node.stuff.c1 = await getChecksumSha256(node.stuff.cblob);
                    node.stuff.c2 = await getChecksumSha256(blob);
                    // console.log(node.stuff.c1, node.stuff.c2, node.stuff.c1 == node.stuff.c2);
                    node.stuff.sameHash = node.stuff.c1 == node.stuff.c2;
                    console.log("new image ? ", node.stuff.sameHash ? "yes" : "no");
                    if (node.stuff.sameHash) {
                        // exit early, don't re-upload if it is the same content !!!
                        return node.stuff.lastUpload;
                    }
                }
                node.stuff.cblob = blob;

                /**
                 * Upload image to temp storage,
                 * the image will be in the compositor subfolder of temp, not input
                 * then store the name last upload
                 */
                node.stuff.lastUpload = await uploadImage(blob)

                return node.stuff.lastUpload;
            } catch (e) {
                // we have nothing so...well..just pretend
                return TEST_IMAGE_2;
            }

        };

        node.setSize(calculateWidgetSize(v))
        capture();


    },
});


