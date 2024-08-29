// author: erosdiffusionai@gmail.com
import {app} from "../../scripts/app.js";
import {api} from "../../scripts/api.js";

import {fabric} from "./fabric.js";


const COMPOSITOR = Symbol();
const TEST_IMAGE_2 = "./extensions/ComfyUI-enricos-nodes/empty.png"

// var stuff = {
//     canvas: null,
//     safeAreaBorder: null,
// }

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
                const compositorId = 'c_'+self.crypto.getRandomValues(array)[0]+'_'+self.crypto.getRandomValues(array)[1];
                node.stuff = {
                    canvasId: compositorId,
                    canvas: null,
                    safeAreaBorder: null,
                }

                console.log("getCustomWidgets", node, node.id, inputName, inputData, app, node.stuff);
                let res;
                node[COMPOSITOR] = new Promise((resolve) => (res = resolve));

                const container = document.createElement("div");
                container.style.background = "rgba(0,0,0,0.25)";
                container.style.textAlign = "center";

                const canvas = document.createElement("canvas");
                canvas.id = node.stuff.canvasId;
                canvas.style = 'outline:1px solid red';
                //canvas.width = 'auto';
                //canvas.height = 'auto';
                //node.resizable = false;

                container.appendChild(canvas);
                // https://docs.comfy.org/essentials/javascript_objects_and_hijacking


                // NOTE: hideOnZoom:false FIXES not being able to take screenshot and disappearing on zomout
                return {widget: node.addDOMWidget(inputName, "COMPOSITOR", container, {hideOnZoom:false})}; // hideOnZoom:false ,ccanvas: canvas
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
            console.log(app.graph.getNodeById(nodeId));
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

                //Remove the old image from the canvas
                node.stuff.canvas.remove(node.stuff['image' + (index + 1)]);
                theImage.set(oldTransform);
                node.stuff.canvas.add(theImage);
                node.stuff['image' + (index + 1)] = theImage;
            }
            // node.stuff.canvas.bringToFront(node.stuff.safeAreaBorder)
        }

        function imageMessageHandler(event) {
            // base 64 content of the image
            console.log(event, event.detail);
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
    async init(args) {
        console.log("init", args)
    },
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
    async beforeRegisterNodeDef(nodeType, nodeData, app) {

        if (nodeType.comfyClass == 'Compositor') {
            console.log("beforeRegisterNodeDef", nodeType, nodeData, app);

            const orig_nodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = async function () {
                console.log("onNodeCreated", this);
                orig_nodeCreated?.apply(this, arguments)
                this.setSize([this.stuff.v.getWidth() + 100, this.stuff.v.getHeight() + 556])
            }

            const onExecuted = nodeType.prototype.onExecuted;
            nodeType.prototype.onExecuted = function (message) {
                console.log("onExecuted", this, message);
                const r = onExecuted?.apply?.(this, arguments)
                return r;
            }
        }


        //     console.log("nodeType.comfyClass",nodeType.comfyClass)
        //     const orig_nodeCreated = nodeType.prototype.onNodeCreated
        //     nodeType.prototype.onNodeCreated = async function () {
        //         orig_nodeCreated?.apply(this, arguments)
        //         const uploadWidget = this.widgets.filter(w => w.name == 'upload')[0]
        //         const widget = {
        //             type: 'div',
        //             name: 'upload-preview',
        //             draw (ctx, node, widget_width, y, widget_height) {
        //                 Object.assign(
        //                     this.div.style,
        //                     get_position_style(ctx, widget_width-88, 88, node.size[1])
        //                 )
        //             }
        //         }
        //
        //         widget.div = $el('div', {})
        //         widget.div.style.width = `120px`
        //         document.body.appendChild(widget.div)
        //
        //         const inputDiv = (key, placeholder, preview) => {
        //             let div = document.createElement('div')
        //             const ip = document.createElement('button')
        //             ip.className = `${'comfy-multiline-input'} ${placeholder}`
        //             div.style = `display: flex;
        //     align-items: center;
        //     margin: 6px 8px;
        //     margin-top: 0;`
        //
        //             ip.style = `outline: none;
        //     border: none;
        //     padding: 4px;
        //     width: 100px;cursor: pointer;
        //     height: 32px;`
        //             ip.innerText = placeholder
        //             div.appendChild(ip)
        //
        //             let that = this
        //
        //             ip.addEventListener('click', async event => {
        //                 let fileURL = await inputFileClick(true, true)
        //
        //                 // console.log('文件URL: ', fileURL)
        //                 let html = `<model-viewer  src="${fileURL}"
        //         oncontextmenu="return false;"
        //         min-field-of-view="0deg" max-field-of-view="180deg"
        //          shadow-intensity="1"
        //          camera-controls
        //          touch-action="pan-y">
        //
        //          <div class="controls">
        //           <div>Variant: <select class="variant"></select></div>
        //           <div>Material: <select class="material"></select></div>
        //           <div>Material: <div class="material_img"> </div></div>
        //           <div>
        //             <button class="bg">BG</button>
        //
        //           </div>
        //           <div>
        //            <input class="ddcap_step" type="number" min="1" max="20" step="1" value="1">
        //            <input class="total_images" type="number" min="1" max="180" step="1" value="40">
        //            <input class="ddcap_range" type="range" min="-180" max="180" step="1" value="0">
        //            <input class="ddcap_range_top" type="range" min="-180" max="180" step="1" value="0">
        //           <button class="ddcap">Capture Rotational Screenshots</button></div>
        //
        //           <div><button class="export">Export GLB</button></div>
        //
        //         </div></model-viewer>`
        //
        //                 preview.innerHTML = html
        //                 if (that.size[1] < 400) {
        //                     that.setSize([that.size[0], that.size[1] + 300])
        //                     app.canvas.draw(true, true)
        //                 }
        //
        //                 const modelViewerVariants = preview.querySelector('model-viewer')
        //                 const select = preview.querySelector('.variant')
        //                 const selectMaterial = preview.querySelector('.material')
        //                 const material_img = preview.querySelector('.material_img')
        //                 const bg = preview.querySelector('.bg')
        //
        //                 const exportGLB = preview.querySelector('.export')
        //
        //                 const ddcap_step = preview.querySelector('.ddcap_step')
        //                 const total_images = preview.querySelector('.total_images')
        //                 const ddcap_range = preview.querySelector('.ddcap_range')
        //                 const ddcap_range_top = preview.querySelector('.ddcap_range_top')
        //                 const ddCap = preview.querySelector('.ddcap')
        //                 const sleep = (t = 1000) => {
        //                     return new Promise((res, rej) => {
        //                         return setTimeout(() => {
        //                             res(t)
        //                         }, t)
        //                     })
        //                 }
        //
        //                 async function captureImage (isUrl = true) {
        //                     let base64Data = modelViewerVariants.toDataURL()
        //
        //                     const contentType = getContentTypeFromBase64(base64Data)
        //
        //                     const blob = await base64ToBlobFromURL(base64Data, contentType)
        //
        //                     if (isUrl) return await uploadImage(blob, '.png')
        //                     return await uploadImage_(blob, '.png')
        //                 }
        //
        //                 async function captureImages (angleIncrement = 1, totalImages = 12) {
        //                     // 记录初始旋转角度
        //                     const initialCameraOrbit =
        //                         modelViewerVariants.cameraOrbit.split(' ')
        //                     console.log(
        //                         '#captureImages',
        //                         initialCameraOrbit,
        //                         angleIncrement * totalImages
        //                     )
        //                     // const totalImages = 12
        //                     // const angleIncrement = totalRotation / totalImages // Each increment in degrees
        //                     let currentAngle =
        //                         Number(initialCameraOrbit[0].replace('deg', '')) -
        //                         (angleIncrement * totalImages) / 2 // Start from the leftmost angle
        //                     let frames = []
        //
        //                     modelViewerVariants.removeAttribute('camera-controls')
        //
        //                     for (let i = 0; i < totalImages; i++) {
        //                         modelViewerVariants.cameraOrbit = `${currentAngle}deg ${initialCameraOrbit[1]} ${initialCameraOrbit[2]}`
        //                         await sleep(1000)
        //                         console.log(`Capturing image at angle: ${currentAngle}deg`)
        //                         let file = await captureImage(false)
        //                         frames.push(file)
        //                         currentAngle += angleIncrement
        //                     }
        //                     await sleep(1000)
        //                     // 恢复到初始旋转角度
        //                     modelViewerVariants.cameraOrbit = initialCameraOrbit.join(' ')
        //                     modelViewerVariants.setAttribute('camera-controls', '')
        //                     return frames
        //                 }
        //                 ddCap.addEventListener('click', async e => {
        //                     const angleIncrement = Number(ddcap_step.value),
        //                         totalImages = Number(total_images.value)
        //
        //                     let images = await captureImages(angleIncrement, totalImages)
        //                     // console.log(images)
        //                     let dd = getLocalData(key)
        //                     dd[that.id].images = images
        //                     setLocalDataOfWin(key, dd)
        //                 })
        //
        //                 ddcap_range.addEventListener('input', async e => {
        //                     // console.log(ddcap_range.value)
        //                     const initialCameraOrbit =
        //                         modelViewerVariants.cameraOrbit.split(' ')
        //                     modelViewerVariants.cameraOrbit = `${ddcap_range.value}deg ${initialCameraOrbit[1]} ${initialCameraOrbit[2]}`
        //                     modelViewerVariants.setAttribute('camera-controls', '')
        //                 })
        //
        //                 ddcap_range_top.addEventListener('input', async e => {
        //                     // console.log(ddcap_range.value)
        //                     const initialCameraOrbit =
        //                         modelViewerVariants.cameraOrbit.split(' ')
        //                     modelViewerVariants.cameraOrbit = `${initialCameraOrbit[0]} ${ddcap_range_top.value}deg ${initialCameraOrbit[2]}`
        //                     modelViewerVariants.setAttribute('camera-controls', '')
        //                 })
        //
        //                 if (modelViewerVariants) {
        //                     modelViewerVariants.style.width = `${that.size[0] - 48}px`
        //                     modelViewerVariants.style.height = `${that.size[1] - 48}px`
        //                 }
        //
        //                 modelViewerVariants.addEventListener('load', async () => {
        //                     const names = modelViewerVariants.availableVariants
        //
        //                     // 变量
        //                     for (const name of names) {
        //                         const option = document.createElement('option')
        //                         option.value = name
        //                         option.textContent = name
        //                         select.appendChild(option)
        //                     }
        //                     // Adds a default option.
        //                     if (names.length === 0) {
        //                         const option = document.createElement('option')
        //                         option.value = 'default'
        //                         option.textContent = 'Default'
        //                         select.appendChild(option)
        //                     }
        //
        //                     // 材质
        //                     extractMaterial(modelViewerVariants, selectMaterial, material_img)
        //                 })
        //
        //                 let timer = null
        //                 const delay = 500 // 延迟时间，单位为毫秒
        //
        //                 async function checkCameraChange () {
        //                     let dd = getLocalData(key)
        //
        //                     //  const fileBlob = new Blob([e.target.result], { type: file.type });
        //                     let url = await captureImage()
        //
        //                     let bg_blob = await base64ToBlobFromURL(
        //                         'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN88uXrPQAFwwK/6xJ6CQAAAABJRU5ErkJggg=='
        //                     )
        //                     let url_bg = await uploadImage(bg_blob, '.png')
        //                     // console.log('url_bg',url_bg)
        //
        //                     if (!dd[that.id]) {
        //                         dd[that.id] = { url, bg: url_bg }
        //                     } else {
        //                         dd[that.id] = { ...dd[that.id], url }
        //                     }
        //
        //                     //  材质贴图
        //                     let thumbUrl = material_img.getAttribute('src')
        //                     if (thumbUrl) {
        //                         let tb = await base64ToBlobFromURL(thumbUrl)
        //                         let tUrl = await uploadImage(tb, '.png')
        //                         // console.log('材质贴图', tUrl, thumbUrl)
        //                         dd[that.id].material = tUrl
        //                     }
        //
        //                     setLocalDataOfWin(key, dd)
        //                 }
        //
        //                 function startTimer () {
        //                     if (timer) clearTimeout(timer)
        //                     timer = setTimeout(checkCameraChange, delay)
        //                 }
        //
        //                 modelViewerVariants.addEventListener('camera-change', startTimer)
        //
        //                 select.addEventListener('input', async event => {
        //                     modelViewerVariants.variantName =
        //                         event.target.value === 'default' ? null : event.target.value
        //                     // 材质
        //                     await extractMaterial(
        //                         modelViewerVariants,
        //                         selectMaterial,
        //                         material_img
        //                     )
        //                     checkCameraChange()
        //                 })
        //
        //                 selectMaterial.addEventListener('input', event => {
        //                     // console.log(selectMaterial.value)
        //                     material_img.setAttribute('src', selectMaterial.value)
        //
        //                     if (selectMaterial.getAttribute('data-new-material')) {
        //                         let index =
        //                             ~~selectMaterial.selectedOptions[0].getAttribute('data-index')
        //                         changeMaterial(
        //                             modelViewerVariants,
        //                             modelViewerVariants.model.materials[index],
        //                             selectMaterial.getAttribute('data-new-material')
        //                         )
        //                     }
        //
        //                     checkCameraChange()
        //                 })
        //
        //                 //更新bg
        //                 const updateBgData = (id, key, url, w, h) => {
        //                     let dd = getLocalData(key)
        //                     // console.log(dd[that.id],url)
        //                     if (!dd[id]) dd[id] = { url: '', bg: url }
        //                     dd[id] = {
        //                         ...dd[id],
        //                         bg: url,
        //                         bg_w: w,
        //                         bg_h: h
        //                     }
        //                     setLocalDataOfWin(key, dd)
        //                 }
        //
        //                 bg.addEventListener('click', async () => {
        //                     //更新bg
        //                     updateBgData(that.id, key, '', 0, 0)
        //                     preview.style.backgroundImage = 'none'
        //
        //                     let base64 = await inputFileClick(false, false)
        //                     // 将读取的文件内容设置为div的背景
        //                     preview.style.backgroundImage = 'url(' + base64 + ')'
        //
        //                     const contentType = getContentTypeFromBase64(base64)
        //
        //                     const blob = await base64ToBlobFromURL(base64, contentType)
        //
        //                     //  const fileBlob = new Blob([e.target.result], { type: file.type });
        //                     let bg_url = await uploadImage(blob, '.png')
        //                     let bg_img = await createImage(base64)
        //
        //                     //更新bg
        //                     updateBgData(
        //                         that.id,
        //                         key,
        //                         bg_url,
        //                         bg_img.naturalWidth,
        //                         bg_img.naturalHeight
        //                     )
        //
        //                     // 更新尺寸
        //                     let w = that.size[0] - 48,
        //                         h = (w * bg_img.naturalHeight) / bg_img.naturalWidth
        //
        //                     if (modelViewerVariants) {
        //                         modelViewerVariants.style.width = `${w}px`
        //                         modelViewerVariants.style.height = `${h}px`
        //                     }
        //                     preview.style.width = `${w}px`
        //                 })
        //
        //                 exportGLB.addEventListener('click', async () => {
        //                     const glTF = await modelViewerVariants.exportScene()
        //                     const file = new File([glTF], 'export.glb')
        //                     const link = document.createElement('a')
        //                     link.download = file.name
        //                     link.href = URL.createObjectURL(file)
        //                     link.click()
        //                 })
        //
        //                 uploadWidget.value = await uploadWidget.serializeValue()
        //
        //                 // 更新尺寸
        //                 let dd = getLocalData(key)
        //                 // console.log(dd[that.id],bg_url)
        //                 if (dd[that.id]) {
        //                     const { bg_w, bg_h } = dd[that.id]
        //                     if (bg_h && bg_w) {
        //                         let w = that.size[0] - 48,
        //                             h = (w * bg_h) / bg_w
        //
        //                         if (modelViewerVariants) {
        //                             modelViewerVariants.style.width = `${w}px`
        //                             modelViewerVariants.style.height = `${h}px`
        //                         }
        //                         preview.style.width = `${w}px`
        //                     }
        //                 }
        //             })
        //             return div
        //         }
        //
        //         let preview = document.createElement('div')
        //         preview.className = 'preview'
        //         preview.style = `margin-top: 12px;
        //   display: flex;
        //   justify-content: center;
        //   align-items: center;background-repeat: no-repeat;
        //   background-size: contain;`
        //
        //         let upload = inputDiv('_mixlab_3d_image', '3D Model', preview)
        //
        //         widget.div.appendChild(upload)
        //         widget.div.appendChild(preview)
        //         this.addCustomWidget(widget)
        //
        //         const onResize = this.onResize
        //         let that = this
        //         this.onResize = function () {
        //             let modelViewerVariants = preview.querySelector('model-viewer')
        //
        //             // 更新尺寸
        //             let dd = getLocalData('_mixlab_3d_image')
        //             // console.log(dd[that.id],bg_url)
        //             if (dd[that.id]) {
        //                 const { bg_w, bg_h } = dd[that.id]
        //                 if (bg_h && bg_w) {
        //                     let w = that.size[0] - 48,
        //                         h = (w * bg_h) / bg_w
        //
        //                     if (modelViewerVariants) {
        //                         modelViewerVariants.style.width = `${w}px`
        //                         modelViewerVariants.style.height = `${h}px`
        //                     }
        //                     preview.style.width = `${w}px`
        //                 }
        //             }
        //
        //             return onResize?.apply(this, arguments)
        //         }
        //
        //         const onRemoved = this.onRemoved
        //         this.onRemoved = () => {
        //             upload.remove()
        //             preview.remove()
        //             widget.div.remove()
        //             return onRemoved?.()
        //         }
        //
        //         if (this.onResize) {
        //             this.onResize(this.size)
        //         }
        //         // this.isVirtualNode = true
        //         this.serialize_widgets = false //需要保存参数
        //     }
        //
        //     const onExecuted = nodeType.prototype.onExecuted
        //     nodeType.prototype.onExecuted = function (message) {
        //         const r = onExecuted?.apply?.(this, arguments)
        //
        //         let div = this.widgets.filter(d => d.div)[0]?.div
        //         // console.log('Test', this.widgets)
        //
        //         let material = message.material[0]
        //         if (material) {
        //             const { filename, subfolder, type } = material
        //             let src = api.apiURL(
        //                 `/view?filename=${encodeURIComponent(
        //                     filename
        //                 )}&type=${type}&subfolder=${subfolder}${app.getPreviewFormatParam()}${app.getRandParam()}`
        //             )
        //
        //             const modelViewerVariants = div.querySelector('model-viewer')
        //
        //             const selectMaterial = div.querySelector('.material')
        //
        //             let index =
        //                 ~~selectMaterial.selectedOptions[0].getAttribute('data-index')
        //
        //             selectMaterial.setAttribute('data-new-material', src)
        //
        //             changeMaterial(
        //                 modelViewerVariants,
        //                 modelViewerVariants.model.materials[index],
        //                 src
        //             )
        //         }
        //
        //         this.onResize?.(this.size)
        //
        //         return r
        //     }
        // }
    },
    /** loadedGraphNode */
    async loadedGraphNode(node, app) {
        node.type == "Compositor" && console.log("loadedGraphNode", node, app, node.stuff);

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

        console.log("nodeCreated", node)

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


        const btn = node.addWidget("button", "capture", "capture", capture);

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

                const blob = dataURLToBlob(data)
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
                return `compositor/${name} [temp]`;
            } catch (e) {
                // we have nothing so...well..just pretend
                return TEST_IMAGE_2;
            }

        };

        node.setSize([v.getWidth() + 100, v.getHeight() + 556])
        capture();


    },
});
