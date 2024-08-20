## Compositor Node

0.0.0-Alpha version :)

![the compositor node](/assets/sample.png)

### Setup
```git clone https://github.com/erosDiffusion/ComfyUI-enricos-nodes.git``` into your custom nodes directory like all other custom nodes (that are not integrated with manager)

if you try to install via Git URL in manager get "This action is not allowed with this security level configuration" then check your manager config.ini
as discussed [here](https://github.com/ltdrdata/ComfyUI-Manager?tab=readme-ov-file#security-policy):
and set the security to weak (at your risk)

![the compositor node](/assets/weak.png)


### Demo
demo workflows: after installing, drag and drop in your comfy and Pray (if nothing happens, like the red box does not scale and you can't see images after running once) refresh and run again.

![demo workflow 1](/assets/demo.png)
![demo workflow 2](/assets/demo2.png)


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
**method1**:
- start from demo workflow, you find the images in the assets folder in the cloned repo
- 
**Method2**:
  - search compositor in the dropdown (old comfy gui)
  - scale the node to a big size if it does not to it alone by dragging the right bottom corner
  - configure width, height and padding around node (it's used to be able to move beyond the generated image)
  - leave capture on queue on
  - connect the inputs (suggested setup is to always have a fixed size via resize and rembg where needed)
  - run once to get the inputs in the compositor
  - create your composition *
  - run again (if seeds are fixed or images static only compositor will run)
  - use output
   
    **Create your composition details:**
    
  - put your images in the dark gray area
  - you can put stuff until the red area 
  - anything in the dark gray area is rendered
  - use up till 8 images

### Advanced
- click to select
- use controls to rotate and scale
- drag selected to move
- shift click to select multiple
- **order of layers** images on connected on top should be below with background being the first connected... but it's not guaranteed it's preserved if you regenerate one only, need to double check.
- click capture to see what is the real order in memory before running (after the first run where images are generated/associated to the editor)  
- ethere were some conflict with other nodes, maybe because of how I'm importing the fabric library which is used to do the magic...have to check

### Final words and limitations

- could conflict with other nodes
- you need to run it once to see images in the compositor as first run is somewhat bugged
- you can only have 1 in the tree...
- only tested in a portable comfy with no additional nodes (version is from around june 2024 before gui revamp)
- known issue: for some reason the first load does won't make the red box change size when you type or slide (it should)
- known issue: first run might not show images in the editor, if so, reload with browser reload and re-run it should be ok.

far from perfect, but hey.. it did not exist before and maybe you can still enjoy it for simple use cases.

**Now go stack your bananas!**
