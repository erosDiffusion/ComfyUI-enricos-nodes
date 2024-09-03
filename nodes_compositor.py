import nodes
import folder_paths
from server import PromptServer
# from aiohttp import web
import numpy as np
import base64
from io import BytesIO
from PIL import Image, ImageOps
from comfy_execution.graph import ExecutionBlocker
from pathlib import Path
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

class Compositor(nodes.LoadImage):
    OUTPUT_NODE = False
    counter = 1

    # By default, Comfy considers that a node has changed if any of its inputs or widgets have changed.
    # This is normally correct, but you may need to override this if, for instance,
    # the node uses a random number (and does not specify a seed - it’s best practice to have a seed input in this case
    # so that the user can control reproducability and avoid unecessary execution),
    # or loads an input that may have changed externally, or sometimes ignores inputs
    # (so doesn’t need to execute just because those inputs changed).
    #
    # Despite the name, IS_CHANGED should not return a bool
    # IS_CHANGED is passed the same arguments as the main function defined by FUNCTION,
    # and can return any Python object. This object is compared with the one returned in the previous run (if any)
    # and the node will be considered to have changed if is_changed != is_changed_old
    # (this code is in execution.py if you need to dig).
    # could also be @staticmethod but need to try, or not annotated
    @classmethod
    def IS_CHANGED(cls, **kwargs):
        # it seems that for the image, it's ignored as something else changed ???
        file = kwargs.get("image")
        print(file)
        return file

    # @classmethod
    # def VALIDATE_INPUTS(cls, image, config):
    #     # YOLO, anything goes!
    #     return True

    # def check_lazy_status(self, image, config):
    #     needed = []
    #     if image is None and other_condition:
    #       needed.append("image1")
    #     return needed

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                # about forceInput, lazy and other flags: https://docs.comfy.org/essentials/custom_node_datatypes
                "image": ("COMPOSITOR", {"lazy": True, "default": "test_empty.png"}),
                "config": ("COMPOSITOR_CONFIG", {"forceInput": True}),

            },
            "optional": {

            },
            "hidden": {
                "prompt": "PROMPT",
                "extra_pnginfo": "EXTRA_PNGINFO",
                "node_id": "UNIQUE_ID",
            },
        }

    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("composite",)
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
        image = kwargs.get('image', None)
        config = kwargs.get('config', "default")
        pause = config["pause"]
        padding = config["padding"]
        capture_on_queue = config["capture_on_queue"]
        width = config["width"]
        height = config["height"]
        config_node_id = config["node_id"]
        # images = config["images"]
        names = config["names"]

        node_id = kwargs.pop('node_id', None)
        # additional stuff we might send
        # prompt
        # extra_pnginfo
        # EXTRA_PNGINFO <- will need to save x,y, scale, rotate, skew, etc inside here to be able to re-load
        # EXTRA_PNGINFO is a dictionary that will be copied into the metadata of any .png files saved.
        # Custom nodes can store additional information in this dictionary for saving
        # (or as a way to communicate with a downstream node).

        images = []

        # test progress callback
        # self.progress("test1")
        # self.progress("test2")
        # self.progress("test3")

        # not needed for now, config controls the node
        # PromptServer.instance.send_sync(
        #     "compositor.images", {"names": images, "node": node_id}
        # )

        # values to send the gui for update, includes base64 images
        ui = {
            "test": ("value",),
            "pause": [pause],
            "padding": [padding],
            "capture_on_queue": [capture_on_queue],
            "width": [width],
            "height": [height],
            "config_node_id": [config_node_id],
            "node_id": [node_id],
            # "images": images,
            "names": names,
            "image": [image],
        }

        invalidImage = self.imageDoesNotExist(image)
        isPippo = self.imageIsPippo(image)
        # print(image is None)
        # if pause or image is None:
        if pause or image is None or invalidImage or isPippo:
            # at the end of my main method
            # awkward return types, can't assign variable need tuple (val,) or list [val]
            print(
                f"compositor {node_id} with config {config_node_id} executed, with pause {pause} or image {image} is None {image is None} or invalidImage {invalidImage}]")
            print(f"pause {pause}")
            return {"ui": ui, "result": (ExecutionBlocker(None),)}

        else:
            print(
                f"compositor {node_id} with config {config_node_id} executed, else clause: image {image} is None ? {image is None} or invalidImage {invalidImage}")
            return {"ui": ui, "result": super().load_image(folder_paths.get_annotated_filepath(image))}

    # example of progress feedback, not sure about the details dictionary signature:
    # we're supposed to teg node and prompt_id
    def progress(self, a):
        # node (node id), prompt_id, value, max
        # print(a)
        self.counter = self.counter + 1
        PromptServer.instance.send_sync(
            "progress", {"value": self.counter, "node": None, "prompt_id": None, "max": 10}
        )

    def imageDoesNotExist(self, image):
        return not folder_paths.exists_annotated_filepath(image)

    def imageIsPippo(self, image):
        return image == "test_empty.png"
