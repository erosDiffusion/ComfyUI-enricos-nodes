## Compositor Node

- pass up to 8 images and visually place, rotate and scale them to build the perfect composition.
- group move and group rescale.
- remember their position and scaling value across generations to easy swap images.
- use the buffer zone to park an asset you don't want to use or easily reach transformations controls

1.0.1 (Alpha version)

![the compositor node](/assets/sample.png)

### Setup

**Method 1: git clone**
open the custom nodes directory in your editor and

```git clone https://github.com/erosDiffusion/ComfyUI-enricos-nodes.git```

like all other custom nodes (that are not integrated with manager)

**Method 2: ComfyUi Manager**
In Comfy UI Manager search "Compositor" and select the node from erosDiffusion and press install.

**Method 3: via manager's button**
open ComfyUI manager click on **install via Git URL** and paste this url

```https://github.com/erosDiffusion/ComfyUI-enricos-nodes.git```


if you get: "This action is not allowed with this security level configuration" then check your manager config.ini
as discussed [here](https://github.com/ltdrdata/ComfyUI-Manager?tab=readme-ov-file#security-policy):
and set the security to weak (at your risk)

![the compositor node](/assets/weak.png)


### Demo
Demo workflows: after installing, drag and drop in your comfy and Pray (if nothing happens, like the red box does not scale and you can't see images after running once) refresh and run again.

Sample Workflow (with MTB nodes rembg for background removal)
![demo workflow 2](/assets/demo2.png)

Sample Workflow (with batch rembg for background removal)
![demo workflow 1](/assets/demo.png)



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
- start from demo workflow, for the simple ones you find the images in the assets folder in the cloned repo

**Method2**:
- search "compositor" in the dropdown
- scale the node to a big size  by dragging the right bottom corner of the node (if it does not to it alone using the size controls inside the node or you can't reach them)
- configure width, height and padding around node (it's used to be able to move beyond the generated image) the node should resie with the image area and the red box should also grow with the padding or image size.
- leave capture on queue on (when you queue the node it should "fetch" your latest and greatest composition... to be sure I always click capture manually before enqueuing the prompt after the first run if I've changed the composition)
- connect the inputs (suggested setup is to always have a fixed size via resize and rembg where needed)
- important: connect the output (save image, preview image,...)
- run once to get the inputs in the compositor
- __create your composition__ (see below)
- run again (if seeds are fixed or images static only compositor will run)
- use the output ! (suggestion is to feed it to a depth anything v2 node and use it in a depth controlnet to guide your image)
 
**Create your composition details:**
  
- put your images in the dark gray area
- you can connect any flow (generation with fixed, static rgba, full rgb)
- you can move stuf until the red area and partly outside the rendering area
- anything in the dark gray area is rendered
- anything within the red area can be manipulated
- use up till 8 images
- background will be at first slot on top
- if you loose the focus and something goes on top, just move it away group pick what's below and put it in front of the moved image, shift click, move all back into place (this is until we put some focus management in place...send to back send to front, make unselectable and so on)

### Advanced
- click to select
- drag (from a clear area) to select multiple 
- use controls to rotate and scale
- drag selected to move (can also rescale the group)
- shift click to select multiple
- shift click to unselect selected in a group select
- **order of layers** images on connected on top should be below with background being the first connected... but it's not guaranteed it's preserved if you regenerate one only, need to double check.
- click "capture" to see what is the real order in memory before running (after the first run where images are generated/associated to the editor)  
- ethere were some conflict with other nodes, maybe because of how I'm importing the fabric library which is used to do the magic...have to check
- if you accidentally click a big background it will be on top of the other ones...move it aside, shift click and select all others, move them to the background, shift click to include background, move all back into place)

 ### supporting nodes I use with this one 
- use rembg(batch) https://github.com/Mamaaaamooooo/batchImg-rembg-ComfyUI-nodes.git
- AlphaChanelAddByMask node to create an rgba image from drawing a mask to have transparent images in the composition https://github.com/ZHO-ZHO-ZHO/ComfyUI-Text_Image-Composite
- any controlnet depth for your model

### More examples (with advanced worfkflow you can find in the repo assets/output examples folder)
Just throw the worst possible images you find on the internet or that you can generate...
...scale and align quick, give a depth controlnet, describe the full scene and style, render...
and you will get:

![demo workflow 2](/assets/gallerySamples.jpg)

now you are in pixel perfect positioning control of your scene and content.

### Final words and limitations


- **limitation** you need to run the flow once for the compositor to show images. so just run on fixed or import static and stop the flow, next time you will start from the compositon
- **limitation** you can only have 1 in the tree...
- **known issue**: for some reason the first load might not make the red box change size of the node...
- **known issue**: first run might not show images in the editor, if so, reload with browser reload and re-run it should be ok.
- **known issue**: if you zoom out too much the rendering inside the node might fail (just zoom in)
- **known issue**: the compositing is not scaled, so if you want a 5k image well... I hope you have a big enough monitor, but it's not (yet) the goal of this node...
- **limitation** reloading a flow with compositor will not reload the compostion (x/y position of images and their sizes) you will have to re-do the compositing by hand.

far from perfect, but hey... it did not exist before, and maybe you can still enjoy it for simple use cases.

**Now go stack your apples!**

yours, ErosDiffusion
