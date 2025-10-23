# author: erosdiffusionai@gmail.com
from .Compositor3 import Compositor3
from .CompositorConfig3 import CompositorConfig3
from .CompositorTools3 import CompositorTools3

from .CompositorTransformsOut3 import CompositorTransformsOutV3
from .CompositorMasksOutputV3 import CompositorMasksOutputV3
from .CompositorColorPicker import CompositorColorPicker
from .ImageColorSampler import ImageColorSampler

# V4 nodes - new compositor with integrated mask handling
from .Compositor4 import Compositor4
from .CompositorConfig4 import CompositorConfig4
from .Compositor4TransformsOut import Compositor4TransformsOut
from .Compositor4MasksOutput import Compositor4MasksOutput



# V1-style registration (kept for backward compatibility)
# V3 nodes also have comfy_entrypoint() for modern registration
NODE_CLASS_MAPPINGS = {
    "Compositor3": Compositor3,
    "CompositorConfig3": CompositorConfig3,
    "CompositorTools3": CompositorTools3,
    "CompositorTransformsOutV3": CompositorTransformsOutV3,
    "CompositorMasksOutputV3": CompositorMasksOutputV3,
    # Utilities 
    "CompositorColorPicker": CompositorColorPicker,
    "ImageColorSampler": ImageColorSampler,
    
    # V4 nodes
    "Compositor4": Compositor4,
    "CompositorConfig4": CompositorConfig4,
    "Compositor4TransformsOut": Compositor4TransformsOut,
    "Compositor4MasksOutput": Compositor4MasksOutput,
    

}

NODE_DISPLAY_NAME_MAPPINGS = {
    "Compositor3": "💜 Compositor (V3)",
    "CompositorConfig3": "💜 Compositor Config (V3)",
    "CompositorTools3": "💜 Compositor Tools (V3)",
    "CompositorTransformsOutV3": "💜 Compositor Transforms Output (V3)",
    "CompositorMasksOutputV3": "💜 Compositor Masks Output (V3)",
    # Utilities
    "CompositorColorPicker": "💜 Compositor Color Picker",
    "ImageColorSampler": "💜 Image Color Sampler",
    
    # V4 nodes
    "Compositor4": "💜 Compositor V4",
    "CompositorConfig4": "💜 Compositor Config V4",
    "Compositor4TransformsOut": "💜 Compositor Transforms Output V4",
    "Compositor4MasksOutput": "💜 Compositor Masks Output V4",
}

EXTENSION_NAME = "Enrico"

WEB_DIRECTORY = "./web"

# Additional web resources to ensure they're loaded
__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
