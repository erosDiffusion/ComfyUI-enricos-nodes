from server import PromptServer
from comfy_execution.graph import ExecutionBlocker

class Compositor3Debug:
    """
    Debug node to inspect fabricData and imageName values
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "config": ("COMPOSITOR_CONFIG", {"forceInput": True}),
                "fabricData": ("STRING", {
                    "multiline": False,
                    "default": ""
                }),
                "imageName": ("STRING", {
                    "multiline": False,
                    "default": ""
                }),
            },
            "hidden": {
                "extra_pnginfo": "EXTRA_PNGINFO",
                "node_id": "UNIQUE_ID",
            },  
           
        }

    RETURN_TYPES = ("STRING", "STRING")
    RETURN_NAMES = ("fabricData_output", "imageName_output")
    FUNCTION = "run"
    CATEGORY = "image/debug"
    OUTPUT_NODE = True

    def run(self, **kwargs):
        node_id = kwargs.pop('node_id', None)

        config = kwargs.get('config', "default")
        fabricData = kwargs.get('fabricData', "default")
        imageName = kwargs.get('imageName', "default")
        padding = config["padding"]
        invertMask = config["invertMask"]
        width = config["width"]
        height = config["height"]
        config_node_id = config["node_id"]
        onConfigChanged = config["onConfigChanged"]
        names = config["names"]

        ui = {
            #"test": ("value",),
            "padding": [padding],
            "width": [width],
            "height": [height],
            "config_node_id": [config_node_id],
            "node_id": [node_id],
            "names": names,
            "fabricData": [fabricData],
            #"awaited": [self.result],
            #"configChanged": [configChanged],
            "onConfigChanged": [onConfigChanged],
        }

        detail = {"output": ui, "node": node_id}
        PromptServer.instance.send_sync("compositor_init", detail)

        
        """
        Dumps the input values to console and returns them
        """
        print("=" * 80)
        #print(f"Compositor3Debug - Config: {config}")
        print(f"Compositor3Debug - Padding: {padding}")
        print(f"Compositor3Debug - Invert Mask: {invertMask}")
        print(f"Compositor3Debug - Width: {width}")
        print(f"Compositor3Debug - Height: {height}")
        print(f"Compositor3Debug - Node ID: {config_node_id}")
        print(f"Compositor3Debug - On Config Changed: {onConfigChanged}")
        print(f"Compositor3Debug - Names: {names}")
        print("Compositor3Debug - Dump:")
        print("=" * 80)
        print(f"fabricData type: {type(fabricData)}")
        print(f"fabricData length: {len(fabricData) if fabricData else 0}")
        print(f"fabricData content:\n{fabricData}")
        print("-" * 80)
        print(f"imageName type: {type(imageName)}")
        print(f"imageName length: {len(imageName) if imageName else 0}")
        print(f"imageName content: {imageName}")
        print("=" * 80)
        print
        
        return (fabricData, imageName)
