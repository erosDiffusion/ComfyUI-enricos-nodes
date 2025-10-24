// Test Node B Frontend Handler
// Handles test_node_b_init event and implements grab_and_continue behavior

import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

console.log("[TestNodeB] Extension loading...");

app.registerExtension({
  name: "Test.NodeB",

  async setup(app) {
    console.log("[TestNodeB] Setting up event listener");
    api.addEventListener("test_node_b_init", testNodeBInitHandler);
    api.addEventListener("executed", testNodeBExecutedHandler);
  },
});

function testNodeBInitHandler(event) {
  const nodeId = event.detail.node;
  const node = app.graph.getNodeById(nodeId);

  console.log("\n[TestNodeB] ========== INIT EVENT ==========");
  console.log("[TestNodeB] Event received for nodeId:", nodeId);
  console.log("[TestNodeB] Event detail:", event.detail);

  if (!node) {
    console.log("[TestNodeB] Node not found");
    console.log("[TestNodeB] ================================\n");
    return;
  }

  // Check if this is TestNodeB
  if (node.constructor.comfyClass !== "TestNodeB") {
    console.log("[TestNodeB] Not TestNodeB, ignoring");
    console.log("[TestNodeB] ================================\n");
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

  // If seed changed and grab_and_continue is enabled, auto-continue
  if (seedChanged && grabAndContinue) {
    console.log("[TestNodeB] Seed changed + grab_and_continue enabled");
    console.log("[TestNodeB] Starting auto-continue sequence...");

    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    // Generate random colored image in frontend
    const generateRandomColoredImage = () => {
      console.log("[TestNodeB] Generating random colored canvas...");
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext("2d");

      // Generate random color
      const r = Math.floor(Math.random() * 256);
      const g = Math.floor(Math.random() * 256);
      const b = Math.floor(Math.random() * 256);
      const color = `rgb(${r}, ${g}, ${b})`;

      console.log("[TestNodeB] Generated color:", color);

      // Fill canvas with random color
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 512, 512);

      // Add text showing the seed
      ctx.fillStyle = "white";
      ctx.font = "bold 48px Arial";
      ctx.textAlign = "center";
      ctx.fillText(`Seed: ${seed}`, 256, 256);

      return { canvas, color };
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
        // Generate image
        const { canvas, color } = generateRandomColoredImage();

        // Upload with fixed filename
        const uploadFilename = `test_node_b_${node.id}.png`;
        console.log("[TestNodeB] Uploading image with color:", color);

        return uploadCanvas(canvas, uploadFilename).then((uploadData) => ({
          uploadFilename,
          color,
        }));
      })
      .then(({ uploadFilename, color }) => {
        console.log("[TestNodeB] Upload complete:", uploadFilename);

        // Update snapshot_data widget with current seed (like fabricData with seed)
        // This is the cache invalidator - changes when seed changes
        const snapshotDataWidget = node.widgets?.find(
          (w) => w.name === "snapshot_data"
        );
        if (snapshotDataWidget) {
          const snapshotData = {
            seed: seed,
            timestamp: Date.now(),
          };
          snapshotDataWidget.value = JSON.stringify(snapshotData);
          console.log("[TestNodeB] snapshot_data updated:", snapshotDataWidget.value);
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
