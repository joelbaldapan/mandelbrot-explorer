# Mandelbrot Explorer

🌌🔍 Browse the Mandelbrot Set in your browser! Experience the Mandelbrot Set with interactive zoom, pan, color palettes, and mobile-friendly controls. | An OpenGL Experiment


## Features

- **Real-time Mandelbrot rendering** using WebGL shaders
- **Zoom and pan** with mouse or touch gestures
- **Multiple color schemes** (Cool Blue, Pastel, Inferno, Plasma, Matcha, Gold, Black and White, Rainbow)
- **Jump to interesting locations** (Seahorse Valley, Elephant Valley, Starfish, etc.)
- **Download screenshots** of your current view
- **Responsive UI** with a modern glassmorphism style

## Usage

1. **Open `index.html` in your browser.**
2. Use the controls in the settings panel (top right) to:
   - Adjust iterations (detail level)
   - Change color scheme
   - Set real/imaginary center and zoom
   - Jump to preset locations
   - Download a screenshot

## Controls

- **Zoom:** Mouse wheel or pinch gesture
- **Pan:** Click and drag or swipe
- **Settings:** Use the hamburger menu (top right) to show/hide controls

## Development

### Project Structure

```
app.js
index.html
mandl.fs.glsl
mandl.vs.glsl
style.css
README.md
bower_components/
```

- `app.js`: Main JavaScript logic and WebGL setup
- `mandl.vs.glsl`, `mandl.fs.glsl`: Vertex and fragment shaders for Mandelbrot rendering
- `style.css`: UI styles
- `index.html`: Main HTML file

### Dependencies

- [async](https://github.com/caolan/async) (included via `bower_components/async`)

### Running Locally

No build step required. Just open `index.html` in a browser that supports WebGL.

---

*Created by Joel Angelo Baldapan.*