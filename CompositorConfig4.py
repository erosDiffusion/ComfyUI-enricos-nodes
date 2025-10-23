import nodes
import numpy as np
import base64
from io import BytesIO
from PIL import Image
import folder_paths
import torch
import torch.nn.functional as F
import math
import os
import hashlib
import time
from comfy.utils import common_upscale
from typing_extensions import override
from comfy_api.latest import ComfyExtension, io

MAX_RESOLUTION = nodes.MAX_RESOLUTION


# these probably exist elsewhere as utils
def tensor2pil(image):
    return Image.fromarray(np.clip(255. * image.cpu().numpy().squeeze(), 0, 255).astype(np.uint8))


# these probably exist elsewhere as utils
def toBase64ImgUrl(img):
    bytesIO = BytesIO()
    img.save(bytesIO, format="PNG")
    img_types = bytesIO.getvalue()
    img_base64 = base64.b64encode(img_types)
    return f"data:image/png;base64,{img_base64.decode('utf-8')}"


# Save image to specified folder/compositor subfolder and return filename
def saveImageToCompositorFolder(img, config_node_id, index, save_format, save_folder):
    """
    Saves a PIL image to the {save_folder}/compositor folder with a persistent filename.
    Format: cfg{config_node_id}-in{index}.{ext}
    This ensures the same filename is used across workflow loads.
    The filename is based on the config node ID and input index, making it persistent.
    Returns the filename (not full path) so frontend can load it.
    
    Supports multiple lossless formats with different speed/size tradeoffs.
    save_folder can be: "temp", "input", or "output"
    """
    # Get the appropriate directory based on save_folder
    if save_folder == "input":
        base_dir = folder_paths.get_input_directory()
    elif save_folder == "output":
        base_dir = folder_paths.get_output_directory()
    else:  # default to temp
        base_dir = folder_paths.get_temp_directory()
    
    compositor_dir = os.path.join(base_dir, "compositor")
    
    # Ensure the compositor directory exists
    os.makedirs(compositor_dir, exist_ok=True)
    
    # Determine format and extension based on user selection
    if save_format == "PNG Level 0 (fastest)":
        ext = "png"
        format_name = "PNG"
        save_kwargs = {"compress_level": 0}
    elif save_format == "PNG Level 1":
        ext = "png"
        format_name = "PNG"
        save_kwargs = {"compress_level": 1}
    elif save_format == "PNG Level 9 (smallest)":
        ext = "png"
        format_name = "PNG"
        save_kwargs = {"compress_level": 9}
    elif save_format == "JPEG (quality 100)":
        ext = "jpg"
        format_name = "JPEG"
        # Convert RGBA to RGB if necessary (JPEG doesn't support alpha)
        if img.mode == 'RGBA':
            # Create white background
            background = Image.new('RGB', img.size, (255, 255, 255))
            background.paste(img, mask=img.split()[3])  # Use alpha channel as mask
            img = background
        elif img.mode != 'RGB':
            img = img.convert('RGB')
        save_kwargs = {"quality": 100, "subsampling": 0}
    elif save_format == "WebP Lossless":
        ext = "webp"
        format_name = "WebP"
        save_kwargs = {"lossless": True, "quality": 100}
    elif save_format == "BMP (uncompressed)":
        ext = "bmp"
        format_name = "BMP"
        save_kwargs = {}
    else:
        # Default to PNG Level 0
        ext = "png"
        format_name = "PNG"
        save_kwargs = {"compress_level": 0}
    
    # Generate persistent filename
    filename = f"cfg{config_node_id}-in{index}.{ext}"
    filepath = os.path.join(compositor_dir, filename)
    
    # Save the image with the specified format
    img.save(filepath, format=format_name, **save_kwargs)
    
    return filename


# V4: Save mask to compositor folder with fixed naming pattern
def saveMaskToCompositorFolder(mask_tensor, config_node_id, index, save_folder):
    """
    Saves a mask tensor to the {save_folder}/compositor folder as a grayscale PNG.
    Format: cfg{config_node_id}-mask{index}.png
    This ensures the same filename is used across workflow loads.
    Returns the filename (not full path) so frontend can load it.
    
    save_folder can be: "temp", "input", or "output"
    """
    # Get the appropriate directory based on save_folder
    if save_folder == "input":
        base_dir = folder_paths.get_input_directory()
    elif save_folder == "output":
        base_dir = folder_paths.get_output_directory()
    else:  # default to temp
        base_dir = folder_paths.get_temp_directory()
    
    compositor_dir = os.path.join(base_dir, "compositor")
    
    # Ensure the compositor directory exists
    os.makedirs(compositor_dir, exist_ok=True)
    
    # Convert mask tensor to PIL Image (grayscale)
    # mask_tensor shape: [batch, height, width] or [height, width]
    if mask_tensor.ndim == 3:
        mask_np = mask_tensor[0].cpu().numpy()  # Take first batch
    else:
        mask_np = mask_tensor.cpu().numpy()
    
    # Convert to 0-255 range
    mask_np = np.clip(255. * mask_np, 0, 255).astype(np.uint8)
    
    # Create PIL Image in grayscale mode
    mask_img = Image.fromarray(mask_np, mode='L')
    
    # Generate persistent filename
    filename = f"cfg{config_node_id}-mask{index}.png"
    filepath = os.path.join(compositor_dir, filename)
    
    # Save as PNG (grayscale)
    mask_img.save(filepath, format="PNG")
    
    return filename


