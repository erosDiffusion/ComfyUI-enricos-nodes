/**
 * Minimal Example: Bottom Panel Tab Registration for Compositor4
 *
 * This demonstrates how to add a tab to ComfyUI's bottom panel.
 * Reference: https://docs.comfy.org/custom-nodes/js/javascript_bottom_panel_tabs
 */

import { app } from "../../scripts/app.js";

app.registerExtension({
  name: "Comfy.Compositor4.BottomPanelExample",

  bottomPanelTabs: [
    {
      id: "compositor4HelloBottom",
      title: "Compositor4 Info",
      type: "custom",
      icon: "pi pi-info-circle", // PrimeVue icon
      render: (el) => {
        // Create a simple info panel
        const container = document.createElement("div");
        container.style.padding = "20px";
        container.style.color = "white";
        container.innerHTML = `
          <div style="font-family: sans-serif;">
            <h2 style="color: #c8a2ff; margin-bottom: 15px;">
              🎨 Hello Compositor4!
            </h2>
            <p style="margin-bottom: 10px;">
              This is a <strong>bottom panel tab</strong> example.
            </p>
            <p style="margin-bottom: 10px;">
              Bottom panels are useful for:
            </p>
            <ul style="margin-left: 20px; margin-bottom: 15px;">
              <li>Logs and debugging information</li>
              <li>Status displays</li>
              <li>Secondary tools that don't need constant visibility</li>
              <li>History or timeline views</li>
            </ul>
            <button 
              id="compositor4BottomBtn"
              style="
                padding: 8px 16px;
                background-color: #c8a2ff;
                color: black;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-weight: bold;
              "
            >
              Click Me!
            </button>
            <div id="compositor4BottomOutput" style="margin-top: 15px; color: #98fb98;"></div>
          </div>
        `;

        // Add event listener for interactive element
        container
          .querySelector("#compositor4BottomBtn")
          .addEventListener("click", () => {
            const output = container.querySelector("#compositor4BottomOutput");
            const timestamp = new Date().toLocaleTimeString();
            output.textContent = `✓ Button clicked at ${timestamp}`;
          });

        el.appendChild(container);
      },
    },
  ],
});

// Alternative: Standalone registration (can be called from anywhere)
// app.extensionManager.registerBottomPanelTab({
//   id: "compositor4StandaloneBottom",
//   title: "Compositor Stats",
//   type: "custom",
//   render: (el) => {
//     el.innerHTML = '<div style="padding: 10px; color: white;">Standalone bottom panel</div>';
//   }
// });
