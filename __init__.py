# author: erosdiffusionai@gmail.com
from .nodes_compositor import Compositor
from .Compositor2 import Compositor2
from .CompositorConfig import CompositorConfig
from .CompositorConfig2 import CompositorConfig2
from .Alignment import Alignment


NODE_CLASS_MAPPINGS = {
  "CompositorConfig": CompositorConfig,
  "CompositorConfig2": CompositorConfig2,
  "Compositor": Compositor,
  "Compositor2": Compositor2,
  "Alignment": Alignment,
}

NODE_DISPLAY_NAME_MAPPINGS = {
  "CompositorConfig": "CompositorConfig",
  "CompositorConfig2": "CompositorConfig2",
  "Compositor": "Compositor",
  "Compositor2": "Compositor2",
  "Alignment": "Alignment",
}

EXTENSION_NAME = "Enrico"

WEB_DIRECTORY = "./web"
