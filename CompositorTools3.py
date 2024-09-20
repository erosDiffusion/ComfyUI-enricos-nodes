class CompositorTools3:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "hidden": {
                "node_id": "UNIQUE_ID",
            },
        }

    RETURN_TYPES = ("BOOLEAN",)
    RETURN_NAMES = ("tools",)
    FUNCTION = "run"
    CATEGORY = "image"

    DESCRIPTION = """
experimental node: frontend communication only with feature flag, needs page reload to fill controls
"""

    def run(self, **kwargs):
        use_alignment_controls = True
        ui = {
            "use_alignment_controls": [use_alignment_controls],
        }

        return {"ui": ui, "result": (use_alignment_controls,)}

