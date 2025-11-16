## Create complex compositions the FAST and EASY way (V4 Alpha is out!)

![the compositor node](/assets/showreel1.png)

How many times do you need to create something like this?
![the compositor node](/assets/showreel1.jpg)

Well, This node was created to make the composition process quick and easy!

## The Compositor Node

With the Compositor Node you can:

- **Visual Composition**: Pass up to 8 images and visually place, rotate, scale, and flip them
- **Layer Management**: Drag-to-reorder layers, toggle visibility, preview images and masks side-by-side
- **Bg Color**: Easily choose the background color or keep transparent!
- **Drawing Tools**: Sketch and annotate easily with Paint/erase on foreground layer with adjustable brush (size, color, shape)
- **Transform Controls**: Flip H/V, stretch to fit, align selected objects, rotate with precision
- **Smart Selection**: Precise pixel-level selection mode, snap-to-grid for alignment
- **Direct Input**: Numerical width/height boxes for exact dimensions
- **Auto-Save**: Automatic upload when composition changes
- **Stable assets**: well defined outputs and temporary images.
- **Reset & Restore**: you lost your image outside of screeen: Reset All button to restore initial configuration, select and move via layers.
- **Mode Switching**: Select/Draw/Erase modes with Ctrl+key temporary switching
- **Memory**: Remember positions, scaling, rotations, z-index across generations and reloads
- **Stable input names and resources**:Choose where to save inputs so they will persist reloads
- **Buffer Zone**: Extra padding area to park assets or reach transform handles
- **Export Area**: Clear green border indicating the exact exported region
- **Mask Preview**: See masks in your layers
- **Keyboard Control**: Arrow keys for precise 1px nudging (Shift for 10px)
- **Erase while drawing**: simply ctrl+draw to erase while in draw mode
- **Group Operations**: Multi-select and transform multiple layers together
- **Output Options**: Export final image, and other information

## Changelog

- v **4.0.0 Alpha** - 16.11.2025

![Compositor V4 Interface](assets/v4.png)

  - _major rewrite_: **Complete UI overhaul with enhanced workflow!**
  - _new feature_: **Layers Panel** - Visual layer management with thumbnails for images and masks, drag-to-reorder, visibility toggles
  - _new feature_: **Drawing Tools** - Foreground layer with brush/eraser modes, color picker, adjustable brush size and shape (circle/square)
  - _new feature_: **Enhanced Toolbar** - Comprehensive transformation controls (flip H/V, stretch, align), snap-to-grid, precise selection mode
  - _new feature_: **Numerical Inputs** - Direct width/height control with real-time feedback, rotation slider with snap (Shift for 5° increments)
  - _new feature_: **Save & Reset** - Auto-save on mouse-out with visual feedback (orange flash), Reset All button to restore initial state
  - _enhancement_: **Mask Preview** - Side-by-side image and mask thumbnails with opacity indicators
  - _enhancement_: **Improved Alignment** - Composition border now pixel-perfect with export area
  - _technicalities_: **Input options** with the new configuration you can choose the quality of the input (saved to disk) and position: the tmp folder is temporary and will not on reload persist reloads. save to output in by default in a well isolated folder with unique names

  - \_Attention!!!: This is an Alpha preview, v3 still there. :

  
  ![Compositor V4 Output Example](assets/v4_out.png)

  **Known Issues / Work in Progress:**

  - Erase canvas might restore erased foreground in certain cases
  - Positions are not always pixel-perfect (sub-pixel rounding)
  - Some transformation tools can be unreliable (equalize/distribute disabled)
  - Temporary remmoved mask output and advanced outputs.
  - Can be very heavy depending on the size of canvas and imported images, keep it reasonable in size. avoid importing 8 4k images in a 4k canvas...



## Previous versions changelog

<details>

<summary><b>click here to expand</b> the changelog...</summary>
- v **3.1.5** - 04.05.2025
  - _new feature_: **Mask outputs!** you asked for it so there you go: A new node that outputs the layers and their masks! search for the compositor masks output node and connect it to the new layer_outputs output socket. note: mask stacking (subtract top masks from the bekow ones will come later)
  - _new node_ :a new **color picker node** (specify rgb coordinates or use the eyedropper and connect the 24 bit output to connect to color inputs).
  - _bugfix_: fixed a regression for which the composition overlay was not being superimposed the composition while moving objects and z-stacking not being preserved until save
  - _sample workflow_: [a sample workflow with assets can be found in the /assets/workflows folder](/assets/workflows/compositorMasksV3_sample.json)
