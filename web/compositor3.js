import {app} from "../../scripts/app.js";
import {api} from "../../scripts/api.js";
import { fabric } from "./fabric.js";


/** check if this is a Compositor3 node */
function isCompositor3(node) {
    return node.constructor.comfyClass == "Compositor3";
}

function isCompositorConfig3(node) {
    return node.constructor.comfyClass == "CompositorConfig3";
}

function getCompositorWidget(node, widgetName) {
    return node.widgets.find((w) => w.name === widgetName);
}

function handleTogglePreciseSelection(e, currentNode) {
    const optionValue = e.data.value;
    currentNode.compositorInstance.preciseSelection = optionValue;
    const c = currentNode.compositorInstance.fcanvas;
    c.getObjects().map(function (i) {
        return i.set('perPixelTargetFind', optionValue);
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
    c.getActiveObjects().forEach((o)=>o.center());
    c.renderAll();
    instance.uploadIfNeeded(instance);
    // c.getObjects().forEach(function (image, index) {
    //     instance.resetOldTransform(index);
    //
    // });
}

/**
 * registering an extension gives the possibility to tap into lifecycle methods
 * here is the sequence from the docs:

 * api events
 * 0: "status"
 * 1: "graphChanged"
 * 2: "promptQueued"
 * 3: "graphCleared"
 * 4: "executed"
 * 5: "execution_start"
 * 6: "execution_cached"
 * 7: "executing"
 * 8: "reconnecting"
 * 9: "reconnected"
 * 10: "manager-terminal-feedback"
 * 11: "cm-api-try-install-customnode"
 * 12: "progress"
 * 13: "execution_error"
 * 14: "b_preview"
 * 15: "crystools.monitor"
 * 16: "configure"
 * 17: "compositor.images"

 * -- Web page load --
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
 *
 * -- Loading workflow --
 * invokeExtensionsAsync beforeConfigureGraph
 * invokeExtensionsAsync beforeRegisterNodeDef   [zero, one, or multiple times]
 * invokeExtensionsAsync nodeCreated             [repeated multiple times]
 * invokeExtensions      loadedGraphNode         [repeated multiple times]
 * invokeExtensionsAsync afterConfigureGraph
 *
 * -- Adding new node --
 * invokeExtensionsAsync nodeCreated
 *
 *
 * more info about what the hell a node is etc
 * https://docs.comfy.org/essentials/javascript_objects_and_hijacking
 */
app.registerExtension({
    name: "Comfy.Compositor3",

    async getCustomWidgets(app) {
        // no custom widgets
    },
    /**
     * Called at the end of the startup process.
     * A good place to add event listeners (either for Comfy events, or DOM events), or adding to the global menus,
     * at this point we get a nodeId from a message (if we pass it) but have no node context, so we need to find it.
     *
     * Capture UI events
     * This works just like you’d expect - find the UI element in the DOM and add an eventListener.
     * setup() is a good place to do this, since the page has fully loaded.
     * For instance, to detect a click on the ‘Queue’ button:
     * ```
     *      function queue_button_pressed() { console.log("Queue button was pressed!") }
     *      document.getElementById("queue-button").addEventListener("click", queue_button_pressed);
     * ```
     */
    async setup(app) {
        Editor.addCompositorSettings();

        /**
         * @deprecated
         * once the node processes in python, we finally know from the event
         * what are the connected images
         * they are passed as base64 encoded or null if not connected
         * and the unique name id of the node.
         * @param event
         *
         */
        function imageMessageHandler(event) {
        }

        function hook(nodeId) {
            return app.graph.getNodeById(nodeId);
        }


        /** example of arbitrary messages
         PromptServer.instance.send_sync("my.custom.message", {"node": node_id, "other_things": etc})
         in api.ts search for "case 'executing'": for all events emitted or "new CustomEvent('executing'"
         example of built-in, this should be when a node is about to start processing (in the back?)
         */
        function executingMessageHandler(event) {
            //console.log("executingMessageHandler", event, arguments);
            const current = app.graph.getNodeById(event.detail);

            // probably too later here as it's already running in the back
            // if (current && current.type == "Compositor3") {
            //     const instance = current.compositorInstance;
            //     if (instance.captureOnQueue.value) {
            //         //instance.capture();
            //         instance.grabUploadAndSetOutput.bind(instance);
            //     }
            // }

            // if pause
            // if (getConfigWidgetValue(current, 4)) {
            //     interrupt();
            // }

            // }
        }

        /**
         * handle progress message sent during .py execution
         */
        function progressHandler() {
            // need to filter by node id
            // console.log(arguments);
        }

        /** when a node "returns" an ui element, usually at the end of processing */
        function executedMessageHandler(event, a, b) {
            //console.log("executedMessageHandler", event, a, b);

            // Litegraph docs
            // https://github.com/jagenjo/litegraph.js/blob/master/guides/README.md
            // get stuff connected to this config also...careful with the gui now...

            const e = event.detail.output;
            const nodeId = event.detail.node;
            const node = Editor.hook(nodeId);
            if (!node || node.type != "Compositor3") {
                // console.log(node.type);
                return;
            }
            const instance = node.compositorInstance;
            // console.log("hasResult,awaitedResult", e.hasResult[0], e.awaited[0]);

            node.compositorInstance.w.value = e.width[0];
            node.compositorInstance.h.value = e.height[0];
            node.compositorInstance.p.value = e.padding[0];
            node.compositorInstance.onWidthChange(e.width[0]);
            node.compositorInstance.onHeightChange(e.height[0]);
            node.compositorInstance.onPaddingChange(e.padding[0]);
            // node.compositorInstance.onCaptureOnQueueChange(e.captureOnQueue[0]);

            const images = [...e.names];

            const restore = Editor.deserializeStuff(node.fabricDataWidget.value);
            const shouldRestore = restore ?? false; // Editor.getConfigWidgetValue(node, 3);
            const normalizeHeight = Editor.getConfigWidgetValue(node, 3);
            const onConfigChanged = Editor.getConfigWidgetValue(node, 4);

            instance.normalizeHeigh = normalizeHeight;
            instance.onConfigChanged = onConfigChanged;
            instance.configChanged = e.configChanged[0];

            images.map((b64, index) => {
                function fromUrlCallback(oImg) {
                    node.compositorInstance.addOrReplaceImage(oImg, index, nodeId, restore, shouldRestore);
                }

                /**
                 * fabric.Image.fromURL
                 * http://fabricjs.com/docs/fabric.Image.html
                 */
                fabric.Image.fromURL(b64, fromUrlCallback);

            });

            if(instance.configChanged) {

                instance.needsUpload = true;

                // true: grab and continue
                if(onConfigChanged){
                    console.log("upload and continue")

                    const reEnqueue = () => {
                        console.log("upload and continue")
                        interrupt();
                        instance.continue();
                    }

                    instance.uploadIfNeeded(instance, reEnqueue);


                }else{
                    // False, stop
                    instance.uploadIfNeeded(instance)
                    console.log("stopped, just upload")
                }

            }

            //     console.log("configChanged",instance.configChanged);
            //     // if(instance.onConfigChanged == "grabAndContinue"){
            //     //     console.log("grabAndContinue")
            //     //     instance.needsUpload = true;
            //     //     console.log("set instance needs upload to ", instance.needsUpload)
            //     //     const reEneuque = () => {
            //     //         app.queuePrompt(0, 1);
            //     //     }
            //     //     instance.uploadIfNeeded(instance,reEneuque);
            //     // }else{
            //
            //         console.log("stop:config")
            //         instance.needsUpload = true;
            //         console.log("set instance needs upload to ", instance.needsUpload)
            //
            // }else{
            //     instance.needsUpload = false;
            //     console.log("config did not hcange, needs upload set to ", instance.needsUpload)
            // }

        }

        /** important messaging considerations  https://docs.comfy.org/essentials/comms_messages */

        function configureHandler() {
            //console.log("configurehanlder", arguments);
        }

        function executionStartHandler() {
            //console.log("executionStartHandler", arguments);
        }

        function executionCachedHandler() {
            //console.log("executionCachedHandler", arguments);
        }

        function graphChangedHandler() {
            console.log("graphChangedHandler", arguments);
        }

        function changeWorkflowHandler() {
            //console.log("changeWorkflowHandler", arguments);
        }


        // change_workflow
        // global on_change for node and widgets

        api.addEventListener("compositor_init", executedMessageHandler);
        api.addEventListener("graphChanged", graphChangedHandler);
        api.addEventListener("change_workflow", changeWorkflowHandler);
        api.addEventListener("execution_start", executionStartHandler);
        api.addEventListener("execution_cached", executionCachedHandler);
        api.addEventListener("executing", executingMessageHandler);
        /** when a node returns an ui element */
        api.addEventListener("executed", executedMessageHandler);
        /**
         * test "progress" received during .py execution
         */
        api.addEventListener("progress", progressHandler);
        /** ? */
        api.addEventListener("configure", configureHandler);


    },
    /**
     * Called when the Comfy webpage is loaded (or reloaded).
     * The call is made after the graph object has been created,
     * but before any nodes are registered or created.
     * It can be used to modify core Comfy behavior by hijacking methods of the app, or of the graph
     * (a LiteGraph object).
     * This is discussed further in Comfy Objects.
     */
    async init(args) {
        // console.log("init", args)
    },
    /**
     * Called once for each node type (the list of nodes available in the AddNode menu),
     * and is used to modify the behaviour of the node.
     *
     * async beforeRegisterNodeDef(nodeType, nodeData, app)
     * The object passed in the nodeType parameter serves as a template for all nodes that will be created of this type.
     * The modifications made to "nodeType.prototype" will apply to all nodes of this type.
     * nodeData is an encapsulation of aspects of the node defined in the Python code,
     * such as its category, inputs, and outputs.
     * app is a reference to the main Comfy app object (which you have already imported anyway!)
     ```
     async beforeRegisterNodeDef(nodeType, nodeData, app) {

        if (nodeType.comfyClass == 'Compositor') {
          //  console.log("beforeRegisterNodeDef", nodeType, nodeData, app);

            const orig_nodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = async function () {
                // console.log("onNodeCreated", this);
                orig_nodeCreated?.apply(this, arguments)
                this.setSize([this.stuff.v.getWidth() + 100, this.stuff.v.getHeight() + 556])
            }

            const onExecuted = nodeType.prototype.onExecuted;
            nodeType.prototype.onExecuted = function (message) {
                // console.log("onExecuted", this, message);
                const r = onExecuted?.apply?.(this, arguments)
                return r;
            }
        }
    },
     ```
     */
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        // chainCallback(nodeType.prototype, "onNodeCreate, createdCallback(){
        // this is the node here, we can add widgets, hide them, add button, add property to widgets
        // in this case he's addn the whole point editor or resetting this in case it does or does not have
        // certain properties, like points
        // same place for onConfigure and onExecuted
        //}
        // console.log("beforeRegisterNodeDef",nodeType,nodeData);
        // KJ initailizes the node here
        // with a callback for onNodeCreated
        // nodeType.prototype.capture = ()=>{
        //     console.log(this,arguments);
        // }
    },
    /** loadedGraphNode, after nodeCreated
     *  ```
     if(node.type == "Compositor" && console.log("loadedGraphNode", node, app, node.stuff)){
         const ns = node.stuff;

         ns.safeArea.setHeight(ns.h.value);
         ns.safeArea.setWidth(ns.w.value);
         ns.safeArea.setLeft(ns.p.value);
         ns.safeArea.setTop(ns.p.value);

         ns.compositionBorder.setHeight(ns.h.value + ns.stuff.COMPOSITION_BORDER_SIZE*2);
         ns.compositionBorder.setWidth(ns.w.value  + ns.stuff.COMPOSITION_BORDER_SIZE*2);
         ns.compositionBorder.setLeft(ns.p.value - ns.stuff.COMPOSITION_BORDER_SIZE);
         ns.compositionBorder.setTop(ns.p.value - ns.stuff.COMPOSITION_BORDER_SIZE*2);
         ns.compositionBorder.set("strokeWidth", ns.stuff.COMPOSITION_BORDER_SIZE);
         ns.compositionBorder.set("stroke", ns.stuff.COMPOSITION_BORDER_COLOR);
         ns.compositionBorder.bringToFront()

         canvas.bringToFront(ns.compositionBorder);

         //console.log(v.getWidth(), v.getHeight(), value);
         ns.canvas.setHeight(ns.safeArea.getHeight() + (ns.p.value * 2));
         ns.canvas.setWidth(ns.safeArea.getWidth() + (ns.p.value * 2));
         ns.canvas.renderAll();
         ns.node.setSize(calculateNodeSize(v));

         ns.capture();
         }
     ```
     */
    async loadedGraphNode(node, app) {
        //  console.log("loadedGraphNode");
    },
    async afterConfigureGraph(args) {
        // To do something when a workflow has loaded, use afterConfigureGraph, not setup
        // console.log("afterConfigureGraph", args);
        
        // reset the config timestamp, to ensure re-triggering
        const configs = app.graph.findNodesByType("CompositorConfig3");
        configs.forEach((c) => {
            const initialized = getCompositorWidget(c, "initialized");
            initialized.value = Date.now();
        })

        

        // enable nodes to talk to each other without running the frontend through a dedicated
        // broadcast channel
        //
        // setup broadcast channel, also needs to be done on node created or connection change...
        const nodes = app.graph.findNodesByType("Compositor3");
        
        // probably too late here as it's already running in the back
        nodes.forEach((currentNode) => {
            const tools = currentNode.getInputNode(1);

            
            
            // Add this null check
            if (!tools) {
                console.log("No tools node connected to input 1 for Compositor3 node:", currentNode.id);
                return; // Skip this node
            }

            const CHANNELNAME = `Tools${tools.id}`;


            //console.log(CHANNELNAME)
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
                        console.log("unknown broadcast event", e);
                }


            });

            currentNode.channel = channel;


            //  console.log("looping afterconfiguregraph compostior node", current);
            //  console.log("looping afterconfiguregraph compostior node configs", config);
        })
        app.graph.setDirtyCanvas(true, true);
    },
    /**
     * Called when a **specific instance** of a node gets created
     * (right at the end of the ComfyNode() function on nodeType which serves as a constructor).
     * In this hook you can make modifications to **individual instances** of your node.
     * nde: whereas **before register node def is better for prototype changes** (??)
     * node ref
     * https://docs.comfy.org/essentials/javascript_objects_and_hijacking
     *
     * not the same nodeCreated event available in beforeRegisterNodeDef prototype (that one is aproptotype node class instance)
     */
    async nodeCreated(node) {
        if (!isCompositor3(node)) return;

        /** our output composite image */
        //node.compositionChangedWidget = getCompositorWidget(node, "compositionChanged");
        node.imageNameWidget = getCompositorWidget(node, "imageName");
        const originalCallback = node.imageNameWidget.callback;
        node.imageNameWidget.callback = () => {
            //debugger;
            //console.log("callback of imageNameWidget with ", arguments);
            originalCallback(arguments);
        }
        node.imageNameWidget.computeSize = () => [0, 0];
        // imageName.computeSize = () => [0, 0];
        hideWidgetForGood(node, node.imageNameWidget);
        node.configWidget = getCompositorWidget(node, "config");


        node.fabricDataWidget = getCompositorWidget(node, "fabricData");
        node.fabricDataWidget.computeSize = () => [0, 0];
        hideWidgetForGood(node, node.fabricDataWidget);


        // make sure when we reload the widget will be re-executed
        const firstRun = Editor.deserializeStuff(node.fabricDataWidget.value);
        firstRun["firstRun"] = Date.now();
        node.fabricDataWidget.value = JSON.stringify(firstRun);

        const containerDiv = Editor.createCompositorContainerDiv(node)
        
        const c = document.createElement("canvas");
        c.id= "c_" + node.id;
        containerDiv.appendChild(c);
        
        
        
        node.editorWidget = node.addDOMWidget("test", "test", containerDiv, {
            //serialize: false,
            hideOnZoom: false,
        });
        const fc = new fabric.Canvas(c,{        
            backgroundColor: 'transparent',
            selectionColor: 'transparent',
            selectionLineWidth: 1,            
            preserveObjectStacking: true,
            altSelectionKey: "ctrlKey",
            altActionKey: "ctrlKey",
            centeredKey: "altKey",            
        });
        

        /** initialize the compositor gui widget */
        const compositorInstance = new Editor(node, containerDiv);
        compositorInstance.initFabric(fc);


       

        /**
         * grabUploadAndSetOutput callback can't be async so pass the widget in upload image
         * addWidget(type, name, value, callback, options)
         */
        //node.capture = node.addWidget("button", "capture", "capture", compositorInstance.grabUploadAndSetOutput.bind(compositorInstance));
        node.continue = node.addWidget("button", "continue", "continue", compositorInstance.continue.bind(compositorInstance));

        node.onMouseOut = function (e, pos, canvas) {
            // console.log("mouseout")
            const original_onMouseDown = node.onMouseOut;
            return original_onMouseDown?.apply(this, arguments);
        }
        //node.compositorInstance = compositorInstance;
    },
});


