#setup
```git clone into``` custom nodes like all other custom nodes

#why this node
- be able to composite visually images in comfy
- be able to have image inputs that are generated on the fly in the composition
- be able to remember sizing and position across usages/generations
- have more room to manipulate objects around/outside the generated image

#alternatives ?
- the painter node is great and works better but it misses some of these features

#how to use
- search compositor in the dropdown (old comfy gui)
- configure width, height and padding around node (it's used to be able to move beyond the generated image)
- leave capture on queue on
- connect the inputs (suggested setup is to always have a fixed size via resize and rembg where needed)
- run once to get the inputs in the compositor
- do composition
- run again (if seeds are fixed or images static only compositor will run)
- use output

#advanced
- click to select
- use controls to rotate and scale
- drag selected to move
- shift click to select multiple
- order of layers ** should top down ** background is zero and so on, but it's not guaranteed it's preserved if you regenerate one
- click capture to see what is the real order in memory before running
- for some reason the first load does nont make the red box change size when you type or slide or does not load images, after generation reload it it should be ok...until I understand why
- ethere were some conflict with other nodes, maybe because of how I'm importing the fabric library which is used to do the magic...have to check

#final words
"maybe" enjoy...
- could conflict with other nodes
- you need to run it once to see images in the compositor
- far from perfect, but hey.. it did not exist before.
