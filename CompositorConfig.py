# author: erosdiffusionai@gmail.com
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


class CompositorConfig:
    OUTPUT_NODE = False

    # @classmethod
    # def IS_CHANGED(cls, **kwargs):
    #     file = kwargs.get("image")
    #     return file

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                # "image": ("COMPOSITOR_CONFIG", {"lazy": True}),
                "width": ("INT", {"default": 512, "min": 0, "max": MAX_RESOLUTION, "step": 32}),
                "height": ("INT", {"default": 512, "min": 0, "max": MAX_RESOLUTION, "step": 32}),
                "padding": ("INT", {"default": 100, "min": 0, "max": MAX_RESOLUTION, "step": 1}),
                "capture_on_queue": ("BOOLEAN", {"default": True}),
                "pause": ("BOOLEAN", {"default": True}),
            },
            "optional": {
                "image1": ("IMAGE",),
                "mask1": ("MASK",),
                "image2": ("IMAGE",),
                "mask2": ("MASK",),
                "image3": ("IMAGE",),
                "mask3": ("MASK",),
                "image4": ("IMAGE",),
                "mask4": ("MASK",),
                "image5": ("IMAGE",),
                "mask5": ("MASK",),
                "image6": ("IMAGE",),
                "mask6": ("MASK",),
                "image7": ("IMAGE",),
                "mask7": ("MASK",),
                "image8": ("IMAGE",),
                "mask8": ("MASK",),
            },
            "hidden": {
                "prompt": "PROMPT",
                "extra_pnginfo": "EXTRA_PNGINFO",
                "node_id": "UNIQUE_ID",
            },
        }

    RETURN_TYPES = ("COMPOSITOR_CONFIG",)
    RETURN_NAMES = ("config",)

    FUNCTION = "configure"

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

    def configure(self, **kwargs):
        # extract the images
        # convert them from tensor to pil and then to base 64
        # send as custom to be able to be used by ui
        # finally return the resulting image (the composite "image" is seen as input but it's actually the output)

        # onexecute = kwargs.pop('onexecute', ["Pause", ])
        pause = kwargs.pop('pause', False)
        # print(onexecute)
        # print(self.last_ic)

        # image = kwargs.pop('image', None)
        image1 = kwargs.pop('image1', None)
        image2 = kwargs.pop('image2', None)
        image3 = kwargs.pop('image3', None)
        image4 = kwargs.pop('image4', None)
        image5 = kwargs.pop('image5', None)
        image6 = kwargs.pop('image6', None)
        image7 = kwargs.pop('image7', None)
        image8 = kwargs.pop('image8', None)
        mask1 = kwargs.pop('mask1', None)
        mask2 = kwargs.pop('mask2', None)
        mask3 = kwargs.pop('mask3', None)
        mask4 = kwargs.pop('mask4', None)
        mask5 = kwargs.pop('mask5', None)
        mask6 = kwargs.pop('mask6', None)
        mask7 = kwargs.pop('mask7', None)
        mask8 = kwargs.pop('mask8', None)
        pause = kwargs.pop('pause', None)
        capture_on_queue = kwargs.pop('capture_on_queue', None)
        padding = kwargs.pop('padding', None)
        width = kwargs.pop('width', None)
        height = kwargs.pop('height', None)
        node_id = kwargs.pop('node_id', None)

        images = [image1, image2, image3, image4, image5, image6, image7, image8, ]
        masks = [mask1, mask2, mask3, mask4, mask5, mask6, mask7, mask8, ]
        input_images = []

        # apply the masks to the images if any so we get an rgba
        # then pass the rgba in the return value

        for img in images:
            if img is not None:
                i = tensor2pil(img)
                input_images.append(toBase64ImgUrl(i))
            else:
                input_images.append(img)

        # PromptServer.instance.send_sync(
        #     "compositor.images", {"names": input_images, "node": node_id}
        # )

        # res = []
        # res.append({"pause": pause,
        #             "padding": padding,
        #             "capture_on_queue": capture_on_queue,
        #             "width": width,
        #             "height": height,
        #             "node_id": node_id
        #             })
        # res = super().load_image(folder_paths.get_annotated_filepath(image))

        # call PreviewImage base
        # ret = self.save_images(images=images_in, **kwargs)

        # send the images to view
        # PromptServer.instance.send_sync("early-image-handler", {"id": id, "urls":ret['ui']['images']})

        # try:
        #    is_block_condition = (mode == "Always pause" or mode == "Progress first pick" or self.batch > 1)
        #    is_blocking_mode = (mode not in ["Pass through", "Take First n", "Take Last n"])
        #    selections = MessageHolder.waitForMessage(id, asList=True)
        #    if (is_blocking_mode and is_block_condition) else [0]
        # except Cancelled:
        #    raise InterruptProcessingException()
        #    return (None, None,)
        res = {"pause": pause,
               "padding": padding,
               "capture_on_queue": capture_on_queue,
               "width": width,
               "height": height,
               "node_id": node_id
               }
        return (res, )
