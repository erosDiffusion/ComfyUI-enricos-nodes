# Compositor V4 Migration Summary

## Overview

Successfully created a complete set of Compositor V4 files that implement integrated mask handling with disk serialization. All V3Debug functionality has been preserved in separate V4 files to avoid breaking existing implementations.

## Created Files

### Frontend

- ✅ **web/compositor4.js** (4007 lines)
  - Cloned from compositor3Debug.js
  - Updated all references: Compositor3Debug → Compositor4
  - Changed event name: compositor_init → compositor4_init
  - Widget name: COMPOSITOR_3_DEBUG → COMPOSITOR_4
  - Ready for mask display integration (clipPath) in future

### Backend Python Nodes

#### 1. **Compositor4.py** (158 lines)

- Main compositor node with canvas interaction
- Node ID: `Compositor4`
- Display name: `Compositor V4`
- Key changes from V3Debug:
  - Added `maskNames` extraction from config (line 74)
  - Added `maskNames` to UI dict for frontend (line 96)
  - Uses `compositor4_init` event (line 104)
  - Class names: `Compositor4`, `Compositor4Extension`

#### 2. **CompositorConfig4.py** (425 lines)

- Configuration node with mask serialization
- Node ID: `CompositorConfig4`
- Display name: `Compositor Config V4`
- **New V4 Features:**
  - `saveMaskToCompositorFolder()` function (lines 103-142)
    - Saves masks as grayscale PNG
    - Naming pattern: `cfg{config_node_id}-mask{index}.png`
    - Supports temp/input/output folders
  - `maskNames` array added to config output (line 286)
  - Masks serialized before image processing (lines 258-260)
  - Maintains index alignment with None for missing masks
- **Preserved V3 Functionality:**
  - All image processing unchanged
  - normalizeHeight support
  - invertMask support
  - Multiple save format options
  - 8 image/mask input slots

#### 3. **Compositor4MasksOutput.py** (102 lines)

- Direct clone from V3 with class name change only
- Unpacks COMPOSITOR_OUTPUT_MASKS into 8 images + 8 masks
- Unchanged functionality

#### 4. **Compositor4TransformsOut.py** (67 lines)

- Direct clone from V3 with class name change only
- Extracts transform data from fabricData JSON
- Returns x, y, width, height, angle, bbox coordinates
- Unchanged functionality

### Registration

- ✅ ****init**.py** updated
  - Added imports for all V4 nodes
  - Added NODE_CLASS_MAPPINGS entries
  - Added NODE_DISPLAY_NAME_MAPPINGS with 💜 emojis

## Key Design Decisions

### Mask Serialization (Option A - Confirmed)

- Masks saved to disk with fixed naming: `cfg{config_node_id}-mask{index}.png`
- Format: Grayscale PNG (single channel, 0-255 range)
- Stored in same compositor subfolder as images
- Naming pattern matches image pattern for consistency
- Filenames included in config's `maskNames` array

### Config Structure

```javascript
{
  node_id: "123",
  width: 512,
  height: 512,
  padding: 100,
  names: ["cfg123-in0.png", "cfg123-in1.png", null, ...],  // image filenames
  maskNames: ["cfg123-mask0.png", null, "cfg123-mask2.png", ...],  // mask filenames
  onConfigChangedContinue: false,
  normalizeHeight: false,
  invertMask: false,
  saveFolder: "output",
  configSignature: "0.123456789"
}
```

### Frontend Integration

- Initial V4 release: No frontend mask editing (display only)
- Future enhancement: Add Fabric.js clipPath for mask visualization
- Frontend currently uses compositor4_init event and COMPOSITOR_4 widget

## Testing Checklist

### Phase 1: Import & Registration

- [ ] ComfyUI starts without errors
- [ ] All V4 nodes appear in node menu under "image" category
- [ ] Node display names show correctly with 💜 emoji

### Phase 2: Basic Functionality

- [ ] CompositorConfig4 accepts image inputs
- [ ] Images saved to compositor folder with cfg{id}-in{index} naming
- [ ] Compositor4 node receives config and displays canvas
- [ ] Canvas interaction works (pan, zoom, transform)

### Phase 3: Mask Functionality

