import nodes
import folder_paths
from server import PromptServer
# from aiohttp import web
import numpy as np
import base64
from io import BytesIO
from PIL import Image, ImageOps
from comfy_execution.graph import ExecutionBlocker
import random

MAX_RESOLUTION = nodes.MAX_RESOLUTION


# these probably exist elsewhere as utils
def tensor2pil(image):
    return Image.fromarray(np.clip(255. * image.cpu().numpy().squeeze(), 0, 255).astype(np.uint8))


# these probably exist elsewhere as utils
def toBase64ImgUrl(img):
    bytesIO = BytesIO()
    img.save(bytesIO, format="PNG")
    img_types = bytesIO.getvalue()
    img_base64 = base64.b64encode(img_types)
    return f"data:image/png;base64,{img_base64.decode('utf-8')}"


# compositor type is a customized LoadImage. the image is the output!
# basically we pretend we have loaded a composite image and return it.
# other stuff supports the gui
# ideally we would support any number of inputs to be composited
# it should not be necessary to pass b64 but just the names of the uploaded images
# author: erosdiffusionai@gmail.com

class Compositor:
    # class Compositor(nodes.LoadImage):
    # INPUT_IS_LIST=True
    OUTPUT_NODE = False
    last_ic = {}

    # @classmethod
    # def IS_CHANGED(cls, **kwargs):
    #     file = kwargs.get("image")
    #     return file

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                # {"lazy": True, "forceInput": True}
                "config": ("COMPOSITOR_CONFIG", ),
                "image": ("COMPOSITOR", {"lazy": True}),
            },
            "optional": {

                # "image1": ("IMAGE",),
                # "image2": ("IMAGE",),
                # "image3": ("IMAGE",),
                # "image4": ("IMAGE",),
                # "image5": ("IMAGE",),
                # "image6": ("IMAGE",),
                # "image7": ("IMAGE",),
                # "image8": ("IMAGE",),
            },
            "hidden": {
                "prompt": "PROMPT",
                "extra_pnginfo": "EXTRA_PNGINFO",
                "node_id": "UNIQUE_ID",
            },
        }

    RETURN_TYPES = ("IMAGE",)
    # RETURN_NAMES = ("composite",)
    FUNCTION = "composite"

    CATEGORY = "image"
    DESCRIPTION = """
The compositor node
- drag click to select multiple
- shift click to add/remove from selected
- once you have a multiselection you can move/scale/rotate all the items in the selection together
- use the buffer zone to manipulate big items or park them
- z-index is no intuitive make sure your graph has the items in the same exact vertical sequence on how they are connected
- regenerating shows you the sequence, if something does not stack correctly regenerate to see where it goes
- using the pause button should stop the flow but somenodes don't interpret correctly the break and throw an error. it's irreleveant, just close it
- use "join image with alpha" to apply a mask  (hand drawn or extracted via sam or other way) and get and rgba to pass to the node
- use Image remove background (rembg) from comfyui-rembg-node to extract an rgba image with no background
"""

    def composite(self, **kwargs):

        config = kwargs.get('config', "default")
        pause = config["pause"]
        padding = config["padding"]
        capture_on_queue = config["capture_on_queue"]
        width = config["width"]
        height = config["height"]
        config_node_id = config["node_id"]
        images = config["images"]
        node_id = kwargs.pop('node_id', None)
        # prompt
        # extra_pnginfo

        images = []

        PromptServer.instance.send_sync(
            "compositor.images", {"names": images, "node": node_id}
        )

        if pause:
            return (ExecutionBlocker(None),)
        else:
            return None
