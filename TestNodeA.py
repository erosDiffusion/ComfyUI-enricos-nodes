import hashlib
import random
import os
from PIL import Image
import numpy as np
from typing_extensions import override
from comfy_api.latest import ComfyExtension, io
import folder_paths


class TestNodeA(io.ComfyNode):
    """
    Test Node A: Receives image, saves it to fixed location, returns filename and random seed.
    Seed only changes when input image changes.
    """
    
    
    
    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="TestNodeA",
            display_name="Test Node A (Config)",
            category="test",
            description="Test config node - saves image and returns seed that changes only when image input changes",
            inputs=[
                io.Image.Input("image", tooltip="Input image to monitor for changes"),
            ],
            outputs=[
                io.String.Output(display_name="seed", tooltip="Random seed that changes when image changes"),
                io.String.Output(display_name="filename", tooltip="Fixed filename where image is saved"),
            ],
            hidden=[
                io.Hidden.unique_id,
            ],
        )

    @classmethod
    def execute(cls, image) -> io.NodeOutput:
        node_id = cls.hidden.unique_id
        
        print(f"\n[TestNodeA] ========== EXECUTE ==========")
        print(f"[TestNodeA] node_id={node_id}")
        
        
        
        #Generate seed        
        seed = str(random.randint(1000, 9999))
        
        
        # Save image to fixed location for frontend access
        input_dir = folder_paths.get_input_directory()
        test_folder = os.path.join(input_dir, "test_node_b")
        os.makedirs(test_folder, exist_ok=True)
        
        # Save with fixed filename pattern based on node_id
        fixed_filename = f"test_node_b_input_{node_id}.png"
        input_path = os.path.join(test_folder, fixed_filename)
        
        # Convert tensor to PIL and save
        img_np = (image.cpu().numpy() * 255).astype(np.uint8)
        if img_np.ndim == 4:
            img_np = img_np[0]  # Remove batch dimension
        pil_image = Image.fromarray(img_np)
        pil_image.save(input_path)
        print(f"[TestNodeA] Saved input image to: {input_path}")
        
        print(f"[TestNodeA] Returning: seed={seed}, filename={fixed_filename}")
        print(f"[TestNodeA] =============================\n")
        
        return io.NodeOutput(seed, fixed_filename)


class TestNodeAExtension(ComfyExtension):
    @override
    async def get_node_list(self) -> list[type[io.ComfyNode]]:
        return [TestNodeA]


async def test_node_a_entrypoint() -> TestNodeAExtension:
    return TestNodeAExtension()
