/**
 * Minimal Example: Topbar Menu Registration for Compositor4
 *
 * This demonstrates how to add a menu item to ComfyUI's topbar.
 * Reference: https://docs.comfy.org/custom-nodes/js/javascript_topbar_menu
 */

import { app } from "../../scripts/app.js";

app.registerExtension({
  name: "Comfy.Compositor4.TopbarExample",

  // Define commands that can be triggered from menus or keybindings
  commands: [
    {
      id: "compositor4.hello.topbar",
      label: "Hello Compositor4 (Topbar)",
      function: () => {
        alert("Hello from Compositor4 Topbar Menu!");
      },
    },
    {
      id: "compositor4.openSidebar",
      label: "Open Compositor Panel",
      function: () => {
        // Future: This will open the compositor sidebar panel
        console.log("Opening Compositor4 sidebar panel...");
        alert("This will open the Compositor4 sidebar (not yet implemented)");
      },
    },
  ],

  // Add commands to menu structure
  menuCommands: [
    {
      // Create nested menu: Extensions > Compositor4
      path: ["Extensions", "Compositor4"],
      commands: ["compositor4.hello.topbar", "compositor4.openSidebar"],
    },
    {
      // Also add quick access to View menu
      path: ["View"],
      commands: ["compositor4.openSidebar"],
    },
  ],
});