- [ ] CompositorConfig4 accepts mask inputs
- [ ] Masks saved to compositor folder with cfg{id}-mask{index}.png naming
- [ ] Masks applied to images (RGBA output)
- [ ] maskNames array populated in config
- [ ] Compositor4MasksOutput unpacks masks correctly

### Phase 4: Advanced Features

- [ ] normalizeHeight scales images correctly
- [ ] invertMask inverts mask alpha channel
- [ ] Different save formats work (PNG/JPEG/WebP/BMP)
- [ ] Different save folders work (temp/input/output)
- [ ] Compositor4TransformsOut extracts transform data

### Phase 5: V3 Compatibility

- [ ] All V3Debug nodes still work unchanged
- [ ] V3 workflows load and execute correctly
- [ ] No interference between V3 and V4 instances

## Migration Path from V3Debug to V4

### Manual Migration Steps

1. Replace `Compositor3Debug` node with `Compositor4`
2. Replace `CompositorConfig3` with `CompositorConfig4`
3. Replace `CompositorMasksOutputV3` with `Compositor4MasksOutput` (if used)
4. Replace `CompositorTransformsOutV3` with `Compositor4TransformsOut` (if used)
5. No workflow changes needed - all connections compatible

### Advantages of V4

- Integrated mask handling (no separate mask inputs needed in compositor)
- Masks serialized to disk (persistent, reloadable)
- Cleaner config structure (single config object)
- Better separation from V3 (no breaking changes)
- Foundation for future mask editing in frontend

## Known Limitations

### Current V4 Limitations

- Frontend does not display masks yet (planned for future)
- No mask editing in canvas (planned for future with Fabric.js clipPath)
- Masks always saved as PNG (no format options like images)

### Planned Enhancements

- Add mask visualization in frontend with transparency overlay
- Implement Fabric.js clipPath for mask editing
- Support mask editing: draw, erase, transform
- Add mask format options (PNG/WebP)

## File Locations

```
ComfyUI-enricos-nodes/
├── web/
│   └── compositor4.js                  # Frontend canvas editor
├── Compositor4.py                      # Main compositor node
├── CompositorConfig4.py                # Config + mask serialization
├── Compositor4MasksOutput.py           # Mask unpacker
├── Compositor4TransformsOut.py         # Transform extractor
├── __init__.py                         # Node registration
└── V4_MIGRATION_SUMMARY.md            # This file
```

## Technical Notes

### Mask Storage Format

- Format: Grayscale PNG (mode='L')
- Bit depth: 8-bit (0-255)
- Compression: Default PNG compression
- Location: {save_folder}/compositor/cfg{node_id}-mask{index}.png

### Config Signature

- Random hash generated on each execution
- Forces Compositor4 node to re-execute
- Ensures fresh canvas data on config changes

### Image Processing Order

1. Image input received
2. normalizeHeight applied (if enabled)
3. Mask saved to disk (if present)
4. Mask applied to image (creates RGBA)
5. Image saved to disk
6. Filenames added to config

### Event Flow

1. CompositorConfig4 executes → saves images/masks → outputs config
2. Compositor4 receives config → sends compositor4_init event to frontend
3. Frontend (compositor4.js) receives event → loads images → displays canvas
4. User interacts with canvas → grab button clicked → fabricData sent back
5. Compositor4 processes fabricData → outputs final composite

## V3Debug Preservation

All V3Debug files remain unchanged:

- compositor3Debug.js
- Compositor3Debug.py
- CompositorConfig3.py
- CompositorMasksOutputV3.py
- CompositorTransformsOut3.py

V3Debug workflows will continue to work without modification.

## Next Steps

### Immediate Testing

1. Restart ComfyUI to load new nodes
2. Create test workflow with Compositor4 + CompositorConfig4
3. Test basic image input and canvas interaction
4. Test mask input and serialization

### Future Development

1. Add mask visualization to compositor4.js
2. Implement Fabric.js clipPath for mask display
3. Add mask editing capabilities (draw/erase)
4. Support mask format options
5. Add mask loading from disk

---

**Created:** 2024
**Author:** ComfyUI-enricos-nodes
**Version:** V4.0.0