class CompositorConfig4(io.ComfyNode):
    #NOT_IDEMPOTENT = True

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="CompositorConfig4",
            display_name="Compositor Config V4",
            category="image",
            description="Configuration node for the compositor system V4. Accepts up to 8 images with optional masks, applies masking to create RGBA composites, and provides canvas sizing controls. Masks are serialized to disk with fixed naming (cfg{node_id}-mask{index}.png). The 'onConfigChangedContinue' pause option allows time to build compositions before continuing execution. Outputs configuration objects used by compositor V4 nodes.",
            inputs=[
                io.Int.Input("width", default=512, min=0, max=MAX_RESOLUTION, step=32, tooltip="Width of the composition area in pixels"),
                io.Int.Input("height", default=512, min=0, max=MAX_RESOLUTION, step=32, tooltip="Height of the composition area in pixels"),
                io.Int.Input("padding", default=100, min=0, max=MAX_RESOLUTION, step=1, tooltip="Extra space around the composition area for positioning images outside the canvas"),
                io.Boolean.Input("normalizeHeight", default=False, tooltip="Scale all input images to the same height while maintaining aspect ratio"),
                io.Boolean.Input("onConfigChangedContinue", default=False, label_off="stop", label_on="Grab and Continue", tooltip="When enabled, automatically grabs the snapshot and continues execution. When disabled, pauses to allow manual composition"),
                io.Boolean.Input("invertMask", default=False, tooltip="Invert the alpha channel of all input masks before applying them to images"),
                io.Combo.Input("saveFormat", options=["PNG Level 0 (fastest)", "PNG Level 1", "PNG Level 9 (smallest)", "JPEG (quality 100)", "WebP Lossless", "BMP (uncompressed)"], default="PNG Level 0 (fastest)", tooltip="Image format for saving compositor images. PNG Level 0 is fastest, Level 9 creates smallest files"),
                io.Combo.Input("saveFolder", options=["temp", "input", "output"], default="output", tooltip="Folder where compositor images and masks are saved: temp (temporary), input, or output directory"),                
                # Optional image inputs
                io.Image.Input("image1", optional=True, tooltip="First input image (optional)"),
                io.Mask.Input("mask1", optional=True, tooltip="Alpha mask for first image (optional)"),
                io.Image.Input("image2", optional=True, tooltip="Second input image (optional)"),
                io.Mask.Input("mask2", optional=True, tooltip="Alpha mask for second image (optional)"),
                io.Image.Input("image3", optional=True, tooltip="Third input image (optional)"),
                io.Mask.Input("mask3", optional=True, tooltip="Alpha mask for third image (optional)"),
                io.Image.Input("image4", optional=True, tooltip="Fourth input image (optional)"),
                io.Mask.Input("mask4", optional=True, tooltip="Alpha mask for fourth image (optional)"),
                io.Image.Input("image5", optional=True, tooltip="Fifth input image (optional)"),
                io.Mask.Input("mask5", optional=True, tooltip="Alpha mask for fifth image (optional)"),
                io.Image.Input("image6", optional=True, tooltip="Sixth input image (optional)"),
                io.Mask.Input("mask6", optional=True, tooltip="Alpha mask for sixth image (optional)"),
                io.Image.Input("image7", optional=True, tooltip="Seventh input image (optional)"),
                io.Mask.Input("mask7", optional=True, tooltip="Alpha mask for seventh image (optional)"),
                io.Image.Input("image8", optional=True, tooltip="Eighth input image (optional)"),
                io.Mask.Input("mask8", optional=True, tooltip="Alpha mask for eighth image (optional)"),
            ],
            outputs=[
                io.Custom("COMPOSITOR_CONFIG").Output(display_name="config", tooltip="Configuration object containing compositor settings and processed images with mask filenames"),
            ],
            hidden=[
                io.Hidden.prompt,
                io.Hidden.extra_pnginfo,
                io.Hidden.unique_id,
            ]
        )

    @classmethod
    def execute(cls, width, height, padding, normalizeHeight, onConfigChangedContinue, invertMask, saveFormat, saveFolder,
                image1=None, mask1=None, image2=None, mask2=None, image3=None, mask3=None,
                image4=None, mask4=None, image5=None, mask5=None, image6=None, mask6=None,
                image7=None, mask7=None, image8=None, mask8=None) -> io.NodeOutput:
        
        import random
        hash_input = str(random.random())
        
        # Force applyMaskInConfig to True (frontend clipPath not fully functional)
        applyMaskInConfig = True

        print(f"[CompositorConfig4] execute called")
        # Access hidden inputs via cls.hidden
        node_id = cls.hidden.unique_id if cls.hidden else None
        extra_pnginfo = cls.hidden.extra_pnginfo if cls.hidden else None
        prompt = cls.hidden.prompt if cls.hidden else None
        
        # Capture all inputs for extendedConfig
        all_inputs = {
            "width": width, "height": height, "padding": padding,
            "normalizeHeight": normalizeHeight, "onConfigChangedContinue": onConfigChangedContinue,
            "invertMask": invertMask, "applyMaskInConfig": applyMaskInConfig, "saveFormat": saveFormat, "saveFolder": saveFolder,
            "configSignature": hash_input,
            "image1": image1, "mask1": mask1, "image2": image2, "mask2": mask2,
            "image3": image3, "mask3": mask3, "image4": image4, "mask4": mask4,
            "image5": image5, "mask5": mask5, "image6": image6, "mask6": mask6,
            "image7": image7, "mask7": mask7, "image8": image8, "mask8": mask8,
            "prompt": prompt, "extra_pnginfo": extra_pnginfo, "node_id": node_id
        }

        images = [image1, image2, image3, image4, image5, image6, image7, image8, ]
        masks = [mask1, mask2, mask3, mask4, mask5, mask6, mask7, mask8, ]
        input_images = []
        mask_filenames = []  # V4: Track mask filenames

        # Generate a random hash that changes on every execution
        # This forces the Compositor4 node to re-execute every time
        
        
        # Generate final hash
        # config_signature = hashlib.md5(hash_input.encode()).hexdigest()

        # apply the masks to the images if any so that we get a rgba
        # then pass the rgba in the return value
        for index, (img, mask) in enumerate(zip(images, masks)):
            if img is not None:

                if normalizeHeight:
                    # print(index)
                    #img = self.upscale(img, "lanczos", height, "height", "disabled")
                    processor = ImageProcessor()
                    oldimg = img
                    img = processor.scale_image(img, height)
                    #print(oldimg == img)
                # tensor

                if mask is not None:
                    # V4: Save mask to disk
                    mask_filename = saveMaskToCompositorFolder(mask, node_id, index, saveFolder)
                    mask_filenames.append(mask_filename)
                    
                    if applyMaskInConfig:
                        # Mode 1: Apply mask in config (create RGBA)
                        masked = cls.apply_mask(img, mask, invertMask)
                        i = tensor2pil(masked[0])
                        filename = saveImageToCompositorFolder(i, node_id, index, saveFormat, saveFolder)
                        input_images.append(filename)
                    else:
                        # Mode 2: Save RGB without mask (frontend will apply via clipPath)
                        i = tensor2pil(img)
                        filename = saveImageToCompositorFolder(i, node_id, index, saveFormat, saveFolder)
                        input_images.append(filename)
                else:
                    # V4: No mask, append None to maintain index alignment
                    mask_filenames.append(None)
                    
                    # no mask to apply
                    i = tensor2pil(img)
                    # Save image to disk and return filename instead of base64
                    # Use index (0-7) for the input slot number
                    filename = saveImageToCompositorFolder(i, node_id, index, saveFormat, saveFolder)
                    input_images.append(filename)
            else:
                # V4: No image, append None to both lists
                mask_filenames.append(None)
                # input is None, forward
                input_images.append(img)

        cls.ensureEmpty()

        res = {
            "node_id": node_id,
            "width": width,
            "height": height,
            "padding": padding,
            "names": input_images,
            "maskNames": mask_filenames,  # V4: Add mask filenames to config
            "onConfigChangedContinue": onConfigChangedContinue,
            "normalizeHeight": normalizeHeight,
            "invertMask": invertMask,
            "applyMaskInConfig": applyMaskInConfig,  # V4: Pass mask application mode to compositor
            "saveFolder": saveFolder,
            "configSignature": hash_input,  # Hash that changes on every execution
            # V4: Include raw tensors for layer processing
            "raw_images": images,
            "raw_masks": masks,
        }
        
        return io.NodeOutput(res)

    @classmethod
    def apply_mask(cls, image: torch.Tensor, alpha: torch.Tensor, invertMask=False):
        batch_size = min(len(image), len(alpha))
        out_images = []

        if invertMask:
            alpha = 1.0 - resize_mask(alpha, image.shape[1:])
        else:
            alpha = resize_mask(alpha, image.shape[1:])

        for i in range(batch_size):
            out_images.append(torch.cat((image[i][:, :, :3], alpha[i].unsqueeze(2)), dim=2))

        result = (torch.stack(out_images),)
        return result

    @classmethod
    def ensureEmpty(cls):
        image = "test_empty.png"
        if not folder_paths.exists_annotated_filepath(image):
            # print("it does not exist")
            img = Image.new('RGB', (512, 512), 'white')
            img.save(folder_paths.get_annotated_filepath(image))

    def upscale(self, image, upscale_method, side_length: int, side: str, crop):
        samples = image.movedim(-1, 1)

        size = get_image_size(image)

        width_B = int(size[0])
        height_B = int(size[1])

        width = width_B
        height = height_B

        def determineSide(_side: str) -> tuple[int, int]:
            width, height = 0, 0
            if _side == "Width":
                heigh_ratio = height_B / width_B
                width = side_length
                height = heigh_ratio * width
            elif _side == "Height":
                width_ratio = width_B / height_B
                height = side_length
                width = width_ratio * height
            return int(width), int(height)

        if side == "Longest":
            if width > height:
                width, height = determineSide("Width")
            else:
                width, height = determineSide("Height")
        elif side == "Shortest":
            if width < height:
                width, height = determineSide("Width")
            else:
                width, height = determineSide("Height")
        else:
            width, height = determineSide(side)

        width = math.ceil(width)
        height = math.ceil(height)

        cls = common_upscale(samples, width, height, upscale_method, crop)
        cls = cls.movedim(1, -1)
        return (cls,)


