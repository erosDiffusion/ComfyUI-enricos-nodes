import folder_paths
from server import PromptServer
from comfy_execution.graph import ExecutionBlocker
from PIL import Image, ImageOps
import numpy as np
import torch
import json
from typing_extensions import override
from comfy_api.latest import ComfyExtension, io


# Helper functions for tensor/PIL conversions
def tensor2pil(image: torch.Tensor) -> Image.Image:
    return Image.fromarray(np.clip(255. * image.cpu().numpy().squeeze(0), 0, 255).astype(np.uint8))

def pil2tensor(image: Image.Image) -> torch.Tensor:
    return torch.from_numpy(np.array(image).astype(np.float32) / 255.0).unsqueeze(0)

def create_empty_mask(width, height, inverted=False):
    """Create an empty mask tensor with specified dimensions."""
    try:
        value = 255 if inverted else 0
        empty_mask = Image.new('L', (width, height), value)
        return pil2tensor(empty_mask)
    except Exception as e:
        print(f"Error creating empty mask: {e}")
        value = 255 if inverted else 0
        fallback_mask = Image.new('L', (1, 1), value)
        return pil2tensor(fallback_mask)

def place_on_canvas(image_tensor, canvas_width, canvas_height, left, top, scale_x=1.0, scale_y=1.0, mask_tensor=None, invert_mask=True):
    """
    Place an image tensor on a canvas of specified dimensions at the given position.
    Returns: Tuple of (positioned image tensor, positioned mask tensor)
    """
    if image_tensor is None:
        return None, None
        
    try:
        # Convert tensor to PIL for manipulation
        pil_image = tensor2pil(image_tensor)
        
        # Convert to RGBA to preserve transparency
        if pil_image.mode != 'RGBA':
            pil_image = pil_image.convert('RGBA')
            
        # Create alpha channel if not already present
        if len(pil_image.split()) < 4:
            r, g, b = pil_image.split()
            alpha = Image.new('L', pil_image.size, 255)
            pil_image = Image.merge('RGBA', (r, g, b, alpha))
            
        # Convert mask tensor to PIL if provided
        pil_mask = None
        if mask_tensor is not None:
            pil_mask = tensor2pil(mask_tensor)
            if pil_mask.mode != 'L':
                pil_mask = pil_mask.convert('L')
        
        # Apply scaling if needed
        original_width, original_height = pil_image.size
        if scale_x != 1.0 or scale_y != 1.0:
            new_width = max(1, int(original_width * scale_x))
            new_height = max(1, int(original_height * scale_y))
            if new_width > 0 and new_height > 0:
                pil_image = pil_image.resize((new_width, new_height), Image.Resampling.LANCZOS)
                if pil_mask is not None:
                    pil_mask = pil_mask.resize((new_width, new_height), Image.Resampling.LANCZOS)
        
        # Create a transparent canvas for the image
        canvas = Image.new('RGBA', (canvas_width, canvas_height), (0, 0, 0, 0))
        
        # Create a mask canvas
        mask_canvas = Image.new('L', (canvas_width, canvas_height), 255 if invert_mask else 0)
        
        # Calculate position with integer precision
        pos_left = int(left)
        pos_top = int(top)
        
        # Paste the image onto the canvas with transparency
        canvas.paste(pil_image, (pos_left, pos_top), pil_image.split()[3])
        
        # Get the dimensions of the placed image
        placed_width = min(pil_image.width, canvas_width - pos_left) if pos_left < canvas_width else 0
        placed_height = min(pil_image.height, canvas_height - pos_top) if pos_top < canvas_height else 0
        
        # Create a bounding box mask
        if placed_width > 0 and placed_height > 0:
            bbox_value = 0
            bbox_rect = Image.new('L', (placed_width, placed_height), bbox_value)
            mask_canvas.paste(bbox_rect, (pos_left, pos_top))
        
        # Process the input mask if provided
        if pil_mask is not None:
            input_mask_canvas = Image.new('L', (canvas_width, canvas_height), 0)
            input_mask_canvas.paste(pil_mask, (pos_left, pos_top))
            
            if invert_mask:
                input_mask_canvas = ImageOps.invert(input_mask_canvas)
            
            mask_array = np.array(mask_canvas)
            input_mask_array = np.array(input_mask_canvas)
            
            if invert_mask:
                combined_array = np.maximum(mask_array, input_mask_array)
            else:
                combined_array = np.minimum(mask_array, input_mask_array)
            
            mask_canvas = Image.fromarray(combined_array.astype(np.uint8))
        
        # Convert back to tensors
        r, g, b, a = canvas.split()
        rgb_image = Image.merge('RGB', (r, g, b))
        
        positioned_image_tensor = pil2tensor(rgb_image)
        positioned_mask_tensor = pil2tensor(mask_canvas)
        
        return positioned_image_tensor, positioned_mask_tensor
    except Exception as e:
        print(f"Error placing image on canvas: {e}")
        return image_tensor, mask_tensor