//from melmass
function hideWidgetForGood(node, widget, suffix = '') {
    widget.origType = widget.type
    widget.origComputeSize = widget.computeSize
    widget.origSerializeValue = widget.serializeValue
    widget.computeSize = () => [0, -4] // -4 is due to the gap litegraph adds between widgets automatically
    widget.type = "converted-widget" + suffix
    // widget.serializeValue = () => {
    //     // Prevent serializing the widget if we have no input linked
    //     const w = node.inputs?.find((i) => i.widget?.name === widget.name);
    //     if (w?.link == null) {
    //         return undefined;
    //     }
    //     return widget.origSerializeValue ? widget.origSerializeValue() : widget.value;
    // };

    // Hide any linked widgets, e.g. seed+seedControl
    if (widget.linkedWidgets) {
        for (const w of widget.linkedWidgets) {
            hideWidgetForGood(node, w, ':' + widget.name)
        }
    }
}

/** will be added on node created to the node via addDOMWidget */
class Editor {
    id;
    canvasEl;
    /** the fabric canvas */
    fcanvas;
    /** the dom element that's passed to addDomWidget */
    containerDiv;
    /** contains the last image, i probably just need the hash anyways */
    cblob;
    /** the hash of the current image in blob */
    c1;
    /** the hash of the new blob to be checked */
    c2;
    /** if c1 === c2*/
    sameHash;
    /** the selected objec in fcanvas, for manipulation events*/
    selected;

