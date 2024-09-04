# author: erosdiffusionai@gmail.com
from .nodes_compositor import Compositor
from .CompositorConfig import CompositorConfig


NODE_CLASS_MAPPINGS = {
  "CompositorConfig": CompositorConfig,
  "Compositor": Compositor,
}

NODE_DISPLAY_NAME_MAPPINGS = {
  # "EnricosCompositor": "Enrico: Compositor",
  "CompositorConfig": "CompositorConfig",
  "Compositor": "Compositor",
}

EXTENSION_NAME = "Enrico"

WEB_DIRECTORY = "./web"