class Compositor4(io.ComfyNode):
    """
    V4 compositor node with integrated mask handling
    """
    
    # Dictionary to cache config for each node instance, indexed by node_id
    configCache = {}
    
    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="Compositor4",
            display_name="Compositor V4",
            category="image",
            description="Interactive compositor canvas for positioning, scaling, rotating, and arranging multiple images with real-time preview and mask support. Provides a visual editor with layers panel, alignment tools, and snap-to-grid functionality.",
            inputs=[
                io.String.Input("fabricData", default="", multiline=False, tooltip="JSON string containing the compositor state (transforms, positions, visibility). Auto-managed by the compositor interface"),
                io.String.Input("imageName", default="", multiline=False, tooltip="Name of the snapshot image file. Auto-generated based on graph and node ID"),
                io.String.Input("seed", default="0", multiline=False, tooltip="Random seed value that changes on each save to trigger node re-execution. Auto-updated by the compositor interface"),
                io.Custom("COMPOSITOR_CONFIG").Input("config", tooltip="Configuration from CompositorConfig4 containing canvas size, images, masks, raw tensors, and settings"),
            ],
            outputs=[
                io.Image.Output(display_name="image", tooltip="Final composed image rendered from the compositor canvas"),
                io.String.Output(display_name="fabricData_output", tooltip="Compositor state data (transforms, positions, etc.)"),
                io.String.Output(display_name="imageName_output", tooltip="Filename of the saved composition snapshot"),
                # io.String.Output(display_name="transforms", tooltip="JSON transform data for Compositor4TransformsOut node"),
                # io.Custom("COMPOSITOR_OUTPUT_MASKS").Output(display_name="layer_outputs", tooltip="Layer outputs (images and masks) for Compositor4MasksOutput node"),
            ],
            hidden=[
                io.Hidden.extra_pnginfo,
                io.Hidden.unique_id,
            ],
            is_output_node=True,
        )


    @classmethod
    def execute(cls, fabricData, imageName, seed, config) -> io.NodeOutput:
        # Access hidden inputs via cls.hidden
        node_id = cls.hidden.unique_id if cls.hidden else None
        extra_pnginfo = cls.hidden.extra_pnginfo if cls.hidden else None
        
        print(f"[Compositor4] execute: node_id={node_id}, imageName={imageName}")
        
        fabricData = fabricData or "default"
        imageName = imageName or "default"
        
        # Handle config - it should be a dict from CompositorConfig4
        if not config or not isinstance(config, dict):
            print(f"[Compositor4] Config invalid or missing")
            # If config is missing or invalid, we can't proceed
            blocker_result = tuple([ExecutionBlocker(None)] * 3)  # V4: 3 outputs now
            ui = {"error": ["Config input required from CompositorConfig4 node"]}
            return io.NodeOutput(*blocker_result, ui=ui)
        
        padding = config.get("padding", 0)
        invertMask = config.get("invertMask", False)
        applyMaskInConfig = config.get("applyMaskInConfig", True)
        width = config.get("width", 512)
        height = config.get("height", 512)
        config_node_id = config.get("node_id")
        onConfigChangedContinue = config.get("onConfigChangedContinue", False)
        names = config.get("names", [])
        maskNames = config.get("maskNames", [])  # V4: Get mask filenames
        saveFolder = config.get("saveFolder", "output")
        configSignature = config.get("configSignature", None)

        # Detect if configuration has changed since last run for this specific node
        # Use the config signature (hash) generated by CompositorConfig4
        # This signature changes whenever ANY input changes (images, masks, parameters)
        cached_signature = cls.configCache.get(node_id)
        configChanged = cached_signature != configSignature
        
        print(f"[Compositor4] configChanged={configChanged}, onConfigChangedContinue={onConfigChangedContinue}")
        
        # Store the current signature using compositor node's ID as key
        cls.configCache[node_id] = configSignature

        ui = {
            #"test": ("value",),
            "padding": [padding],
            "width": [width],
            "height": [height],
            "config_node_id": [config_node_id],
            "node_id": [node_id],
            "names": names,
            "maskNames": maskNames,  # V4: Pass mask filenames to frontend
            "applyMaskInConfig": [applyMaskInConfig],  # V4: Pass mask application mode to frontend
            "fabricData": [fabricData],
            "configSignature": [configSignature],
            "configChanged": [configChanged],
            "onConfigChangedContinue": [onConfigChangedContinue],
            "saveFolder": [saveFolder],
        }

        print(ui)

        detail = {"output": ui, "node": node_id}
        PromptServer.instance.send_sync("compositor4_init", detail)

        # when config changes, will always stop, frontend decides what to do next
        # this sends an executed event , with blocker
        if configChanged:
            blocker_result = tuple([ExecutionBlocker(None)] * 3)  # V4: 3 outputs now
            print(f"[Compositor4] Config changed, blocking execution for user interaction, user decides what to do next")
            return io.NodeOutput(*blocker_result, ui=ui)

        # Config hasn't changed - proceed to load existing image
        print(f"[Compositor4] Config unchanged, proceeding to load image")
        
        # Check if imageName is valid (not default/empty)
        if not imageName or imageName == "default" or imageName.strip() == "":
            print(f"[Compositor4] No valid imageName - this is first run or widget not set, blocking")
            blocker_result = tuple([ExecutionBlocker(None)] * 3)  # V4: 3 outputs now
            return io.NodeOutput(*blocker_result, ui=ui)
        
        # Construct path based on saveFolder
        folder_path = f"../{saveFolder}/compositor/{imageName}"
        imageExists = folder_paths.exists_annotated_filepath(folder_path)
        if not imageExists:
            # Return ExecutionBlocker for all outputs if blocked
            print(f"[Compositor4] Image not found: {folder_path}")
            blocker_result = tuple([ExecutionBlocker(None)] * 3)  # V4: 3 outputs now
            return io.NodeOutput(*blocker_result, ui=ui)
        image_path = folder_paths.get_annotated_filepath(folder_path)
        print(f"[Compositor4] Loading image: {image_path}")
        i = Image.open(image_path)
        i = ImageOps.exif_transpose(i)
        if i.mode == 'I':
            i = i.point(lambda i: i * (1 / 255))
        image = i.convert("RGB")
        image = np.array(image).astype(np.float32) / 255.0
        image = torch.from_numpy(image)[None, ]
        
        # V4: Prepare transforms output (JSON string for Compositor4TransformsOut)
        transforms_output = fabricData  # fabricData already contains the transforms JSON
        
        # V4: Process individual layer images and masks with transforms
        rotated_images = [None] * 8
        rotated_masks = [None] * 8
        canvas_width = width
        canvas_height = height
        
        try:
            fabric_data_parsed = json.loads(fabricData)
            canvas_width = int(fabric_data_parsed.get("width", width))
            canvas_height = int(fabric_data_parsed.get("height", height))
            print(f"[Compositor4] Canvas dimensions: {canvas_width}x{canvas_height}")
            
            # Get transforms and bboxes arrays
            fabric_transforms = fabric_data_parsed.get('transforms', [])
            fabric_bboxes = fabric_data_parsed.get('bboxes', [])
            
            if not fabric_transforms:
                fabric_transforms = [{} for _ in range(8)]
            if not fabric_bboxes:
                fabric_bboxes = [{} for _ in range(8)]
            
            # V4: Get raw image/mask tensors from config
            raw_images = config.get("raw_images", [None] * 8)
            raw_masks = config.get("raw_masks", [None] * 8)
            
            for idx in range(8):
                # Get raw tensors from arrays
                original_image_tensor = raw_images[idx] if idx < len(raw_images) else None
                original_mask_tensor = raw_masks[idx] if idx < len(raw_masks) else None
                
                if original_image_tensor is not None and idx < len(fabric_transforms):
                    # Get transformation data
                    transform = fabric_transforms[idx]
                    angle = transform.get('angle', 0)
                    scale_x = transform.get('scaleX', 1.0)
                    scale_y = transform.get('scaleY', 1.0)
                    
                    # Get positioning data from bboxes
                    bbox = fabric_bboxes[idx] if idx < len(fabric_bboxes) else {'left': 0, 'top': 0}
                    left = bbox.get('left', 0)
                    top = bbox.get('top', 0)
                    
                    print(f"[Compositor4] Processing layer {idx+1}: angle={angle}, pos=({left},{top}), scale=({scale_x},{scale_y})")
                    if original_mask_tensor is not None:
                        print(f"[Compositor4]   - Mask found for layer {idx+1}")
                    
                    # Rotate if needed
                    if angle != 0:
                        try:
                            pil_image = tensor2pil(original_image_tensor)
                            rotated_pil = pil_image.rotate(-angle, expand=True, resample=Image.Resampling.BILINEAR)
                            rotated_tensor = pil2tensor(rotated_pil)
                            
                            rotated_mask_tensor = None
                            if original_mask_tensor is not None:
                                pil_mask = tensor2pil(original_mask_tensor)
                                rotated_pil_mask = pil_mask.rotate(-angle, expand=True, resample=Image.Resampling.BILINEAR)
                                rotated_mask_tensor = pil2tensor(rotated_pil_mask)
                            
                            positioned_tensor, positioned_mask = place_on_canvas(
                                rotated_tensor, 
                                canvas_width, 
                                canvas_height,
                                left - padding,
                                top - padding,
                                scale_x,
                                scale_y,
                                rotated_mask_tensor
                            )
                            rotated_images[idx] = positioned_tensor
                            rotated_masks[idx] = positioned_mask
                        except Exception as e:
                            print(f"[Compositor4] Error processing layer {idx+1}: {e}")
                            positioned_tensor, positioned_mask = place_on_canvas(
                                original_image_tensor,
                                canvas_width,
                                canvas_height,
                                left,
                                top,
                                scale_x,
                                scale_y,
                                original_mask_tensor
                            )
                            rotated_images[idx] = positioned_tensor
                            rotated_masks[idx] = positioned_mask
                    else:
                        # No rotation needed, just position and scale
                        positioned_tensor, positioned_mask = place_on_canvas(
                            original_image_tensor,
                            canvas_width,
                            canvas_height,
                            left - padding,
                            top - padding,
                            scale_x,
                            scale_y,
                            original_mask_tensor
                        )
                        rotated_images[idx] = positioned_tensor
                        rotated_masks[idx] = positioned_mask
                elif original_image_tensor is not None:
                    # No transform data, use original
                    rotated_images[idx] = original_image_tensor
                    rotated_masks[idx] = original_mask_tensor
            
            # Replace None masks with empty masks
            for idx in range(8):
                if rotated_masks[idx] is None:
                    rotated_masks[idx] = create_empty_mask(canvas_width, canvas_height)
            
            # Create compositor output dict
            layer_outputs = {
                "images": rotated_images,
                "masks": rotated_masks,
                "canvas_width": canvas_width,
                "canvas_height": canvas_height
            }
            
            print(f"[Compositor4] Returning image with {sum(1 for img in rotated_images if img is not None)} processed layers")
            return io.NodeOutput(image, fabricData, imageName, ui=ui)
            
        except json.JSONDecodeError:
            print("[Compositor4] Error parsing fabricData JSON. Returning empty layer outputs.")
            empty_output = {
                "images": [None] * 8,
                "masks": [create_empty_mask(canvas_width, canvas_height) for _ in range(8)],
                "canvas_width": canvas_width,
                "canvas_height": canvas_height
            }
            return io.NodeOutput(image, fabricData, imageName, ui=ui)
        except Exception as e:
            print(f"[Compositor4] Unexpected error during layer processing: {e}")
            empty_output = {
                "images": [None] * 8,
                "masks": [create_empty_mask(canvas_width, canvas_height) for _ in range(8)],
                "canvas_width": canvas_width,
                "canvas_height": canvas_height
            }
            return io.NodeOutput(image, fabricData, imageName, ui=ui)


class Compositor4Extension(ComfyExtension):
    @override
    async def get_node_list(self) -> list[type[io.ComfyNode]]:
        return [Compositor4]


async def comfy_entrypoint() -> Compositor4Extension:
    return Compositor4Extension()