    /** settings */
    CANVAS_BORDER_COLOR = "#00b300b0";
    COMPOSITION_BORDER_COLOR = "#00b300b0";
    COMPOSITION_BORDER_SIZE = 2;
    COMPOSITION_BACKGROUND_COLOR = "rgba(0,0,0,0.2)";

    compositionArea;
    compositionBorder;
    preciseSelection = false;

    /** (widget) references / config params*/
    p;
    w;
    h;

    /** a reference to capture on queue widget value*/
        //captureOnQueue;

    inputImages = [null, null, null, null, null, null, null, null];
    fabricDataWidget;
    needsUpload = false;

    configurationNode;

    static hook(nodeId) {
        return app.graph.getNodeById(nodeId);
    }

    static deserializeStuff(value) {
        try {
            return JSON.parse(value)
            
        
        } catch (e) {
            console.log("deserializeStuff", e, value);
            return undefined;
        }
        
    }

    /**
     * serializes some info from the node, currently the transforms supplied to the images
     * this is currently called on capture (regardless of the flag)
     */
    static serializeStuff(node) {
        console.log("serializeStuff");
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
        // console.log(node, slot);
        const connected = node.getInputNode(0);
        return connected.widgets[slot].value;
    }

    static getToolWidget(instance) {
        // console.log(node, slot);
        return instance.node.getInputNode(1);

    }


