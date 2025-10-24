import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

console.log("[TestNodeB] Extension loading...");

app.registerExtension({
  name: "Test.NodeB",

  async setup(app) {
    api.addEventListener("test_node_b_init", testNodeBInitHandler);
    api.addEventListener("executed", testNodeBExecutedHandler);
  },
});

function testNodeBInitHandler(event) {
  const nodeId = event.detail.node;
  const node = app.graph.getNodeById(nodeId);

  if (!node) {
    return;
  }

  if (node.constructor.comfyClass !== "TestNodeB") {
    return;
  }

  const e = event.detail.output;
  const seed = e.seed?.[0];
  const filename = e.filename?.[0];
  const seedChanged = Boolean(e.seed_changed?.[0]);
  const grabAndContinue = Boolean(e.grab_and_continue?.[0]);

  console.log("[TestNodeB] Parsed values:", {
    seed,
    filename,
    seedChanged,
    grabAndContinue,
  });

  if (seedChanged && grabAndContinue) {
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    // Load and flip the input image from Node A
    const loadAndFlipImage = (inputFilename) => {
      return new Promise((resolve, reject) => {
        console.log("[TestNodeB] Loading input image:", inputFilename);

        // Construct URL to load the image from test_node_b subfolder
        const imageUrl = `/view?filename=${encodeURIComponent(
          inputFilename
        )}&type=input&subfolder=test_node_b&rand=${Math.random()}`;

        const img = new Image();
        img.crossOrigin = "anonymous";

        img.onload = () => {
          console.log("[TestNodeB] Image loaded, creating flipped canvas...");

          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");

          // Flip the image horizontally
          ctx.save();
          ctx.scale(-1, 1);
          ctx.drawImage(img, -canvas.width, 0);
          ctx.restore();

          // Add text showing the seed
          ctx.fillStyle = "red";
          ctx.strokeStyle = "white";
          ctx.lineWidth = 3;
          ctx.font = "bold 48px Arial";
          ctx.textAlign = "center";

          // Stroke (outline) and fill the text
          ctx.strokeText(`Seed: ${seed}`, canvas.width / 2, 60);
          ctx.fillText(`Seed: ${seed}`, canvas.width / 2, 60);

          resolve(canvas);
        };

        img.onerror = () => {
          console.error("[TestNodeB] Failed to load image:", imageUrl);
          reject(new Error("Failed to load input image"));
        };

        img.src = imageUrl;
      });
    };

    // Upload canvas as blob
    const uploadCanvas = (canvas, uploadFilename) => {
      return new Promise((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            const formData = new FormData();
            formData.append("image", blob, uploadFilename);
            formData.append("subfolder", "test_node_b");
            formData.append("type", "input");
            formData.append("overwrite", "true");

            console.log("[TestNodeB] Uploading:", uploadFilename);

            fetch("/upload/image", {
              method: "POST",
              body: formData,
            })
              .then((response) => response.json())
              .then((data) => {
                console.log("[TestNodeB] Upload response:", data);

                // set the uploaded_image widget value
                const uploadedImageWidget = node.widgets?.find(
                  (w) => w.name === "uploaded_image"
                );

                if (uploadedImageWidget) {
                  uploadedImageWidget.value = uploadFilename;
                }

                resolve(data);
              })
              .catch(reject);
          },
          "image/png",
          0.95
        );
      });
    };

    // Execute the sequence
    wait(100)
      .then(() => {
        return loadAndFlipImage(filename, seed);
      })
      .then((canvas) => {
        // Upload with fixed filename
        debugger;
        const uploadFilename = "test_node_b_snapshot.png";
        console.log("[TestNodeB] Uploading flipped image");

        return uploadCanvas(canvas, uploadFilename).then((uploadData) => ({
          uploadFilename,
        }));
      })
      .then(({ uploadFilename }) => {
        console.log("[TestNodeB] Upload complete:", uploadFilename);

        // Update snapshot_data widget with current seed (like fabricData with seed)
        // This is the cache invalidator - changes when seed changes
        const snapshotDataWidget = node.widgets?.find(
          (w) => w.name === "snapshot_data"
        );
        if (snapshotDataWidget) {
          const snapshotData = {
            seed: seed,
            // timestamp: Date.now(),
          };
          snapshotDataWidget.value = JSON.stringify(snapshotData);

          const uploadedImageWidget = node.widgets?.find(
            (w) => w.name === "uploaded_image"
          );
          //   console.log(
          //     "[TestNodeB] snapshot_data updated:",
          //     snapshotDataWidget.value
          //   );
        }

        return wait(100);
      })
      .then(() => {
        console.log("[TestNodeB] Re-queueing workflow...");
        return app.queuePrompt(0, 1);
      })
      .then(() => {
        console.log("[TestNodeB] Workflow re-queued successfully");
        console.log(
          "[TestNodeB] Next execution should show SUCCESS with different color!"
        );
      })
      .catch((error) => {
        console.error("[TestNodeB] Auto-continue sequence failed:", error);
      });
  } else {
    console.log(
      "[TestNodeB] No auto-continue (seedChanged=" +
        seedChanged +
        ", grabAndContinue=" +
        grabAndContinue +
        ")"
    );
  }

  console.log("[TestNodeB] ================================\n");
}

function testNodeBExecutedHandler(event) {
  const nodeId = event.detail.node;
  const node = app.graph.getNodeById(nodeId);

  if (!node || node.constructor.comfyClass !== "TestNodeB") {
    return;
  }

  console.log("\n[TestNodeB] ========== EXECUTED EVENT ==========");
  console.log("[TestNodeB] Node executed for nodeId:", nodeId);
  console.log("[TestNodeB] Event detail:", event.detail);
  console.log("[TestNodeB] ===================================\n");
}
