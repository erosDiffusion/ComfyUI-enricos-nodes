// author: erosdiffusionai@gmail.com
import {app} from "../../scripts/app.js";
import {api} from "../../scripts/api.js";

import {fabric} from "./fabric.js";

const COMPOSITOR = Symbol();

function createCompositorContainerDiv() {
    const container = document.createElement("img");
    container.alt="pippo";
    container.src="example.png";
    container.style.background = "rgba(0,0,0,0.25)";
    container.style.width = "200px";
    container.style.height = "200px";
    return container;
}

function isCompositor(node) {
    return node.constructor.comfyClass == "Compositor";
}


app.registerExtension({
    name: "Comfy.Compositor",

    async getCustomWidgets(app) {
        return {
            COMPOSITOR(node, inputName, inputData, app) {
                node[COMPOSITOR] = new Promise((resolve) => resolve);

                const container = createCompositorContainerDiv();



                /**
                 * NOTE: hideOnZoom:false FIXES not being able to take screenshot and disappearing on zoom out
                 * but creates some inconsistencies as lines get too small to be rendered properly
                 */
                return {widget: node.addDOMWidget(inputName, "COMPOSITOR", container, {hideOnZoom: false})};
            },
        };
    },
    /**
     * Called at the end of the startup process.
     * A good place to add event listeners (either for Comfy events, or DOM events), or adding to the global menus,
     * at this point we get a nodeId from a message (if we pass it) but have no node context, so we need to find it.
     */
    async setup(app) {

        // disabled, for now, rely on defaults
        // addCompositorSettings.call(this, app);
        function hook(nodeId){
            return app.graph.getNodeById(nodeId);
        }


        function imageMessageHandler(event) {
            console.log(event);

        }

        function configMessageHandler(event) {
            // Litegraph docs
            // https://github.com/jagenjo/litegraph.js/blob/master/guides/README.md
            // get stuff connected to this config also...careful with the gui now...
            const node = hook(81);
            node.widgets[0].element.src = event.detail.names[7];
            node.setSize([event.detail.width,event.detail.height]);

            // node.widgets[0].element.style.width = event.detail.width+"px";
            // node.widgets[0].element.style.height = event.detail.height+"px";
        }

        api.addEventListener("compositor.images", imageMessageHandler);
        api.addEventListener("compositor.config", configMessageHandler);
    },
    async nodeCreated(node) {
        if (!isCompositor(node)) return;
        console.log(node);
    },
});


