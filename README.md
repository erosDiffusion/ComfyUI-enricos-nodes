## Create complex compositions the FAST and EASY way

![the compositor node](/assets/showreel1.png)

How many times do you need to create something like this?
![the compositor node](/assets/showreel1.jpg)

Well, This node was created to make the composition process quick and easy!

## The Compositor Node
With the Compositor Node you can:
- Pass up to 8 images and visually place, rotate and scale them to build the perfect composition.
- Group move and group rescale the images. choose your transform center (corner, or center by using ctrl)
- Remember the position, scaling values and z-index across generations and easily easy swap images.
- Use the buffer zone to park an asset you don't want to use or easily reach transformations controls
- Clearly see the exported area through a green overlay
- Easily re-frame your shot via multiple selection scaling, resizing and re-positioning
- flip an image via negative scaling (drag a corner towards and past the inside of the image)
- mask your images quickly
- move with keyboard

## Changelog
  - v **2.0.0** - 05.09.2024 - **V2 is HERE!**
    - _enhancement_: An all **new widget layout** with maximized working area and less clutter
    - _new feature_: A **new companion configuration widget** to allow more control and easier maintenance
    - _enhancement_: More control! it's now possible to select an image or group and then pressing and holding control right before the movement to **center scale and rotate**
    - _new feature_: More control! it's now possible to **nudge a selection** by one pixel by using keyboard arrows, and while holding shift the movement is 10px! pixel perfect alignments!
    - _new feature_: the node now **remembers the transforms** you have applied, so on refresh or exchanging a flow the composition will be the same! (size of json is bigger as it now contains a lot of metadata)
    - _new feature_: you can now **pass masks** and they will be applied automatically!
    - _regression_: a bit annoying but is_changed is not being observed so flows are re-triggered even on fixed

![the compositor node](/assets/v2.PNG)


  - V **1.0.9** - 30.08.2024 - Huge refactoring!
    - _new feature_: **multiple instances** are now possible
    - _bugfix_: **zooming out does not hide the compositor images anymore**
    - _bugfix_: when **saving a png with the workflow** the **compositor content is now visible** (will not be restored...yet)
    - _enhancement_: the node **does not re-trigger** the execution of the flow if the image is not changed
    - _performance_: the node is **now more efficient** and correctly implements the is_changed check via **checksum**, avoiding re-triggering flows downstream if the composition has not changed
    - _mantainability_: the node is now refactored and better engineered, with a lot of comments. could be a good use case for those learning to code comfy extensions.
  - V **1.0.8** - 28.08.2024 - _new feature_: **safe area  indication** - a green border is overlaid on top of the composition to indicate the exported area  
  - V **1.0.7** - 28.08.2024 - _new feature_: **preserve stacking order**. when selecting a node, it's z-order is preserved image1 being the background/farthest and image8 the foreground/closest.
    - the first connected node will be the most distant from camera (background)
    - the last will be the closest to camera (subject/foreground)
  - V **1.0.4** - 27.08.2024 - _new feature_: now it's possible to **pause the flow** with a switch to avoid processing an unfinished composition
  



### Setup

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



### Why this node ?

- I wanted to learn how to create custom nodes with a GUI in ComfyUI
- be able to composite visually images in ComfyUI
- be able to have image inputs that are generated on the fly in the composition
- be able to remember sizing and position across usages/generations
- have more room to manipulate objects around/outside the generated image

### Alternatives ?

- the painter node is great and works better and does a million things more, but it misses some of these features.
- continue compositing your image like caveman using pixel coordinates
- well...photoshop and import via million clicks
- use krita or photoshop integrations with comfy (inversion of control)

### How to use

**Method1**:

- search "compositor" in the dropdown, connect with config by dragging from the node config slot.
- configure width, height and padding around node (it's used to be able to move beyond the generated image) the node should will resize when you run
- leave capture on queue on (at the moment it's always applying)
- connect the inputs (suggested setup is to always have a fixed size via resize and rembg where needed)
- important: connect the output (save image, preview image,...)
- set to pause
- run once to get the inputs in the compositor
- **create your composition** (see below)
- remove pause
- run again
- use the output ! (suggestion is to feed it to a depth anything v2 node and use it in a depth controlnet to guide your image)

**Create your composition details:**

- put your images in the dark gray area
- you can connect any flow (generation with fixed, static rgba, full rgb)  
- anything in the dark gray area is rendered
- use up till 8 images, optionally pass masks
- background will be at first slot on top
- in v 1.0.9 and later the z-index is fixed, reconnect an input or move stuff around. it should be simpler to handle depth stacking

### Advanced

- click to select
- drag (from a clear area) to select multiple
- use controls to rotate and scale
- drag selected to move (can also rescale the group)
- shift click to select multiple
- shift click to unselect selected in a group select
- click "capture" to see what is the real order in memory before running (after the first run where images are generated/associated to the editor)

### supporting nodes I use with this one
- **Rembg(batch)** -> from https://github.com/Mamaaaamooooo/batchImg-rembg-ComfyUI-nodes.git -> extracts the subject and returns a rgba image
- any **controlnet depth for your model** - works well with depth anything v2 preprocessor for both 1.5 (regular controlnet) and xl (via union controlnet) or lineart (like anylineart), for flux you can try x-labs controlnet (but it does not work well for me)
  

### More examples (with advanced worfkflow you can find in the repo assets/output examples folder)

Just throw the worst possible images you find on the internet or that you can generate...
...scale and align quick, give a depth controlnet, describe the full scene and style, render...
and you will get:

![demo workflow 2](/assets/gallerySamples.jpg)

now you are in pixel perfect positioning control of your scene and content !

### Final words and limitations

- **limitation** you need to run the flow once for the compositor to show images. so just run on fixed or import static and pause/stop the flow, next time you will start from the compositon
- **known issue**: the compositing is not scaled, so if you want a 5k image well... I hope you have a big enough monitor, but it's not (yet) the goal of this node...

far from perfect, but hey... it did not exist before, and maybe you can still enjoy it for simple use cases.

**Now go put some bowtie on the model and render!**

yours, ErosDiffusion
