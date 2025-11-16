# author: erosdiffusionai@gmail.com
from .Compositor3 import Compositor3
from .CompositorConfig3 import CompositorConfig3

from .CompositorTransformsOut3 import CompositorTransformsOutV3
from .CompositorMasksOutputV3 import CompositorMasksOutputV3
from .CompositorColorPicker import CompositorColorPicker
from .ImageColorSampler import ImageColorSampler

# V4 nodes - new compositor with integrated mask handling
from .Compositor4 import Compositor4
from .CompositorConfig4 import CompositorConfig4
from .Compositor4TransformsOut import Compositor4TransformsOut
from .Compositor4MasksOutput import Compositor4MasksOutput

# Test nodes for debugging config change detection
from .TestNodeA import TestNodeA
from .TestNodeB import TestNodeB

# Qwen Vision Language nodes
try:
    from .QwenVisionLoader import QwenVisionLoader, QwenVisionProcessor
    QWEN_AVAILABLE = True
except ImportError as e:
    print(f"Qwen Vision nodes not available: {e}")
    print("Install dependencies with: pip install -r requirements_qwen.txt")
    QWEN_AVAILABLE = False

# Qwen GGUF nodes (separate import for optional llama-cpp-python dependency)
try:
    from .QwenGGUFLoader import QwenGGUFLoader, QwenGGUFProcessor
    QWEN_GGUF_AVAILABLE = True
except ImportError as e:
    print(f"Qwen GGUF nodes not available: {e}")
    print("Install llama-cpp-python for GGUF support: pip install llama-cpp-python")
    QWEN_GGUF_AVAILABLE = False

# V1-style registration (kept for backward compatibility)
# V3 nodes also have comfy_entrypoint() for modern registration
NODE_CLASS_MAPPINGS = {
    "Compositor3": Compositor3,
    "CompositorConfig3": CompositorConfig3,

    "CompositorTransformsOutV3": CompositorTransformsOutV3,
    "CompositorMasksOutputV3": CompositorMasksOutputV3,
    "CompositorColorPicker": CompositorColorPicker,
    "ImageColorSampler": ImageColorSampler,
    
    # V4 nodes
    "Compositor4": Compositor4,
    "CompositorConfig4": CompositorConfig4,
    "Compositor4TransformsOut": Compositor4TransformsOut,
    "Compositor4MasksOutput": Compositor4MasksOutput,
    
    # Test nodes
    "TestNodeA": TestNodeA,
    "TestNodeB": TestNodeB,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "Compositor3": "💜 Compositor (V3)",
    "CompositorConfig3": "💜 Compositor Config (V3)",

    "CompositorTransformsOutV3": "💜 Compositor Transforms Output (V3)",
    "CompositorMasksOutputV3": "💜 Compositor Masks Output (V3)",
    "CompositorColorPicker": "💜 Compositor Color Picker",
    "ImageColorSampler": "💜 Image Color Sampler",
    
    # V4 nodes
    "Compositor4": "💜 Compositor V4",
    "CompositorConfig4": "💜 Compositor Config V4",
    "Compositor4TransformsOut": "💜 Compositor Transforms Output V4",
    "Compositor4MasksOutput": "💜 Compositor Masks Output V4",
    
    # Test nodes
    "TestNodeA": "🧪 Test Node A (Config)",
    "TestNodeB": "🧪 Test Node B (Blocker)",
}

# Add Qwen nodes if available
if QWEN_AVAILABLE:
    NODE_CLASS_MAPPINGS.update({
        "QwenVisionLoader": QwenVisionLoader,
        "QwenVisionProcessor": QwenVisionProcessor,
    })
    
    NODE_DISPLAY_NAME_MAPPINGS.update({
        "QwenVisionLoader": "💜 Qwen Vision Loader",
        "QwenVisionProcessor": "💜 Qwen Vision Processor",
    })

# Add Qwen GGUF nodes if available
if QWEN_GGUF_AVAILABLE:
    NODE_CLASS_MAPPINGS.update({
        "QwenGGUFLoader": QwenGGUFLoader,
        "QwenGGUFProcessor": QwenGGUFProcessor,
    })
    
    NODE_DISPLAY_NAME_MAPPINGS.update({
        "QwenGGUFLoader": "💜 Qwen GGUF Loader",
        "QwenGGUFProcessor": "💜 Qwen GGUF Processor",
    })

EXTENSION_NAME = "Enrico"

WEB_DIRECTORY = "./web"

# Additional web resources to ensure they're loaded
__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
