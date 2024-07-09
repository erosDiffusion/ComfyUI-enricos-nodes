# from .enricosCompositor import EnricosCompositor
from .nodes_compositor import Compositor


NODE_CLASS_MAPPINGS = {
  # "EnricosCompositor": EnricosCompositor,
  "Compositor": Compositor,
}

NODE_DISPLAY_NAME_MAPPINGS = {
  # "EnricosCompositor": "Enrico: Compositor",
  "Compositor": "Compositor",
}

EXTENSION_NAME = "Enrico"

WEB_DIRECTORY = "./web"
