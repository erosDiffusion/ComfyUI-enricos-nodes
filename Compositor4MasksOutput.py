import torch
from PIL import Image
import numpy as np

class Compositor4MasksOutput:
    """
    This node unpacks the COMPOSITOR_OUTPUT_MASKS from Compositor4 into individual image and mask outputs.
    Makes the Compositor's interface cleaner by separating the layer outputs into a dedicated node.
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "layer_outputs": ("COMPOSITOR_OUTPUT_MASKS",),
            },
            "hidden": {
                "subtract_masks": ("BOOLEAN", {"default": False}),
            }
        }

    RETURN_TYPES = ("IMAGE", "IMAGE", "IMAGE", "IMAGE", "IMAGE", "IMAGE", "IMAGE", "IMAGE",
                   "MASK", "MASK", "MASK", "MASK", "MASK", "MASK", "MASK", "MASK")
    RETURN_NAMES = ("image_1", "image_2", "image_3", "image_4", 
                    "image_5", "image_6", "image_7", "image_8",
                    "mask_1", "mask_2", "mask_3", "mask_4", 
                    "mask_5", "mask_6", "mask_7", "mask_8")
    FUNCTION = "unpack_outputs"
    CATEGORY = "image"

    def unpack_outputs(self, layer_outputs, subtract_masks=False):
        """
        Unpacks the layer_outputs dictionary into individual image and mask outputs.
        
        Args:
            layer_outputs: Dictionary containing 'images', 'masks', 'canvas_width', and 'canvas_height'
            subtract_masks: When True, each mask will have higher-numbered masks subtracted from it
                           (e.g., mask 6 = mask 6 - mask 7, mask 5 = mask 5 - mask 6, etc.)
            
        Returns:
            Tuple of 16 tensors: 8 images and 8 masks in order
        """
        images = layer_outputs.get("images", [None] * 8)
        masks = layer_outputs.get("masks", [None] * 8)
        
        # Get canvas dimensions for creating empty images/masks if needed
        canvas_width = layer_outputs.get("canvas_width", 512)
        canvas_height = layer_outputs.get("canvas_height", 512)
        
        # Create a standard empty black image for missing values
        def create_empty_image(width, height):
            empty_img = Image.new('RGB', (width, height), (0, 0, 0))
            img_np = np.array(empty_img).astype(np.float32) / 255.0
            return torch.from_numpy(img_np)[None, ]
        
        # Create a standard empty mask (white) for missing values
        def create_empty_mask(width, height):
            empty_mask = Image.new('L', (width, height), 255)  # White mask (completely transparent)
            mask_np = np.array(empty_mask).astype(np.float32) / 255.0
            return torch.from_numpy(mask_np)[None, ]
        
        # Ensure we have 8 images and masks
        result_images = []
        result_masks = []
        
        for i in range(8):
            # Handle images
            if i < len(images) and images[i] is not None:
                result_images.append(images[i])
            else:
                result_images.append(create_empty_image(canvas_width, canvas_height))
            
            # Handle masks
            if i < len(masks) and masks[i] is not None:
                result_masks.append(masks[i])
            else:
                result_masks.append(create_empty_mask(canvas_width, canvas_height))
        
        # Apply mask subtraction if enabled
        if subtract_masks:
            processed_masks = result_masks.copy()
            
            # We start from the second-highest mask (index 6, mask 7) and work down
            # mask 8 (index 7) remains unchanged
            for i in range(6, -1, -1):
                current_mask = processed_masks[i]
                higher_mask = processed_masks[i+1]
                
                # Where higher mask has black pixels (visible content), make current mask white (transparent)
                # In mask convention: black (0) = visible, white (1) = transparent
                black_pixels_in_higher = higher_mask < 0.5
                
                # Apply the subtraction - where higher mask has black pixels, make current mask white
                processed_masks[i] = torch.where(black_pixels_in_higher, torch.ones_like(current_mask), current_mask)
            
            result_masks = processed_masks
        
        # Return all images and masks as a flat tuple
        return (*result_images, *result_masks)