    /**
     * in CompositorConfig
     * - 4 is pause >removed
     * - 5 is storeTransforms >removed
     * - 6 initialized -> 2
     */
    static setConfigWidgetValue(node, slot, value) {
        // console.log(node, slot);
        const connected = node.getInputNode(0);
        return connected.widgets[slot].value = value;
    }


    static addCanvasBorderColorSetting() {
        app.extensionManager.setting.set({
            id: "Compositor3.Canvas.BORDER_COLOR",
            name: "Border Color",
            tooltip: "give an hex code with alpha, e.g.: #00b300b0, it's the area controlled by 'padding' size outside the  output that will not be exported but used for manipulation",
            type: "text",
            defaultValue: "#00b300b0",
            onChange: (newVal, oldVal) => {                
                // console.log(newVal, this);
            },
        });
    }

    static addCompositionBorderColorSetting() {
        app.extensionManager.setting.set({
            id: "Compositor3.Composition.BORDER_COLOR",
            name: "Border Color (not rendered)",
            type: "text",
            tooltip: "give hex code with alpha eg.: #00b300b0, this will help identifying what is withing the output",
            defaultValue: "#00b300b0",
            onChange: (newVal, oldVal) => {
                // console.log(newVal, this);
            },
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
                step: 1
            },
            defaultValue: 2,
            tooltip: "Border size, 0 for invisible, overlayed and unselectable, not part of the node ouptut",

            onChange: (newVal, oldVal) => {
                // console.log(newVal, this);
            },
        });
    }

    static addCompositionBackgroundColorSetting() {
        app.extensionManager.setting.set({
            id: "Compositor3.Composition.BACKGROUND_COLOR",
            name: "Background Color - Output",
            type: "text",
            tooltip: "give hex code with alpha eg.: #00b300b0, this will help identifying what is withing the output",
            defaultValue: "rgba(0,0,0,0.2)",
            onChange: (newVal, oldVal) => {
                // console.log(newVal, this);
            },
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
        const compositorId = 'c_' + self.crypto.getRandomValues(randomUniqueIds)[0] + '_' + self.crypto.getRandomValues(randomUniqueIds)[1];
        return compositorId;
    }

    static createCompositorContainerDiv() {
        const container = document.createElement("div");        
        container.style.backgroundColor = "rgba(15,0,25,0.25)";        
        container.style.textAlign = "center";        
        return container;
    }

    // static CreateIframe() {
    //     const container = document.createElement("iframe");
    //     container.style.backgroundColor = "rgba(15,0,25,0.25)";        
    //     container.style.zIndex = 3000;
    //     container.style.textAlign = "center";
    //     container.src = "https://comfy.org/";
    //     return container;
    // }

    static createCanvasElement() {
        const canvas = document.createElement("canvas");
        canvas.id = Editor.getRandomCompositorUniqueId();        
        return canvas;
    }

    onHeightChange(value) {
        // console.log("h callback");
        this.fcanvas.setHeight(value + (this.p.value * 2));
        this.compositionArea.setHeight(value);
        this.compositionBorder.setHeight(value + this.COMPOSITION_BORDER_SIZE * 2);

        this.node.setSize(this.calculateNodeSize())
        this.fcanvas.renderAll();
    }

    onWidthChange(value) {
        // console.log("h callback");
        this.fcanvas.setWidth(value + (this.p.value * 2));
        this.compositionArea.setWidth(value);
        this.compositionBorder.setWidth(this.COMPOSITION_BORDER_SIZE * 2);
        this.node.setSize(this.calculateNodeSize());
        this.fcanvas.renderAll();
    }

    onPaddingChange(padding) {

        // console.log("p callback")
        // value is the padding value
        this.compositionArea.setHeight(this.h.value);
        this.compositionArea.setWidth(this.w.value);
        this.compositionArea.setLeft(padding);
        this.compositionArea.setTop(padding);

        this.compositionBorder.setHeight(this.h.value + this.COMPOSITION_BORDER_SIZE * 2);
        this.compositionBorder.setWidth(this.w.value + this.COMPOSITION_BORDER_SIZE * 2);
        this.compositionBorder.setLeft(padding - this.COMPOSITION_BORDER_SIZE);
        this.compositionBorder.setTop(padding - this.COMPOSITION_BORDER_SIZE);

        this.fcanvas.setHeight(this.compositionArea.getHeight() + (padding * 2));
        this.fcanvas.setWidth(this.compositionArea.getWidth() + (padding * 2));
        this.fcanvas.renderAll();
        this.node.setSize(this.calculateNodeSize())

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
        // this.inputImages[this.imageNameAt(index)].height;
        // this.inputImages[this.imageNameAt(index)].width;
        this.inputImages[this.imageNameAt(index)].skewY = 0;
        this.inputImages[this.imageNameAt(index)].skewX = 0;
        this.inputImages[this.imageNameAt(index)].perPixelTargetFind = this.preciseSelection;
        this.fcanvas.renderAll();
    }




    /**
     * checks if the reference at index for an image is not null
     * references are stored in "inputImages"
     * @param node
     * @param index
     * @return {boolean}
     */
    hasImageAtIndex(index) {
        return this.inputImages[this.imageNameAt(index)] != null;
    }

    imageNameAt(index) {
        return 'image' + (index + 1);
    }

    addImage(index, theImage) {
        this.inputImages[this.imageNameAt(index)] = theImage;
        this.fcanvas.add(theImage);
        // this will be empty so, should we restore ?
        // only happens here once at first run afer reloading

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
        //instance.fcanvas.renderAll();
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


    /**
     * Initialize a fabricJs instance.
     * Fabric is the engine that makes it possible to  manipulate the images
     * and extract the final composite image
     * init params: http://fabricjs.com/docs/fabric.Canvas.html
     * @param cavasEl the dom element with canvas tag
     * @return {fabric.Canvas}
     */
    static createFabricCanvas(id) {
        const canvasElement = document.getElementById(id);
        const fcanvas = new fabric.Canvas(canvasElement, {        
            backgroundColor: 'transparent',
            selectionColor: 'transparent',
            selectionLineWidth: 1,            
            preserveObjectStacking: true,
            altSelectionKey: "ctrlKey",
            altActionKey: "ctrlKey",
            centeredKey: "altKey",            
        });
        
        return fcanvas;
    }

    /** converts a data URL to a blob*/
    static dataURLToBlob = (dataURL) => {
        const parts = dataURL.split(',');
        const mime = parts[0].match(/:(.*?);/)[1];
        const binary = atob(parts[1]);
        const array = [];
        for (let i = 0; i < binary.length; i++) {
            array.push(binary.charCodeAt(i));
        }
        return new Blob([new Uint8Array(array)], {type: mime});
    }
    // #addDrawNodeHandler in code
    static uploadImage = (blob, imageNameWidget, node_id, setDone, callback) => {
        const node = app.graph.getNodeById(node_id);

        node.compositorInstance.compositionBorder.set("stroke", "orange");
        node.compositorInstance.fcanvas.renderAll();

        const UPLOAD_ENDPOINT = "/upload/image";
        //const name = `composition.png`;
        const name = `${+new Date()}.png`;
        const file = new File([blob], name);
        const body = new FormData();

        body.append("image", file);
        body.append("subfolder", "compositor");
        body.append("type", "temp");

        api.fetchApi(UPLOAD_ENDPOINT, {
            method: "POST",
            body,
        }).then((value) => {
            // debugger;
            const outputValue = `compositor/${name} [temp]`;
            //imageNameWidget.value = Math.random() > 0.5 ? outputValue : "mask.png"
            imageNameWidget.value = outputValue;

            const body = new FormData();
            body.append('filename', outputValue);
            body.append('node_id', node_id);
            body.append('overwrite', "true");


            node.compositorInstance.compositionBorder.set("stroke", node.compositorInstance.COMPOSITION_BORDER_COLOR);
            node.compositorInstance.fcanvas.renderAll();

            node.setDirtyCanvas(true, true);
            if (callback) callback()
            // deprecated, not really needed anymore
            if (setDone) api.fetchApi("/compositor/done", {method: "POST", body});

        }, () => {
            console.log("some error")
        });
    }

    /** if we have no blob stored in memory, this should be the first run */
    hasNeverRun() {
        return this.cblob == undefined
    }

    /** this can't be async so resort to promise resolving and callbacks
     * @params setDone  **deprecated** when setDone is true, it will raise a /compositor/done event for the backend
     * @params callback  will be passed to uploadImage and called when the upload has finished
     * */
    grabUploadAndSetOutput(instance, setDone, callback) {
        // console.log("capture");
        // console.log("grap upload and set output")
        // prepare the image
        const img = new Image();
        // load something existing into it via view api, for testing
        // api/view?filename=R.jpg&type=input&subfolder=&rand=0.6726800041773884
        // img.src = "/api/view?filename=R.jpg&type=input&subfolder=&rand=0.6726800041773884";
        this.fcanvas.discardActiveObject().renderAll();
        const data = this.fcanvas.toDataURL({
            format: 'jpeg',
            quality: 0.8,
            left: this.p.value,
            top: this.p.value,
            width: this.w.value,
            height: this.h.value
        });

        img.src = data;
        // once finished, export image , upload id with temp name simulating compositing
        // and update the output name value
        img.onload = (e) => {

            // testing resize of fcanvas with widget
            // cmp.setSize([1600/3,(1200/3)+123])
            // cmp.setDirtyCanvas(true, true)


            const blob = Editor.dataURLToBlob(data);

            if (this.hasNeverRun()) {
                Editor.uploadImage(blob, this.node.imageNameWidget, this.node.id, false, callback);
            } else {
                /**
                 * grabUploadAndSetOutput callback can't be async, so this one cant wait for the result and name
                 * pass the widget in upload image as well, so we can just process it.
                 * not sure if it creates problems if we run a "capture on queue"
                 */
                Editor.uploadImage(blob, this.node.imageNameWidget, this.node.id, setDone, callback);
            }

            this.cblob = blob;

            // serialization of transforms
            const serialized = Editor.serializeStuff(this.node);
            if (!serialized.includes("[null,null,null,null,null,null,null,null]")) {
                this.node.fabricDataWidget.value = serialized;
                //  console.log(node.stuff.fabricDataWidget.value)
            }
        }
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
            // console.log("selected objects are moved");
        }
    }

    /** handling of
     * - selections
     * - wheel
     * - keyboard
     * inside the fabric canvas
     */
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

        this.fcanvas.on('selection:created', function (opt) {
            this.selected = opt.selected;
            //  debugger;
            opt.e.preventDefault();
            opt.e.stopPropagation();
        });

        this.fcanvas.on('selection:updated', function (opt) {
            this.selected = opt.selected;
            //  debugger;
            opt.e.preventDefault();
            opt.e.stopPropagation();
        });

        this.fcanvas.on('selection:cleared', function (opt) {
            this.selected = undefined;
            //opt.e.preventDefault();
            //opt.e.stopPropagation();
        });

        this.fcanvas.on('mouse:out', function (opt) {
            // console.log("mouseout")
            // moving outside editor, this might fail to be intercepted depending on how full the
            // canvas is
            if (opt.target === null || opt.target === undefined || opt.target && opt.nextTarget === undefined) {
                compositorInstance.uploadIfNeeded(compositorInstance);
            }
        });

        this.fcanvas.on('object:modified', function (opt) {
            // console.log(this, compositorInstance);
            // mark as needing upload so when we mouse out we doit then reset
            // mouse out is flimsy, sometimes it's not triggering
            compositorInstance.needsUpload = true;
            compositorInstance.fcanvas.bringToFront(compositorInstance.compositionBorder);
            compositorInstance.fcanvas.renderAll();
        });

        this.fcanvas.on('mouse:wheel', function (opt) {
            //console.log(opt);
            try {
                if (opt.target.cacheKey !== this.selected[0].cacheKey) return;
                if (!this.selected) return

                const sign = Math.sign(opt.e.deltaY);
                opt.target.scaleX = opt.target.scaleX + (sign * 0.01);
                opt.target.scaleY = opt.target.scaleY + (sign * 0.01);
                opt.target.dirty = true;

                opt.e.preventDefault();
                opt.e.stopPropagation();
                //this.fcanvas.renderAll()
                this.renderAll()
            } catch (e) {
                return;
            }
        })

        fabric.util.addListener(document.body, 'keydown', function keydownHandler(options) {

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
        }.bind(this));
    }

    uploadIfNeeded(compositorInstance,callback = ()=>{console.log("upload if needed")}) {

        if (compositorInstance.needsUpload) {
            compositorInstance.needsUpload = false;
            const serialized = Editor.serializeStuff(compositorInstance.node);
            compositorInstance.node.fabricDataWidget.value = serialized;
            // const callback = () => {
            //
            // }
            compositorInstance.grabUploadAndSetOutput(compositorInstance, false, callback)
        } else {
            console.log("no upload needed to be done");
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
        debugger;
        const compositionBorder = new fabric.Rect({
            left: this.p.value - this.COMPOSITION_BORDER_SIZE,
            top: this.p.value - this.COMPOSITION_BORDER_SIZE,
            fill: 'transparent',
            width: this.w.value + this.COMPOSITION_BORDER_SIZE * 2,
            height: this.h.value + this.COMPOSITION_BORDER_SIZE * 2,
            selectable: false,
            evented: false,
        });


        console.log("compositionBorder", compositionBorder, this.COMPOSITION_BORDER_COLOR, this.COMPOSITION_BORDER_SIZE);

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


        this.getCompositorSettings()

        // wannabe widgets
        this.w = {
            value: 512, callback: (value, graphCanvas, node) => {
                
            }
        };
        this.h = {
            value: 512, callback: (value, graphCanvas, node) => {
                
            }
        };
        this.p = {
            value: 100, callback: (value, graphCanvas, node) => {
                
            }
        };

        this.containerDiv.width = this.w.value + 2 * this.p.value;
        this.containerDiv.height = this.h.value + 2 * this.p.value;

        if(!c) {
        this.canvasEl = Editor.createCanvasElement();
        

   
        //this.canvasEl.id = 'test'; // ditor.getRandomCompositorUniqueId();
        // this.canvasEl.id = Editor.getRandomCompositorUniqueId();
        
        this.containerDiv.appendChild(this.canvasEl);
        
        

        this.containerDiv.style.overflow = "hidden";
        this.canvasEl.width = this.w.value + 2 * this.p.value;
        this.canvasEl.height = this.h.value + 2 * this.p.value;
        

        this.fcanvas = Editor.createFabricCanvas(this.canvasEl);
    }else{
        this.containerDiv.style.overflow = "hidden";
        this.fcanvas = c;
        this.fcanvas.setWidth(this.w.value + 2 * this.p.value);
        this.fcanvas.setHeight(this.h.value + 2 * this.p.value);
        
    }
    
        console.log("this.fcanvas",this.fcanvas);

        this.compositionArea = this.createCompositionArea();
        this.compositionBorder = this.createCompositionBorder();

        this.fcanvas.add(this.compositionArea)
        this.fcanvas.add(this.compositionBorder)
        //this.fcanvas.bringToFront(this.compositionBorder);


        this.setupfCanvasEvents(this);

        this.fcanvas.renderAll();

        this.node["compositorInstance"] = this;

        this.node.setSize(this.calculateNodeSize())
        this.node.setDirtyCanvas(true, true);

        // make the node unresizable
        // this.node.resizable = false;
    }

    constructor(context, container) {
        this.node = context;
        this.containerDiv = container;
        this.node["compositorInstance"] = this;


        // also get settings here
        // WIDGET CALLBACKS
        this.reference = context.widgets.find(w => w.name === "widgetName");
        // this.reference.callback = () => {
        //     this.someVariable = this.reference.value
        //     context.setSize...
        //     this.updateSomething()
        // }

        // init library and setup events
        // define callbacks and other functions
    }
}


async function interrupt() {
    const response = await fetch('/interrupt', {
        method: 'POST',
        cache: 'no-cache',
        headers: {
            'Content-Type': 'text/html'
        },
    });
    return await response.json();
}