def get_image_size(IMAGE) -> tuple[int, int]:
    samples = IMAGE.movedim(-1, 1)
    size = samples.shape[3], samples.shape[2]
    # size = size.movedim(1, -1)
    return size


def resize_mask(mask, shape):
    return torch.nn.functional.interpolate(mask.reshape((-1, 1, mask.shape[-2], mask.shape[-1])),
                                           size=(shape[0], shape[1]), mode="bilinear").squeeze(1)

class ImageProcessor:
    def scale_image(self, image_tensor, new_height):
        # Ensure the input tensor is in the format [batch_size, height, width, channels]
        if image_tensor.ndim != 4:
            raise ValueError("Expected image tensor to have shape [batch_size, height, width, channels]")

        batch_size, original_height, original_width, channels = image_tensor.shape

        if channels not in (1, 3, 4):
            raise ValueError("Image tensor must have 1 (grayscale), 3 (RGB), or 4 (RGBA) channels")

        # Calculate the new width to maintain the aspect ratio
        aspect_ratio = original_width / original_height
        new_width = int(new_height * aspect_ratio)

        # Permute to match PyTorch's expected format [batch_size, channels, height, width]
        image_tensor = image_tensor.permute(0, 3, 1, 2)  # [batch_size, channels, height, width]

        # Resize images to the new dimensions (new_height, new_width)
        resized_images = F.interpolate(image_tensor, size=(new_height, new_width), mode='bilinear', align_corners=False)

        # Permute back to the original format [batch_size, height, width, channels]
        resized_images = resized_images.permute(0, 2, 3, 1)  # [batch_size, height, width, channels]

        return resized_images


def prepare_mask(mask, foo_is_batch):
    """
    Prepares the mask tensor to have shape [batch_size, height, width, channels].

    Arguments:
    mask: Tensor of shape [foo, width, height]
    foo_is_batch: Bool, True if `foo` represents the batch size, False if it represents the channel.
    """
    if foo_is_batch:
        # Case where `foo` is the batch size, reshape to [batch_size, height, width, channels=1]
        mask = mask.unsqueeze(3)  # Add a channel dimension [batch_size, width, height] -> [batch_size, width, height, 1]
    else:
        # Case where `foo` is the channel dimension, reshape to [1, height, width, channels]
        mask = mask.unsqueeze(0).permute(0, 2, 3, 1)  # Add batch dim and permute to [1, height, width, channels]

    return mask


# V4 Extension and Entry Point
class CompositorConfig4Extension(ComfyExtension):
    @override
    async def get_node_list(self) -> list[type[io.ComfyNode]]:
        return [CompositorConfig4]


async def comfy_entrypoint() -> CompositorConfig4Extension:
    return CompositorConfig4Extension()
