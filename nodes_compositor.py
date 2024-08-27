import nodes
import folder_paths
from server import PromptServer
from aiohttp import web
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

class Compositor(nodes.LoadImage):
    #INPUT_IS_LIST=True
    #OUTPUT_NODE = False
    last_ic = {}
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "image": ("COMPOSITOR", {}),
                "width": ("INT", {"default": 0, "min": 0, "max": MAX_RESOLUTION, "step": 32}),
                "height": ("INT", {"default": 0, "min": 0, "max": MAX_RESOLUTION, "step": 32}),
                "padding": ("INT", {"default": 0, "min": 0, "max": MAX_RESOLUTION, "step": 1}),
                "capture_on_queue": ("BOOLEAN", {"default": True}),
                # "onexecute": (["Pause", "Pass through"], {}),
                "pause":  ("BOOLEAN", {"default": True}),

            },
            "optional": {
                "image1": ("IMAGE",),
                "image2": ("IMAGE",),
                "image3": ("IMAGE",),
                "image4": ("IMAGE",),
                "image5": ("IMAGE",),
                "image6": ("IMAGE",),
                "image7": ("IMAGE",),
                "image8": ("IMAGE",),
            },
            "hidden": {"prompt": "PROMPT", "extra_pnginfo": "EXTRA_PNGINFO", "id": "UNIQUE_ID"},
        }

    RETURN_TYPES = ("IMAGE",)
    # RETURN_NAMES = ("composite",)
    FUNCTION = "composite"

    CATEGORY = "image"

    @classmethod
    def IS_CHANGED(s, id, **kwargs):
        # mode = kwargs.get("onexecute","")
        if (not id[0] in s.last_ic): s.last_ic[id[0]] = random.random()
        return s.last_ic[id[0]]

    # def composite(s, image, **kwargs):
    def composite(self, image, **kwargs):
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

        images = [image1, image2, image3, image4, image5, image6, image7, image8, ]
        input_images = []

        for img in images:
            if img is not None:
                i = tensor2pil(img)
                input_images.append(toBase64ImgUrl(i))
            else:
                input_images.append(img)

        PromptServer.instance.send_sync(
            "compositor.images", {"names": input_images}
        )

        if pause:
            #raise InterruptProcessingException()
            return ExecutionBlocker(None)

        else:
            res = super().load_image(folder_paths.get_annotated_filepath(image))

            # call PreviewImage base
            #ret = self.save_images(images=images_in, **kwargs)

            # send the images to view
            #PromptServer.instance.send_sync("early-image-handler", {"id": id, "urls":ret['ui']['images']})

            #try:
            #    is_block_condition = (mode == "Always pause" or mode == "Progress first pick" or self.batch > 1)
            #    is_blocking_mode = (mode not in ["Pass through", "Take First n", "Take Last n"])
            #    selections = MessageHolder.waitForMessage(id, asList=True) if (is_blocking_mode and is_block_condition) else [0]
            #except Cancelled:
            #    raise InterruptProcessingException()
            #    return (None, None,)

            return res





NODE_CLASS_MAPPINGS = {
    "Compositor": Compositor,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "Compositor": "Compositor",
}
