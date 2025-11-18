/**
 * Minimal Example: Sidebar Tab Registration for Compositor4
 *
 * This demonstrates how to add a tab to ComfyUI's sidebar.
 * Reference: https://docs.comfy.org/custom-nodes/js/javascript_sidebar_tabs
 *
 * Sidebars are ideal for:
 * - Persistent panels that need to be always accessible
 * - Complex interactive UIs (like the future Compositor4 interface)
 * - Tools that work alongside the main canvas
 */

import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

app.registerExtension({
  name: "Comfy.Compositor4.SidebarExample",

  async setup(app) {
    // Register sidebar tab using the extension manager
    app.extensionManager.registerSidebarTab({
      id: "compositor4HelloSidebar",
      icon: "pi pi-palette", // PrimeVue palette icon
      title: "Compositor4",
      tooltip: "Compositor4 Control Panel (Example)",
      type: "custom",
      render: (el) => {
        // Create the sidebar content
        const container = document.createElement("div");
        container.style.padding = "15px";
        container.style.height = "100%";
        container.style.overflow = "auto";
        container.style.fontFamily = "sans-serif";
        container.style.color = "white";

        container.innerHTML = `
          <div>
            <h2 style="color: #c8a2ff; margin-bottom: 15px; display: flex; align-items: center; gap: 8px;">
              <span>🎨</span>
              <span>Hello Compositor4!</span>
            </h2>
            
            <p style="margin-bottom: 15px; font-size: 14px;">
              This is a <strong>sidebar tab</strong> example showing where the 
              future Compositor4 interface will live.
            </p>
            
            <div style="
              background-color: rgba(200, 162, 255, 0.1);
              border: 1px solid #c8a2ff;
              border-radius: 6px;
              padding: 12px;
              margin-bottom: 15px;
            ">
              <h3 style="margin: 0 0 8px 0; font-size: 13px; color: #c8a2ff;">
                💡 Future Features:
              </h3>
              <ul style="margin: 0; padding-left: 20px; font-size: 12px; line-height: 1.6;">
                <li>React-based UI for better performance</li>
                <li>Layer management & preview</li>
                <li>Transform controls</li>
                <li>Drawing tools</li>
                <li>Real-time sync with selected nodes</li>
                <li>Popout/fullscreen mode</li>
              </ul>
            </div>
            
            <div style="margin-bottom: 15px;">
              <label style="display: block; margin-bottom: 8px; font-size: 13px; font-weight: bold;">
                Selected Node:
              </label>
              <div id="compositor4SelectedNode" style="
                padding: 8px 12px;
                background-color: rgba(255, 255, 255, 0.05);
                border-radius: 4px;
                font-size: 12px;
                font-family: monospace;
              ">
                None
              </div>
            </div>
            
            <button 
              id="compositor4SidebarBtn"
              style="
                width: 100%;
                padding: 10px;
                background-color: #c8a2ff;
                color: black;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-weight: bold;
                font-size: 13px;
                margin-bottom: 10px;
              "
            >
              Simulate Interaction
            </button>
            
            <div id="compositor4SidebarLog" style="
              margin-top: 15px;
              padding: 10px;
              background-color: rgba(0, 0, 0, 0.3);
              border-radius: 4px;
              font-size: 11px;
              font-family: monospace;
              max-height: 200px;
              overflow-y: auto;
              line-height: 1.4;
            "></div>
          </div>
        `;

        el.appendChild(container);

        // Interactive elements
        const btn = container.querySelector("#compositor4SidebarBtn");
        const log = container.querySelector("#compositor4SidebarLog");
        const selectedNodeDisplay = container.querySelector(
          "#compositor4SelectedNode"
        );

        let logCounter = 0;

        const addLogMessage = (message, color = "#98fb98") => {
          logCounter++;
          const timestamp = new Date().toLocaleTimeString();
          const logEntry = document.createElement("div");
          logEntry.style.color = color;
          logEntry.style.marginBottom = "4px";
          logEntry.innerHTML = `<span style="color: #888;">[${timestamp}]</span> ${message}`;
          log.appendChild(logEntry);
          log.scrollTop = log.scrollHeight;
        };

        btn.addEventListener("click", () => {
          addLogMessage(`✓ Action #${logCounter + 1} executed successfully`);
        });

        // Listen for node selection changes
        const updateSelectedNode = () => {
          const selectedNodes = app.canvas.selected_nodes;
          if (selectedNodes && Object.keys(selectedNodes).length > 0) {
            const nodeId = Object.keys(selectedNodes)[0];
            const node = app.graph.getNodeById(parseInt(nodeId));
            if (node) {
              const isCompositor = node.type === "Compositor4";
              selectedNodeDisplay.innerHTML = `
                <div style="color: ${isCompositor ? "#98fb98" : "white"};">
                  ${isCompositor ? "✓ " : ""}${node.type || "Unknown"} 
                  <span style="color: #888;">#${node.id}</span>
                </div>
              `;
              if (isCompositor) {
                addLogMessage(
                  `Compositor4 node selected (ID: ${node.id})`,
                  "#c8a2ff"
                );
              }
            }
          } else {
            selectedNodeDisplay.textContent = "None";
          }
        };

        // Update on selection change (polling approach for demo)
        setInterval(updateSelectedNode, 500);

        // Listen for compositor events (example)
        api.addEventListener("compositor4_init", (event) => {
          const nodeId = event.detail?.node;
          addLogMessage(
            `📡 Compositor4 initialized (Node: ${nodeId})`,
            "#ffeb3b"
          );
        });

        addLogMessage("Sidebar initialized", "#c8a2ff");

        // Cleanup function (optional)
        return () => {
          // Cleanup listeners when tab is closed/destroyed
          console.log("Compositor4 sidebar tab cleanup");
        };
      },
    });
  },
});
