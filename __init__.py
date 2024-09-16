# author: erosdiffusionai@gmail.com
# from .nodes_compositor import Compositor
# from .CompositorConfig import CompositorConfig
from .Compositor3 import Compositor3
from .CompositorConfig3 import CompositorConfig3
from .Alignment import Alignment

NODE_CLASS_MAPPINGS = {
    # "Compositor": Compositor,
    # "CompositorConfig": CompositorConfig,
    "Compositor3": Compositor3,
    "CompositorConfig3": CompositorConfig3,
    "Alignment": Alignment,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    #"Compositor": "Compositor",
    #"CompositorConfig": "CompositorConfig",
    "Compositor3": "Compositor V3",
    "CompositorConfig3": "Compositor Config V3",
    "Alignment": "Alignment",
}

EXTENSION_NAME = "Enrico"

WEB_DIRECTORY = "./web"
