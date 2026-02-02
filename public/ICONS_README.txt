The manifest.json references PNG files but these are SVG placeholders.

To use the extension:
1. Convert the SVG files to PNG at the required sizes (16x16, 48x48, 128x128)
2. Or update manifest.json to use the SVG files directly (Chrome supports SVG icons)

To convert SVG to PNG, you can use:
- Online tools like cloudconvert.com
- ImageMagick: convert icon-16.svg icon-16.png
- Or update the manifest to use .svg extensions
