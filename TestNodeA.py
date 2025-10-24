import hashlib
import random
from typing_extensions import override
from comfy_api.latest import ComfyExtension, io


class TestNodeA(io.ComfyNode):
    """
    Test Node A: Receives image, returns filename and random seed.
    Seed only changes when input image changes.
    """
    
    # Cache: node_id -> image_hash
    imageCache = {}
    # Cache: node_id -> current_seed
    seedCache = {}
    
    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="TestNodeA",
            display_name="Test Node A (Config)",
            category="test",
            description="Test config node - returns seed that changes only when image input changes",
            inputs=[
                io.Image.Input("image", tooltip="Input image to monitor for changes"),
            ],
            outputs=[
                io.Int.Output(display_name="seed", tooltip="Random seed that changes when image changes"),
                io.String.Output(display_name="filename", tooltip="Generated filename based on node ID"),
            ],
            hidden=[
                io.Hidden.unique_id,
            ],
        )

    @classmethod
    def execute(cls, image) -> io.NodeOutput:
        node_id = cls.hidden.unique_id if cls.hidden else None
        
        print(f"\n[TestNodeA] ========== EXECUTE ==========")
        print(f"[TestNodeA] node_id={node_id}")
        
        # Generate hash of input image to detect changes
        image_bytes = image.cpu().numpy().tobytes()
        image_hash = hashlib.md5(image_bytes).hexdigest()
        
        # Check if image changed
        cached_hash = cls.imageCache.get(node_id)
        image_changed = cached_hash != image_hash
        
        print(f"[TestNodeA] image_hash={image_hash[:8]}...")
        print(f"[TestNodeA] cached_hash={cached_hash[:8] if cached_hash else 'None'}...")
        print(f"[TestNodeA] image_changed={image_changed}")
        
        # Update cache
        cls.imageCache[node_id] = image_hash
        
        # Generate or reuse seed
        if image_changed or node_id not in cls.seedCache:
            seed = random.randint(1000, 9999)
            cls.seedCache[node_id] = seed
            print(f"[TestNodeA] NEW seed generated: {seed}")
        else:
            seed = cls.seedCache[node_id]
            print(f"[TestNodeA] REUSING existing seed: {seed}")
        
        # Generate filename
        filename = f"test_{node_id}_{seed}.png"
        
        print(f"[TestNodeA] Returning: seed={seed}, filename={filename}")
        print(f"[TestNodeA] =============================\n")
        
        return io.NodeOutput(seed, filename)


class TestNodeAExtension(ComfyExtension):
    @override
    async def get_node_list(self) -> list[type[io.ComfyNode]]:
        return [TestNodeA]


async def test_node_a_entrypoint() -> TestNodeAExtension:
    return TestNodeAExtension()
