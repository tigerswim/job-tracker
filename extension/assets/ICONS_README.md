# Extension Icons

This directory should contain the extension icons in the following sizes:

- **icon16.png**: 16x16 pixels (toolbar icon)
- **icon48.png**: 48x48 pixels (extension management page)
- **icon128.png**: 128x128 pixels (Chrome Web Store)

## Design Guidelines

The icons should:
- Use the Job Tracker brand colors (blue gradient: #2563eb to #1d4ed8)
- Feature a simple, recognizable symbol (briefcase, person with plus, etc.)
- Be clear and visible at all sizes
- Have a transparent background
- Follow Chrome Web Store icon guidelines

## Creating Icons

You can create icons using:
1. **Figma/Sketch**: Design at 128x128, export at all sizes
2. **Online Tools**:
   - https://www.favicon-generator.org/
   - https://realfavicongenerator.net/
3. **Design Tools**: Adobe Illustrator, Inkscape, etc.

## Placeholder Icons

Until custom icons are created, you can:
1. Use the Job Tracker logo
2. Generate simple icons online
3. Create SVG-based icons using canvas/SVG to PNG converters

## Current Status

⚠️ **TODO**: Icons need to be created and added to this directory before the extension can be loaded.

For now, you can use placeholder icons by:
1. Creating simple colored squares at the required sizes
2. Using an online icon generator
3. Extracting icons from the Job Tracker website favicon

## Quick Fix for Development

To quickly create placeholder icons for testing:

```bash
# Install ImageMagick if not already installed
# brew install imagemagick (Mac)
# sudo apt-get install imagemagick (Linux)

# Create simple blue squares as placeholders
convert -size 16x16 xc:'#2563eb' icon16.png
convert -size 48x48 xc:'#2563eb' icon48.png
convert -size 128x128 xc:'#2563eb' icon128.png
```

Or use this online tool: https://www.favicon-generator.org/
Upload any image and it will generate all required sizes.
