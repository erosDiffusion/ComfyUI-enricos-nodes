# author: erosdiffusionai@gmail.com
from .Compositor3 import Compositor3
from .CompositorConfig3 import CompositorConfig3
from .CompositorTools3 import CompositorTools3
from .CompositorTransformsOut3 import CompositorTransformsOutV3

NODE_CLASS_MAPPINGS = {
    "Compositor3": Compositor3,
    "CompositorConfig3": CompositorConfig3,
    "CompositorTools3": CompositorTools3,
    "CompositorTransformsOutV3": CompositorTransformsOutV3,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "Compositor3": "💜 Compositor (V3)",
    "CompositorConfig3": "💜 Compositor Config (V3)",
    "CompositorTools3": "💜 Compositor Tools (V3) Experimental",
    "CompositorTransformsOutV3": "💜 Compositor Transforms Output (V3)",
}

EXTENSION_NAME = "Enrico"

WEB_DIRECTORY = "./web"
