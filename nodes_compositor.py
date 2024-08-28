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
from typing import Dict, List, Optional, Tuple


MAX_RESOLUTION = nodes.MAX_RESOLUTION


# Utility functions, which should be ideally placed in a separate utils.py module
def tensor2pil(image: np.ndarray) -> Image.Image:
    """
    Convert a tensor to a PIL image.

    Args:
        image: The input image tensor.

    Returns:
        A PIL image.
    """
    return Image.fromarray(np.clip(255. * image.cpu().numpy().squeeze(), 0, 255).astype(np.uint8))


def to_base64_img_url(img: Image.Image) -> str:
    """
    Convert a PIL image to a base64-encoded PNG URL.

    Args:
        img: The input PIL image.

    Returns:
        A base64-encoded image URL.
    """
    try:
        bytes_io = BytesIO()
        img.save(bytes_io, format="PNG")
        img_types = bytes_io.getvalue()
        img_base64 = base64.b64encode(img_types)
        return f"data:image/png;base64,{img_base64.decode('utf-8')}"
    except Exception as e:
        # Handle the exception (log it, raise it, etc.)
        return ""


class Compositor(nodes.LoadImage):
    """
    The Compositor node is responsible for combining multiple images.

    Attributes:
        OUTPUT_NODE (bool): Indicates whether the node outputs a final image.
        last_ic (dict): Stores a random value for each node instance.
    """

    OUTPUT_NODE = False
    last_ic = {}

    @classmethod
    def INPUT_TYPES(cls) -> Dict[str, Dict[str, Tuple]]:
        """
        Define the input types for the Compositor node.

        Returns:
            A dictionary describing the required, optional, and hidden inputs.
        """
        inputs = {
            "required": {
                "image": ("COMPOSITOR", {}),
                "width": ("INT", {"default": 0, "min": 0, "max": MAX_RESOLUTION, "step": 32}),
                "height": ("INT", {"default": 0, "min": 0, "max": MAX_RESOLUTION, "step": 32}),
                "padding": ("INT", {"default": 0, "min": 0, "max": MAX_RESOLUTION, "step": 1}),
                "capture_on_queue": ("BOOLEAN", {"default": True}),
                "pause": ("BOOLEAN", {"default": True}),
            },
            "optional": {f"image{i}": ("IMAGE",) for i in range(1, 9)},
            "hidden": {"prompt": "PROMPT", "extra_pnginfo": "EXTRA_PNGINFO", "id": "UNIQUE_ID"},
        }
        return inputs

    RETURN_TYPES = ("IMAGE",)
    FUNCTION = "composite"
    CATEGORY = "image"
    DESCRIPTION = """
The compositor node
- Drag-click to select multiple items.
- Shift-click to add/remove from selected.
- Once you have a multiselection, you can move/scale/rotate all the items together.
- Use the buffer zone to manipulate big items or park them.
- Z-index is non-intuitive; ensure your graph has the items in the same vertical sequence as connected.
- Regenerating shows the sequence; if something doesn't stack correctly, regenerate to see where it goes.
- Using the pause button should stop the flow, but some nodes may throw an error. It's irrelevant, just close it.
"""

    @classmethod
    def is_changed(cls, node_id: str, **kwargs) -> float:
        """
        Check if the node's state has changed.

        Args:
            node_id: The unique identifier for the node.
            **kwargs: Additional arguments.

        Returns:
            A random float value representing the change state.
        """
        if node_id not in cls.last_ic:
            cls.last_ic[node_id] = random.random()
        return cls.last_ic[node_id]

    def check_lazy_status(self, image: Optional[Image.Image], **kwargs) -> List[str]:
        """
        Check the lazy status based on the pause parameter.

        Args:
            image: The input image (not used in this method).
            **kwargs: Additional arguments.

        Returns:
            A list of required statuses based on the pause parameter.
        """
        pause = kwargs.get('pause', False)
        return ["pause"] if pause else []

    def composite(self, image: Image.Image, **kwargs) -> Tuple:
        """
        Combine multiple images into a single composite image.

        Args:
            image: The base image.
            **kwargs: Additional keyword arguments for optional images and settings.

        Returns:
            The resulting composite image.
        """
        pause = kwargs.get('pause', False)
        images = [kwargs.get(f'image{i}') for i in range(1, 9)]

        # Convert tensors to PIL images and then to base64, if they are not None
        input_images = []
        for img in images:
            if img is not None and img.numel() > 0:  # Check if the tensor is not None and has elements
                pil_image = tensor2pil(img)
                base64_img = to_base64_img_url(pil_image)
                input_images.append(base64_img)
            else:
                input_images.append(None)

        PromptServer.instance.send_sync("compositor.images", {"names": input_images})

        if pause:
            return (ExecutionBlocker(None),)

        result_image = super().load_image(folder_paths.get_annotated_filepath(image))
        return result_image


NODE_CLASS_MAPPINGS = {
    "Compositor": Compositor,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "Compositor": "Compositor",
}
