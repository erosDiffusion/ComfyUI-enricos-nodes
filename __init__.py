# author: erosdiffusionai@gmail.com
# from .nodes_compositor import Compositor
# from .CompositorConfig import CompositorConfig
# from .CompositorConfig import CompositorConfig
from .Compositor3 import Compositor3
from .CompositorConfig3 import CompositorConfig3
from .Alignment import Alignment
from .TransformsOut import CompositorTransformsOutV3

NODE_CLASS_MAPPINGS = {
    # "Compositor": Compositor,
    # "CompositorConfig": CompositorConfig,
    "Compositor3": Compositor3,
    "CompositorConfig3": CompositorConfig3,
    "Alignment": Alignment,
    "CompositorTransformsOutV3": CompositorTransformsOutV3,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    #"Compositor": "Compositor",
    #"CompositorConfig": "CompositorConfig",
    "Compositor3": "💜 Compositor (V3)",
    "CompositorConfig3": "💜 Compositor Config (V3)",
    "Alignment": "💜 Compositor Tools (V3)",
    "CompositorTransformsOutV3": "💜 Compositor Transforms Output (V3)",
}

EXTENSION_NAME = "Enrico"

WEB_DIRECTORY = "./web"
