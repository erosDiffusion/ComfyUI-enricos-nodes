import nodes
import numpy as np
import base64
from io import BytesIO
from PIL import Image
import torch
import folder_paths


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

    RETURN_TYPES = ("COMPOSITOR_CONFIG",)
    RETURN_NAMES = ("config",)

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
        node_id = kwargs.pop('node_id', None)

        images = [image1, image2, image3, image4, image5, image6, image7, image8, ]
        masks = [mask1, mask2, mask3, mask4, mask5, mask6, mask7, mask8, ]
        input_images = []

        # apply the masks to the images if any so that we get a rgba
        # then pass the rgba in the return value

        for (img, mask) in zip(images, masks):
            if img is not None:
                if mask is not None:
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
            "invertMask": invertMask,
            "names": input_images,
        }
        print(f"compositor config {node_id} executed")
        # return (res, self.masked, )
        return (res,)

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
            print("it does not exist")
            img = Image.new('RGB', (512,512), 'white')
            img.save(folder_paths.get_annotated_filepath(image))


def resize_mask(mask, shape):
    return torch.nn.functional.interpolate(mask.reshape((-1, 1, mask.shape[-2], mask.shape[-1])),
                                           size=(shape[0], shape[1]), mode="bilinear").squeeze(1)
