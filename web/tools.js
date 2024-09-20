import {app} from "../../scripts/app.js";
import {api} from "../../scripts/api.js";


function isType(comfyClass, node) {
    return node.constructor.comfyClass == comfyClass;
}

function getWidget(node, widgetName) {
    return node.widgets.find((w) => w.name === widgetName);
}

app.registerExtension({
    name: "Comfy.CompositorTools3",
    async getCustomWidgets(app) {
    },
    async setup(app) {
    },
    async init(args) {
    },
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
    },

    async loadedGraphNode(node, app) {
    },
    async afterConfigureGraph(args) {
        // not enough to do here only we also in node created (for later or connection changed)
        console.log("after configure graph")
        // To do something when a workflow has loaded, use afterConfigureGraph, not setup
        // console.log("afterConfigureGraph", args);


        const tools = app.graph.findNodesByType("CompositorTools3");
        tools.forEach((node) => {
            const CHANNELNAME = `Tools${node.id}`;
            console.log(CHANNELNAME)
            const channel = new BroadcastChannel(CHANNELNAME);

            node["togglePreciseSelection"] = () => {
                //console.log(arguments);
                channel.postMessage({action:"togglePreciseSelection",value: node.preciseSelection.value, nodeId: node.id});
            }

            node["centerSelected"] = () => {
                //console.log(arguments);
                channel.postMessage({action:"centerSelected",value: true, nodeId: node.id});
            }

            node["resetTransforms"] = () => {
                //console.log(arguments);
                channel.postMessage({action:"resetTransforms",value: true, nodeId: node.id});
            }

            node.centerSelected = node.addWidget("button", "centerSelected", false, node.centerSelected);
            node.preciseSelection = node.addWidget("toggle", "preciseSelection", false, node.togglePreciseSelection);
            node.resetTransforms = node.addWidget("button", "resetTransforms", false, node.resetTransforms);
            //node.preciseSelection.serialize = ()=>{}
            node.setDirtyCanvas(true, true);
        })
    },
    async nodeCreated(node) {
        if (!isType("CompositorTools3", node)) return;
        // console.log("better log it");
        node.serialize_widgets = false;
        node.isVirtualNode = true;
    },
});







