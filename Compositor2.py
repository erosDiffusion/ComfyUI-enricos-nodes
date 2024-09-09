import folder_paths
from PIL import Image, ImageOps
import numpy as np
import torch
from comfy_execution.graph import ExecutionBlocker
import threading
from server import PromptServer
from aiohttp import web

thread = None
g_node_id = None
g_filename = None
threads = []

routes = PromptServer.instance.routes
@routes.post('/compositor/done')
async def receivedDone(request):
    return web.json_response({})
    # the_data = await request.post()
    # global g_node_id
    # g_node_id = the_data["node_id"]
#
#
#
#     if "filename" in the_data:
#         # no filename, stay with whatever we had
#         global g_filename
#         g_filename = the_data["filename"]
#         print(f"receivedDone filename: {g_filename}")
#
#     global thread
#
#     try:
#         if thread is not None and thread.is_alive():
#             print("thread is alive")
#         else:
#             print("waitForDone thread is now started")
#             thread.start()
#         return web.json_response({})
#     except:
#         global threads
#         old = threads.pop(0)
#         oldm = old["method"]
#         thread = threading.Thread(target=oldm)
#         old["thread"] = thread
#         threads.append(old)
#         thread.start()
#         return web.json_response({})



class Compositor2:
    # NOT_IDEMPOTENT = True
    file = "new.png"
    result = None
    # result_available = threading.Event()

    @classmethod
    def IS_CHANGED(cls, **kwargs):
        fabricData = kwargs.get("fabricData")
        print(fabricData)
        return fabricData

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "config": ("COMPOSITOR_CONFIG", {"forceInput": True}),
                "fabricData": ("STRING", {"default": "{}"}),
                "imageName": ("STRING", {"default": "new.png"}),
            },
            "hidden": {
                "extra_pnginfo": "EXTRA_PNGINFO",
                "node_id": "UNIQUE_ID",
            },
        }

    RETURN_TYPES = ("STRING", "IMAGE")
    RETURN_NAMES = ("transforms", "image")
    FUNCTION = "composite"
    CATEGORY = "image"

    # def waitForDone(self):
    #     print("receivedDone")
    #     self.result = g_filename
    #     self.result_available.set()

    def composite(self, **kwargs):
        # https://blog.miguelgrinberg.com/post/how-to-make-python-wait
        print("composite with hot reload")
        node_id = kwargs.pop('node_id', None)
        # global threads
        # global thread

        # thread = threading.Thread(target=self.waitForDone)
        # threads.append({"method": self.waitForDone, "node_id": node_id, "thread": thread})
        #
        # print("global thread created")
        # fabricData = kwargs.get('fabricData', None)
        imageName = kwargs.get('imageName', "new.png")

        print(f"imagename {imageName}")
        config = kwargs.get('config', "default")
        padding = config["padding"]
        width = config["width"]
        height = config["height"]
        config_node_id = config["node_id"]
        names = config["names"]
        fabricData = kwargs.get("fabricData")
        #storeTransforms = kwargs.get("storeTransforms")
        #use_alignment_controls = config["use_alignment_controls"]



        # hasResult = self.result is not None
        # print(f"hasResult?{ hasResult}")
        ui = {
            "test": ("value",),
            "padding": [padding],
            "width": [width],
            "height": [height],
            "config_node_id": [config_node_id],
            "node_id": [node_id],
            "names": names,
            "fabricData": [fabricData],
            #"storeTransforms": [storeTransforms],
            #"use_alignment_controls": [use_alignment_controls],
            "awaited": [self.result],
            # "hasResult": [hasResult],
        }

        # break and send a message to the gui as if it was "executed" below
        detail = {"output": ui, "node": node_id}
        PromptServer.instance.send_sync("compositor_init", detail)
        # print(f"result_available is set ? {self.result_available.is_set()}")
        # if not hasResult:
        #     self.result_available.wait()
        #
        # imageName = self.result
        # if hasResult and imageName is None:
        #     self.result_available.clear()
        #     self.result_available.wait()
        imageExists = folder_paths.exists_annotated_filepath(imageName)
        if imageName == "new.png" or not imageExists:
            return {
                "ui": ui,
                "result": (ExecutionBlocker(None), ExecutionBlocker(None))
            }
        print(f"imagename {imageName}")
        # if imageName == "new.png":
        #     imageName = names[0];
        image_path = folder_paths.get_annotated_filepath(imageName)
        i = Image.open(image_path)
        i = ImageOps.exif_transpose(i)
        if i.mode == 'I':
            i = i.point(lambda i: i * (1 / 255))
        image = i.convert("RGB")
        image = np.array(image).astype(np.float32) / 255.0
        image = torch.from_numpy(image)[None,]

        return {
            "ui": ui,
            "result": (fabricData, image)
        }


#await self.waitForMessage()

# notes: loop = asyncio.new_event_loop()
#
# await PromptServer.instance.send("rgthree-refreshed-lora-info", {"data": info_data})
#
# def waitForMessage(cls, id, period = 0.1, asList = False):
#
# self.monitorThread = threading.Thread(target=self.startMonitorLoop)
# selections = MessageHolder.waitForMessage(id, asList=True) if (is_blocking_mode and is_block_condition) else [0]
#
# async def await
#
# loop = asyncio.new_event_loop()
#async def msg_loop():
#     while True:
#         await queue_msg()
#         await diff_msg()
#         await asyncio.sleep(1)
#
# Thread(target=asyncio.run, args=(msg_loop(),), daemon=True).start()
#
# def get_current_preview_method(self):
# stdout_thread = threading.Thread(target=handle_stream, args=(process.stdout, ""))