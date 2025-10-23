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
from comfy.utils import common_upscale

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


class CompositorConfig3:
    NOT_IDEMPOTENT = True

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "width": ("INT", {"default": 512, "min": 0, "max": MAX_RESOLUTION, "step": 32, "tooltip": "Width of the composition area in pixels"}),
                "height": ("INT", {"default": 512, "min": 0, "max": MAX_RESOLUTION, "step": 32, "tooltip": "Height of the composition area in pixels"}),
                "padding": ("INT", {"default": 100, "min": 0, "max": MAX_RESOLUTION, "step": 1, "tooltip": "Extra space around the composition area for positioning images outside the canvas"}),
                "normalizeHeight": ("BOOLEAN", {"default": False, "tooltip": "Scale all input images to the same height while maintaining aspect ratio"}),
                "onConfigChanged": ("BOOLEAN", {"label_off": "stop", "label_on": "Grab and Continue", "default": False, "tooltip": "When enabled, automatically grabs the snapshot and continues execution. When disabled, pauses to allow manual composition"}),
                "invertMask": ("BOOLEAN", {"default": False, "tooltip": "Invert the alpha channel of all input masks before applying them to images"}),
                "saveFormat": (["PNG Level 0 (fastest)", "PNG Level 1", "PNG Level 9 (smallest)", "JPEG (quality 100)", "WebP Lossless", "BMP (uncompressed)"], {"default": "PNG Level 0 (fastest)", "tooltip": "Image format for saving compositor images. PNG Level 0 is fastest, Level 9 creates smallest files"}),
                "saveFolder": (["temp", "input", "output"], {"default": "output", "tooltip": "Folder where compositor images are saved: temp (temporary), input, or output directory"}),
                "initialized": ("STRING", {"default": "", "tooltip": "Internal state field, do not modify"}),
            },
            "optional": {
                "image1": ("IMAGE", {"tooltip": "First input image (optional)"}),
                "mask1": ("MASK", {"tooltip": "Alpha mask for first image (optional)"}),
                "image2": ("IMAGE", {"tooltip": "Second input image (optional)"}),
                "mask2": ("MASK", {"tooltip": "Alpha mask for second image (optional)"}),
                "image3": ("IMAGE", {"tooltip": "Third input image (optional)"}),
                "mask3": ("MASK", {"tooltip": "Alpha mask for third image (optional)"}),
                "image4": ("IMAGE", {"tooltip": "Fourth input image (optional)"}),
                "mask4": ("MASK", {"tooltip": "Alpha mask for fourth image (optional)"}),
                "image5": ("IMAGE", {"tooltip": "Fifth input image (optional)"}),
                "mask5": ("MASK", {"tooltip": "Alpha mask for fifth image (optional)"}),
                "image6": ("IMAGE", {"tooltip": "Sixth input image (optional)"}),
                "mask6": ("MASK", {"tooltip": "Alpha mask for sixth image (optional)"}),
                "image7": ("IMAGE", {"tooltip": "Seventh input image (optional)"}),
                "mask7": ("MASK", {"tooltip": "Alpha mask for seventh image (optional)"}),
                "image8": ("IMAGE", {"tooltip": "Eighth input image (optional)"}),
                "mask8": ("MASK", {"tooltip": "Alpha mask for eighth image (optional)"}),
            },
            "hidden": {
                "prompt": "PROMPT",
                "extra_pnginfo": "EXTRA_PNGINFO",
                "node_id": "UNIQUE_ID",
            },
        }

    RETURN_TYPES = ("COMPOSITOR_CONFIG", "COMPOSITOR_CONFIG")
    RETURN_NAMES = ("config", "extendedConfig")
    OUTPUT_TOOLTIPS = ("Configuration object containing compositor settings and processed images", 
                       "Extended configuration including all raw input parameters")

    FUNCTION = "configure"

    CATEGORY = "image"
    DESCRIPTION = "Configuration node for the compositor system. Accepts up to 8 images with optional masks, applies masking to create RGBA composites, and provides canvas sizing controls. The 'onConfigChanged' pause option allows time to build compositions before continuing execution. Outputs configuration objects used by compositor debug nodes."

    def configure(self, **kwargs):
        # capture all inputs for extendedConfig
        all_inputs = kwargs.copy()
        # extract the images
        # convert them from tensor to pil and then to base 64
        # send as custom to be able to be used by ui
        # finally return the resulting image (the composite "image" is seen as input but it's actually the output)

        image1 = kwargs.pop('image1', None)
        image2 = kwargs.pop('image2', None)
        image3 = kwargs.pop('image3', None)
        image4 = kwargs.pop('image4', None)
        image5 = kwargs.pop('image5', None)
        image6 = kwargs.pop('image6', None)
        image7 = kwargs.pop('image7', None)
        image8 = kwargs.pop('image8', None)
        mask1 = kwargs.pop('mask1', None)
        mask2 = kwargs.pop('mask2', None)
        mask3 = kwargs.pop('mask3', None)
        mask4 = kwargs.pop('mask4', None)
        mask5 = kwargs.pop('mask5', None)
        mask6 = kwargs.pop('mask6', None)
        mask7 = kwargs.pop('mask7', None)
        mask8 = kwargs.pop('mask8', None)
        # pause = kwargs.pop('pause', False)
        padding = kwargs.pop('padding', 100)
        width = kwargs.pop('width', 512)
        height = kwargs.pop('height', 512)
        invertMask = kwargs.pop('invertMask', False)
        normalizeHeight = kwargs.pop('normalizeHeight', 512)
        saveFormat = kwargs.pop('saveFormat', 'PNG Level 0 (fastest)')
        saveFolder = kwargs.pop('saveFolder', 'output')
        # grabAndContinue, stop
        onConfigChanged = kwargs.pop('onConfigChanged', False)
        node_id = kwargs.pop('node_id', None)

        images = [image1, image2, image3, image4, image5, image6, image7, image8, ]
        masks = [mask1, mask2, mask3, mask4, mask5, mask6, mask7, mask8, ]
        input_images = []

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
                    # if normalizeHeight:
                    #     # print(mask)
                    #     #mask = self.upscale(img, "lanczos", height, "height", "disabled")
                    #     mask = prepare_mask(mask, foo_is_batch=True)
                    #     mask = processor.scale_image(mask, height)

                    # apply the mask and return
                    # apply the mask and return
                    masked = self.apply_mask(img, mask, invertMask)
                    # self.masked = masked[0]

                    i = tensor2pil(masked[0])
                    # Save image to disk and return filename instead of base64
                    # Use index (0-7) for the input slot number
                    filename = saveImageToCompositorFolder(i, node_id, index, saveFormat, saveFolder)
                    input_images.append(filename)
                else:
                    # no need to apply the mask
                    i = tensor2pil(img)
                    # Save image to disk and return filename instead of base64
                    # Use index (0-7) for the input slot number
                    filename = saveImageToCompositorFolder(i, node_id, index, saveFormat, saveFolder)
                    input_images.append(filename)
            else:
                # input is None, forward
                input_images.append(img)

        self.ensureEmpty()

        res = {
            "node_id": node_id,
            "width": width,
            "height": height,
            "padding": padding,
            "names": input_images,
            "onConfigChanged": onConfigChanged,
            "normalizeHeight": normalizeHeight,
            "invertMask": invertMask,
            "saveFolder": saveFolder,
        }        
        return (res, all_inputs)

    def apply_mask(self, image: torch.Tensor, alpha: torch.Tensor, invertMask=False):
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

    # ensures empty.png exists
    def ensureEmpty(self):
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
            return width, height

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