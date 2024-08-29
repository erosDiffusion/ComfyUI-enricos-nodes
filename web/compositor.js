// author: erosdiffusionai@gmail.com
import {app} from "../../scripts/app.js";
import {api} from "../../scripts/api.js";

import {fabric} from "./fabric.js";


const COMPOSITOR = Symbol();
const TEST_IMAGE_2 = "./extensions/ComfyUI-enricos-nodes/empty.png"

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


app.registerExtension({
    name: "Comfy.Compositor",
    async getCustomWidgets(app) {
        return {
            COMPOSITOR(node, inputName, inputData, app) {

                const array = new Uint32Array(10);
                const compositorId = 'c_' + self.crypto.getRandomValues(array)[0] + '_' + self.crypto.getRandomValues(array)[1];
                node.stuff = {
                    canvasId: compositorId,
                    canvas: null,
                    safeAreaBorder: null,
                    c1: "",
                    c2: "",
                    cblob: undefined,
                    lastUpload: undefined,
                }

                // console.log("getCustomWidgets", node, node.id, inputName, inputData, app, node.stuff);
                let res;
                node[COMPOSITOR] = new Promise((resolve) => (res = resolve));

                const container = document.createElement("div");
                container.style.background = "rgba(0,0,0,0.25)";
                container.style.textAlign = "center";

                const canvas = document.createElement("canvas");
                canvas.id = node.stuff.canvasId;
                canvas.style = 'outline:1px solid red';
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
     * both of which are discussed elsewhere.     *
     */
    async setup(app) {

        // need to have a unique node key
        // and leverage theImage.cacheKey if it's the same image, do nothing
        function addOrReplace(theImage, index, nodeId) {
            //
            // console.log(app.graph.getNodeById(nodeId));
            const node = app.graph.getNodeById(nodeId);
            // debugger;
            if (node.stuff['image' + (index + 1)] == null) {
                node.stuff['image' + (index + 1)] = theImage;
                node.stuff.canvas.add(theImage);

                //
            }

            if (node.stuff['image' + (index + 1)] != null) {

                const oldTransform = {
                    left: node.stuff['image' + (index + 1)].left,
                    top: node.stuff['image' + (index + 1)].top,
                    scaleX: node.stuff['image' + (index + 1)].scaleX,
                    scaleY: node.stuff['image' + (index + 1)].scaleY,
                    angle: node.stuff['image' + (index + 1)].angle,
                    flipX: node.stuff['image' + (index + 1)].flipX,
                    flipY: node.stuff['image' + (index + 1)].flipY,
                    originX: node.stuff['image' + (index + 1)].originX,
                    originY: node.stuff['image' + (index + 1)].originY,
                };

                // Remove the old image from the canvas
                node.stuff.canvas.remove(node.stuff['image' + (index + 1)]);
                theImage.set(oldTransform);
                node.stuff.canvas.add(theImage);
                node.stuff['image' + (index + 1)] = theImage;
            }
            // node.stuff.canvas.bringToFront(node.stuff.safeAreaBorder)
        }

        function imageMessageHandler(event) {
            // base 64 content of the image
            // console.log(event, event.detail);
            const nodeId = event.detail.node;
            const images = [...event.detail.names]

            images.map((b64, index) => {
                // console.log(b64);
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
        // ns.safeArea.setHeight(ns.h.value);
        // ns.safeArea.setWidth(ns.w.value);
        // ns.safeArea.setLeft(ns.p.value);
        // ns.safeArea.setTop(ns.p.value);
        //
        // ns.safeAreaBorder.setHeight(ns.h.value + 2);
        // ns.safeAreaBorder.setWidth(ns.w.value + 2);
        // ns.safeAreaBorder.setLeft(ns.p.value - 1);
        // ns.safeAreaBorder.setTop(ns.p.value - 1);
        // ns.safeAreaBorder.set("strokeWidth", 1);
        // ns.safeAreaBorder.set("stroke", "#00b300b0");
        // ns.safeAreaBorder.bringToFront()
        //
        // ns.canvas.bringToFront(ns.safeAreaBorder);
        //
        // //console.log(v.getWidth(), v.getHeight(), value);
        // ns.v.setHeight(ns.safeArea.getHeight() + (ns.p.value * 2));
        // ns.v.setWidth(ns.safeArea.getWidth() + (ns.p.value * 2));
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

        // console.log("nodeCreated", node)

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

        const camera = node.widgets.find((w) => w.name === "image");
        const w = node.widgets.find((w) => w.name === "width");
        const h = node.widgets.find((w) => w.name === "height");
        const p = node.widgets.find((w) => w.name === "padding");
        const hash = node.widgets.find((w) => w.name === "hash");
        const captureOnQueue = node.widgets.find((w) => w.name === "capture_on_queue");

        const v = new fabric.Canvas(node.stuff.canvasId, {
            backgroundColor: 'transparent',
            selectionColor: 'transparent',
            selectionLineWidth: 1,
            // F-10 preserve object stacking
            preserveObjectStacking: true,
        });


        // the actual area of WxH with the composition
        var safeArea = new fabric.Rect({
            left: p.value,
            top: p.value,
            fill: 'rgba(0,0,0,0.2)',
            width: w.value,
            height: h.value,
            selectable: false,
        });

        // var safeAreaBorder = new fabric.Rect({
        //     left: p.value - 2,
        //     top: p.value - 2,
        //     fill: 'rgba(0,0,0,0.0)',
        //     width: w.value + 2,
        //     height: h.value + 2,
        //     selectable: false,
        // });
        //
        // safeAreaBorder.set("strokeWidth", 2);
        // safeAreaBorder.set("stroke", "#00b300b0");

        // node.stuff.safeAreaBorder = safeAreaBorder;

        v.add(safeArea);
        // v.add(safeAreaBorder);
        // v.bringToFront(safeAreaBorder);

        w.origCalback = w.callback;
        w.callback = (value, graphCanvas, node, pos, event) => {
            //w.origCalback(value, graphCanvas, node, pos, event);
            v.setWidth(value + (p.value * 2));
            safeArea.setWidth(value);
            // safeAreaBorder.setWidth(value + 2);

            node.setSize([v.getWidth() + 100, v.getHeight() + 556])
            //node.setSize({value+20,node.size[1]});
            v.renderAll();
        }

        h.origCalback = h.callback;
        h.callback = (value, graphCanvas, node, pos, event) => {
            //h.origCalback(value, graphCanvas, node, pos, event);
            v.setHeight(value + (p.value * 2));
            safeArea.setHeight(value);
            //safeAreaBorder.setHeight(value + 2);

            node.setSize([v.getWidth() + 100, v.getHeight() + 556])
            v.renderAll();
        }

        // padding change
        p.origCalback = p.callback;
        p.callback = (value, graphCanvas, node, pos, event) => {
            //p.origCalback(value, graphCanvas, node, pos, event);

            safeArea.setHeight(h.value);
            safeArea.setWidth(w.value);
            safeArea.setLeft(value);
            safeArea.setTop(value);

            // safeAreaBorder.setHeight(h.value + 2);
            // safeAreaBorder.setWidth(w.value + 2);
            // safeAreaBorder.setLeft(value - 2);
            // safeAreaBorder.setTop(value - 2);


            //console.log(v.getWidth(), v.getHeight(), value);
            v.setHeight(safeArea.getHeight() + (value * 2));
            v.setWidth(safeArea.getWidth() + (value * 2));
            v.renderAll();
            node.setSize([v.getWidth() + 100, v.getHeight() + 556])
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

        node.stuff.p = p;
        node.stuff.w = w;
        node.stuff.h = h;
        /** the fabric canvas:v */
        node.stuff.v = v;
        node.stuff.camera = camera;
        node.stuff.i = img;
        node.stuff.safeArea = safeArea;
        //node.stuff.safeAreaBorder = safeAreaBorder;
        node.stuff.capture = capture;
        node.stuff.hash = hash.value;


        const btn = node.addWidget("button", "capture", "capture", capture);

        // hash.serializeValue = async (args) => {
        //     console.log("hash serialize",hash.value,args);
        //     return args;
        // }

        btn.serializeValue = () => undefined;
        // camera is the input node widget that's mapped to the output, in practice we are pretending we
        // gave the composite as input
        camera.serializeValue = async () => {
            // we can simply return a path, of an ideally uploaded file and be happy with it
            try {
                if (captureOnQueue.value) {
                    capture();
                } else if (!node.imgs?.length) {
                    const err = `Composition not saved`;
                    throw new Error(err);
                }
                // remove selection if any
                v.discardActiveObject().renderAll();
                // debugger;
                // attempt creating an image

                /**
                 * clunky check if the image is different
                 */
                let blob = dataURLToBlob(data)

                if (node.stuff.cblob == undefined) {
                    // go on with the blob
                } else {
                    // check if it's a new image
                    node.stuff.c1 = await getChecksumSha256(node.stuff.cblob);
                    node.stuff.c2 = await getChecksumSha256(blob);
                    console.log(node.stuff.c1, node.stuff.c2, node.stuff.c1 == node.stuff.c2);
                    node.stuff.sameHash = node.stuff.c1 == node.stuff.c2;
                    if (node.stuff.sameHash) {
                        hash.value = node.stuff.c2;
                        // exit early, dont re-upload
                        return node.stuff.lastUpload;
                    } else {
                        hash.value = node.stuff.c1;
                    }
                }
                node.stuff.cblob = blob;

                // const blob = await new Promise((r) => canv.toBlob(r));
                // const blob = await new Promise((r) => safeArea.toBlob(r));

                // Upload image to temp storage

                const name = `${+new Date()}.png`;
                const file = new File([blob], name);
                const body = new FormData();
                body.append("image", file);
                body.append("subfolder", "compositor");
                body.append("type", "temp");
                const resp = await api.fetchApi("/upload/image", {
                    method: "POST",
                    body,
                });
                if (resp.status !== 200) {
                    const err = `Error uploading composition image: ${resp.status} - ${resp.statusText}`;
                    throw new Error(err);
                }
                node.stuff.lastUpload = `compositor/${name} [temp]`;
                return node.stuff.lastUpload;
            } catch (e) {
                // we have nothing so...well..just pretend
                return TEST_IMAGE_2;
            }

        };

        node.setSize([v.getWidth() + 100, v.getHeight() + 556])
        capture();


    },
});

async function getChecksumSha256(blob) {
    const uint8Array = new Uint8Array(await blob.arrayBuffer());
    const hashBuffer = await crypto.subtle.digest('SHA-256', uint8Array);
    const hashArray = Array.from(new Uint8Array(hashBuffer));

    return hashArray.map((h) => h.toString(16).padStart(2, '0')).join('');
    // if you like, it, yan can buy me a coffee https://paypal.me/bilelz/1000000
}