- v **3.1.3 & 3.1.4** - fix regression due to comfy change, not sure what else is brooken but ... reinstance the node. might be that reloading a flow does not preserve anymore the configurations
- v **3.1.2** - merge pr for comfyui official registry
- v **3.1.1** - 23.03.2025 fixed gui not showing up in comfy frontend higher Comfy 1.1.18+
- v **3.1.0** - 20.09.2024

  - _new configuration feature_: **onConfigChange action toggle** when you change the configuration (or any of the attached nodes) you can now choose if:

    - you want to **stop** the flow to allow edits
    - or you want to **grab a capture and continue** the flow  
      $${\color{red}Important}$$! this option stops, uploads the composition and re-enqueues your prompt (**there is no real pause**) so careful with random seeds on the left of the node or it will loop!

  - _new configuration feature_: **normalize height** when this is activated your images will all be the same height of the canvas (this can lower image quality)
  - _transforms enhancement_: output transforms now give you back the angle and **bounding box coordinates**
  - _transforms enhancement_: you can **force transform outputput values to be integers** (as some nodes requires it)

  - _new feature_: (experimental and limited): **Tools** ! this is an experimental feature. it allows controlling some aspects of the compositor.
    - **precise selection toggle** ignore transparent pixels and select the first image below the mouse
    - **center selected** puts the selected images in the center of canvas
    - **reset transforms** zeroes out the changes to images bringing them to their original size, angle and 0,0 location (top left)
    - limitations: as saving discards the selection, and it happens on mouse out  
      you might need to re-select to use centering and reset

![the compositor node](/assets/v3.1.PNG)
- v **3.0.8** - 18.09.2024
  - _new feature_: **invert mask** option. the implementation of mask was not correct. now it's possible to invert the mask via toggle.
  - _new feature_: **angle output** the angle of rotation is now accessible in the output (and soon the bounding box x,y, width and height).
  - _bugfix_: **fix cut images on swap due to wrongly preserved width and height**
  - \_new feature: **added force int** to allow the outputs to be used with set area conditioning (that requires int)
- v **3.0.4** - 18.09.2024 - **bugfix**: the width and height stored in transforms were swapped and the output node would report them incorrectly. thanks @sky958958 for spotting it
- v **3.0.2** - 17.09.2024 - **friendly transforms** for area prompting!  
  With the goal of being able to do regional area prompting,  
  now you can easily output each input x,y coordinates and their scaled width and height with the help of the new **Transform Output** node!
  select the channel corresponding the input and the node will output the values for you.
  - _enhancement_: a **new node** outputs x,y,width,height other images into a convenient node to be attached to the transforms output
  - _enhancement_: save and restore skew from transform (now you can distort your images to help fake perspective)
- v **3.0.0** - 16.09.2024 - this release is a full rewrite of the code and fixes: - issues #45 , #34, #18
  also, and adds **new features**: - _enhancement_: **simplified control panel** (cature on queue, save transform, pause are removed as not needed anymore) - _new feature_: **automatic upload** of the output **on mouse out** of the canvas area (no need to click capture) - _new feature_: **flash on save** (once the image is uploaded the composition area green border briefly flashes in orange) - _new feature_: **preliminary work for optional control panels** (they will contain alignment controls, and other tools) - _enhancement_: enqueue with **continue**, on the first run, if necessary information is missing (like output) the flow will stop, make your composition, and click continue to re-enqueue the flash finishes.
  - v **2.0.4** - 06.09.2024 - _enhancement_: You can now **scale the selected image via mouse wheel**!
  - v **2.0.1** - 05.09.2024 - **V2 is HERE!**
    - _enhancement_: An all **new widget layout** with maximized working area and less clutter
    - _new feature_: A **new companion configuration widget** to allow more control and easier maintenance
    - _enhancement_: More control! it's now possible to select an image or group and then "**alt+drag**" to **center scale and rotate**
    - _new feature_: More control! it's now possible to **nudge a selection** by one pixel by using keyboard arrows, and while holding shift the movement is 10px! pixel perfect alignments!
    - _new feature_: the node now **remembers the transforms** you have applied, on the new run it will re-apply the stored transforms (storing transforms is controlled in the config)
    - _new feature_: **masks are here**! you can now pass masks, and they will be applied automatically! (depending on the results you might want still to invert them)
    - _regression_: a bit annoying but is_changed is not being observed so flows are re-triggered even on fixed
    - _regression_: img in workflow saved is not visible anymore
  - V **1.0.9** - 30.08.2024 - Huge refactoring!
    - _new feature_: **multiple instances** are now possible
    - _bugfix_: **zooming out does not hide the compositor images anymore**
    - _bugfix_: when **saving a png with the workflow** the **compositor content is now visible** (will not be restored...yet)
    - _enhancement_: the node **does not re-trigger** the execution of the flow if the image is not changed
    - _performance_: the node is **now more efficient** and correctly implements the is_changed check via **checksum**, avoiding re-triggering flows downstream if the composition has not changed
    - _maintainability_: the node is now refactored and better engineered, with a lot of comments. could be a good use case for those learning to code comfy extensions.
  - V **1.0.8** - 28.08.2024 - _new feature_: **safe area indication** - a green border is overlaid on top of the composition to indicate the exported area
  - V **1.0.7** - 28.08.2024 - _new feature_: **preserve stacking order**. when selecting a node, it's z-order is preserved image1 being the background/farthest and image8 the foreground/closest.
    - the first connected node will be the most distant from camera (background)
    - the last will be the closest to camera (subject/foreground)
  - V **1.0.4** - 27.08.2024 - _new feature_: now it's possible to **pause the flow** with a switch to avoid processing an unfinished composition
  </details>

