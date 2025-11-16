import nodes
import numpy as np
import base64
from io import BytesIO
from PIL import Image
import folder_paths
import torch
import torch.nn.functional as F
import math
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


class CompositorConfig3:
    NOT_IDEMPOTENT = True

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "width": ("INT", {"default": 512, "min": 0, "max": MAX_RESOLUTION, "step": 32}),
                "height": ("INT", {"default": 512, "min": 0, "max": MAX_RESOLUTION, "step": 32}),
                "padding": ("INT", {"default": 100, "min": 0, "max": MAX_RESOLUTION, "step": 1}),
                "normalizeHeight": ("BOOLEAN", {"default": False}),
                "onConfigChanged": ("BOOLEAN", {"label_off": "stop", "label_on": "Grab and Continue", "default": False}),
                "invertMask": ("BOOLEAN", {"default": False}),
                "initialized": ("STRING", {"default": ""}),
            },
            "optional": {
                "image1": ("IMAGE",),
                "mask1": ("MASK",),
                "image2": ("IMAGE",),
                "mask2": ("MASK",),
                "image3": ("IMAGE",),
                "mask3": ("MASK",),
                "image4": ("IMAGE",),
                "mask4": ("MASK",),
                "image5": ("IMAGE",),
                "mask5": ("MASK",),
                "image6": ("IMAGE",),
                "mask6": ("MASK",),
                "image7": ("IMAGE",),
                "mask7": ("MASK",),
                "image8": ("IMAGE",),
                "mask8": ("MASK",),
            },
            "hidden": {
                "prompt": "PROMPT",
                "extra_pnginfo": "EXTRA_PNGINFO",
                "node_id": "UNIQUE_ID",
            },
        }

    RETURN_TYPES = ("COMPOSITOR_CONFIG", "COMPOSITOR_CONFIG")
    RETURN_NAMES = ("config", "extendedConfig")

    FUNCTION = "configure"

    CATEGORY = "image"
    DESCRIPTION = """
The compositor node
- pass up to 8 images
- optionally pass their masks (invert them)
- masks are automatically applied and internally the compositor is passed an rgba
- use the sizing controls to configure the compositor, it will be resized on run
- set the flag to pause to allow yourself time to build your composition (pause acts on compositor, not the config node)
"""

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
        # grabAndContinue, stop
        onConfigChanged = kwargs.pop('onConfigChanged', False)
        node_id = kwargs.pop('node_id', None)

        images = [image1, image2, image3, image4, image5, image6, image7, image8, ]
        masks = [mask1, mask2, mask3, mask4, mask5, mask6, mask7, mask8, ]
        input_images = []

        # apply the masks to the images if any so that we get a rgba
        # then pass the rgba in the return value
        counter = 0
        for (img, mask) in zip(images, masks):
            if img is not None:

                if normalizeHeight:
                    # print(counter)
                    counter = counter+1
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
                    input_images.append(toBase64ImgUrl(i))
                else:
                    # no need to apply the mask
                    i = tensor2pil(img)
                    input_images.append(toBase64ImgUrl(i))
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