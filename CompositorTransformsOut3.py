# import folder_paths
# from PIL import Image, ImageOps
# import numpy as np
# import torch
# from comfy_execution.graph import ExecutionBlocker
# import threading
# from server import PromptServer
# from aiohttp import web

import json


class CompositorTransformsOutV3:

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "transforms": ("STRING", {"forceInput": True}),
                "channel": ("INT", {"min": 1, "max": 8, "default": 1}),
                "forceInt": ("BOOLEAN", {"default": True}),

            },
            "hidden": {
                "extra_pnginfo": "EXTRA_PNGINFO",
                "node_id": "UNIQUE_ID",
            },
        }

    RETURN_TYPES = ("INT", "INT", "INT", "INT", "INT", "INT", "INT", "INT", "INT")
    RETURN_NAMES = ("x", "y", "width", "height", "angle", "bbox x", "bbox y", "bbox width", "bbox height")

    FUNCTION = "run"
    CATEGORY = "image"

    def run(self, **kwargs):
        node_id = kwargs.pop('node_id', None)
        channel = kwargs.pop('channel', 1)
        transforms = kwargs.pop('transforms', {})
        forceInt = kwargs.pop('forceInt', {})
        # print(transforms)
        data = json.loads(transforms)
        padding = data["padding"]
        # extract transforms
        t = data["transforms"]
        width = t[channel - 1]["xwidth"] * t[channel - 1]["scaleX"]
        height = t[channel - 1]["xheight"] * t[channel - 1]["scaleY"]
        # remove the padding as transforms are padding based
        x = t[channel - 1]["left"] - padding
        y = t[channel - 1]["top"] - padding
        #angle
        angle = t[channel - 1]["angle"]

        # bounding box out
        b = data["bboxes"]
        bwidth = b[channel - 1]["xwidth"]
        bheight = b[channel - 1]["xheight"]
        # remove the padding as transforms are padding based
        bx = b[channel - 1]["left"] - padding
        by = b[channel - 1]["top"] - padding

        if forceInt:
            return (int(x), int(y), int(width), int(height), int(angle), int(bx), int(by), int(bwidth), int(bheight))
        else:
            return (x, y, width, height, angle, bx, by, bwidth, bheight)