## Setup

**Method 1: git clone**
open the custom nodes directory in your editor and

`git clone https://github.com/erosDiffusion/ComfyUI-enricos-nodes.git`

like all other custom nodes (that are not integrated with manager)

**Method 2: ComfyUi Manager**
In Comfy UI Manager search "Compositor" and select the node from erosDiffusion and press install.

**Method 3: via manager's button**
open ComfyUI manager click on **Install via Git URL** and paste this url

`https://github.com/erosDiffusion/ComfyUI-enricos-nodes.git`

if you get: "This action is not allowed with this security level configuration" then check your manager config.ini
as discussed [here](https://github.com/ltdrdata/ComfyUI-Manager?tab=readme-ov-file#security-policy):
and set the security to weak (at your risk)

![the compositor node](/assets/weak.png)

## Reasons and How To use

### Why this node ?

- I wanted to learn how to create custom nodes with a GUI in ComfyUI
- be able to composite visually images in ComfyUI
- be able to have image inputs that are generated on the fly in the composition
- be able to remember sizing and position across usages/generations
- have more room to manipulate objects around/outside the generated image

### Alternatives ?

- the painter node is great and works better and does a million things more, but it misses some of these features.
- continue compositing your image like caveman using pixel coordinates
- well...photoshop ** if you have it** and import via million clicks or with a plugin
- finally use **Krita** which is good powerful and free
- oh and Blender also has a great plugin **but you need to know/learn blender**
- fast forward to 2025, almost 2026 now we have edit models and other goodies still... with qwen image edit and fuse lora, quick mockups are still useful
- use as canvas for other editing tools to "direct" your scene... annotate and reframe, quickly setup a moodboard for edit models or drive animations...
- make nice collages

### How to use

**Quick Start (V4)**:

1. Search "Compositor" (V4) and "Compositor Config" (V4) in the node menu
2. Connect Config node to Compositor's `config` input
3. Configure: width, height, padding (extra space around canvas for easier manipulation)
4. Connect up to 8 images and optional masks to Config node
5. **Important**: Connect Compositor's `image` output (to Save Image, Preview, etc.)
6. Run once - flow stops to let you compose (if no prior composition exists)
7. **Compose your scene** using the tools (see below)
8. Mouse out of canvas area (green border flashes orange = saved)
9. Click Continue or Queue to process with your composition

**Compositor V4 Interface:**

**Layers Panel** (right side):

- **Foreground** - Drawing layer (paint/erase)
- **Layers 1-8** - Your input images with thumbnails
- **Mask Preview** - Small square showing mask state (bright=active, dim=disabled)
- **Visibility Toggle** - Click layer to select, drag to reorder z-index
- **Background** - Bottom-most layer

**Toolbar** (top scrollable):

- **Alignment**: 9 buttons (←↑→↓ corners/center) - Align selected objects
- **Flip/Stretch**: ⇄⇵ flip H/V, ⬌⬍ stretch to fit canvas width/height
- **Snap/Grid**: Toggle snap-to-grid, adjust grid size (1-50px)
- **Rotate/Precise**: Rotation slider (0-360°, Shift=snap to 5°), precise pixel selection toggle
- **Mode Buttons**: Select/Draw/Erase (hold Ctrl to temporarily switch)
- **Draw Tools**: Color picker, brush width, Clear FG button (erase mode)
- **Brush Shape**: ● circle / ■ square
- **Size Controls**: Direct W/H input boxes for selected objects

**Config Node Options:**

- **Width/Height**: Composition canvas dimensions
- **Padding**: Buffer zone around canvas (default 100px)
- **Normalize Height**: Scale all inputs to same height (may reduce quality)
- **onConfigChangedContinue**: Auto-continue vs Stop for manual edits
- **Invert Mask**: Flip mask alpha channels
- **Save Format**: PNG (0-9), JPEG, WebP, BMP compression levels
- **Save Folder**: Output destination (temp/input/output)

### Advanced Usage

**Selection & Transform:**

- Click to select single layer
- Drag empty area to box-select multiple
- Shift+Click to add/remove from selection
- Arrow keys: nudge 1px (Shift=10px)
- Mouse wheel: scale selected layer
- Drag corners: resize (Alt=center-based, Ctrl=free aspect)
- Rotation handle: rotate (Shift=snap to 5°)

**Drawing Mode:**

- Select Draw/Erase mode from toolbar
- Hold Ctrl to temporarily switch between draw/erase
- Adjust brush width (1-50px) and shape (circle/square)
- Change color with color picker (draw mode)
- Clear FG button removes all drawings

**Tips:**

- Mouse-out canvas to auto-save (orange flash = confirmed)
- Use Reset All button to restore initial positions
- Snap-to-grid helps with precise alignment
- Precise selection mode ignores transparent pixels
- Padding area lets you park/manipulate layers outside export zone

### Aupporting nodes I use with this one

- **Rembg(batch)** -> from https://github.com/Mamaaaamooooo/batchImg-rembg-ComfyUI-nodes.git -> extracts the subject and returns a rgba image
- any other technique to create masks (grounding dino, sam, florence2...)
- any **controlnet depth for your model** - works well with depth anything v2 preprocessor for both 1.5 (regular controlnet) and xl (via union controlnet) or lineart (like anylineart), for flux you can try x-labs controlnet (but it does not work well for me)

## Demo Workflow for v3.1

Just throw the worst possible images you find on the internet or that you can generate...
...scale and align quick, give a depth controlnet, describe the full scene and style, render...
and you will get:

![v3.PNG](assets%2Fv3.PNG)
with the [V3.1 workflow in json format](assets%2Fv3.1.json) you are in pixel perfect positioning control of your scene and content !
Images to replicate are in the assets folder.

### Final words and limitations

- **limitation** you need to run the flow once for the compositor to show images
- **limitation** careful on random values on the left of the node, the node stops the execution on config change to be able to grab a capture and re-enqueues the flow. if the cache is invalidated you not be able to go next see here https://github.com/erosDiffusion/ComfyUI-enricos-nodes/issues/63  
  when I tried implementing threading pause it was not reliable, so I resorted to stop / restart. another option would be a while loop...but that feels not right.
- **tools** new tools only show up on load, so if you add them, reload page with browser reload
- **known issue**: the compositing is not scaled, so if you want a 5k image well... I hope you have a big enough monitor, but it's not (yet) the goal of this node...

**Now go put a fairy in a forest!**

## 🤖 NEW: Qwen2.5-VL Vision Language Models

This package now includes support for Qwen2.5-VL vision-language models for image captioning, visual question answering, and OCR tasks!

### Features:

- **Multiple Model Sizes**: Support for 3B, 7B, 32B, and 72B parameter models
- **Memory Optimization**: 4-bit/8-bit quantization and CPU offload options
- **Dual Implementation**: Both transformers (GPU) and GGUF (CPU) support
- **ComfyUI Integration**: Proper model management and caching
- **Flexible Usage**: Image captioning, VQA, OCR, creative descriptions

### Quick Start:

1. Install dependencies: `pip install -r requirements_qwen.txt`
2. Add "💜 Qwen Vision Loader" and "💜 Qwen Vision Processor" nodes
3. Connect your image and text prompt
4. Generate detailed descriptions, extract text, or answer questions about images!

See [QWEN_INTEGRATION.md](QWEN_INTEGRATION.md) for detailed documentation and examples.

---

yours, ErosDiffusion 💜

![v3.PNG](assets%2Fv3.0.2.PNG)
