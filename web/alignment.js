import {app} from "../../scripts/app.js";
import {api} from "../../scripts/api.js";


function isType(comfyClass, node) {
    return node.constructor.comfyClass == comfyClass;
}

function getWidget(node, widgetName) {
    return node.widgets.find((w) => w.name === widgetName);
}

app.registerExtension({
    name: "Comfy.Alignment",
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
    // async afterConfigureGraph(args) {
    //     // not enough to do here, also in node created (for later or connection changed)
    //     console.log("after configure graph")
    //     // To do something when a workflow has loaded, use afterConfigureGraph, not setup
    //     // console.log("afterConfigureGraph", args);
    //
    //
    //     const tools = app.graph.findNodesByType("Alignment");
    //     tools.forEach((node) => {
    //         const CHANNELNAME = `Tools${node.id}`;
    //         console.log(CHANNELNAME)
    //         const channel = new BroadcastChannel(CHANNELNAME);
    //
    //         node["togglePreciseSelection"] = () => {
    //             //console.log(arguments);
    //             channel.postMessage({value: node.preciseSelection.value, nodeId: node.id});
    //
    //         }
    //
    //
    //         node.preciseSelection = node.addWidget("toggle", "preciseSelection", false, node.togglePreciseSelection);
    //         //node.preciseSelection.serialize = ()=>{}
    //         node.setDirtyCanvas(true, true);
    //     })
    // },
    async nodeCreated(node) {
        if (!isType("Alignment", node)) return;
        console.log("better log it");
        node.serialize_widgets = false;
        node.isVirtualNode = true;
    },
});







