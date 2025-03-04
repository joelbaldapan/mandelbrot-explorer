"use strict";

function loadShaderAsync(shaderURL, callback) {
  var req = new XMLHttpRequest();
  req.open("GET", shaderURL, true);
  req.onload = function () {
    if (req.status < 200 || req.status >= 300) {
      callback("Could not load " + shaderURL);
    } else {
      callback(null, req.responseText);
    }
  };
  req.send();
}

function AddEvent(object, type, callback) {
  if (object == null || typeof object == "undefined") return;
  if (object.addEventListener) {
    object.addEventListener(type, callback, false);
  } else if (object.attachEvent) {
    object.attachEvent("on" + type, callback);
  } else {
    object["on" + type] = callback;
  }
}

function RemoveEvent(object, type, callback) {
  if (object == null || typeof object == "undefined") return;
  if (object.removeEventListener) {
    object.removeEventListener(type, callback, false);
  } else if (object.detachEvent) {
    object.detachEvent("on" + type, callback);
  } else {
    object["on" + type] = callback;
  }
}

function Init() {
  async.map(
    {
      vsText: "./mandl.vs.glsl",
      fsText: "./mandl.fs.glsl",
    },
    loadShaderAsync,
    RunDemo
  );
}

function RunDemo(loadErrors, loadedShaders) {
  // Attach callbacks
  AddEvent(window, "resize", OnResizeWindow);
  AddEvent(window, "wheel", OnZoom);
  AddEvent(window, "mousemove", OnMouseMove);

  const canvas = document.getElementById("gl-surface");
  const gl = canvas.getContext("webgl");
  if (!gl) {
    console.log("Webgl context not available - falling back on experimental");
    gl = canvas.getContext("experimental-webgl");
  }
  if (!gl) {
    alert("Cannot get WebGL context - browser does not support WebGL");
    return;
  }

  // Create shader program
  const vs = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vs, loadedShaders.vsText);
  gl.compileShader(vs);
  if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
    console.error("Vertex shader compile error:", gl.getShaderInfoLog(vs));
  }

  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fs, loadedShaders.fsText);
  gl.compileShader(fs);
  if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
    console.error("Fragment shader compile error:", gl.getShaderInfoLog(fs));
  }

  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("Shader program link error:", gl.getShaderInfoLog(program));
  }

  gl.validateProgram(program);
  if (!gl.getProgramParameter(program, gl.VALIDATE_STATUS)) {
    console.error(
      "Shader program validate error:",
      gl.getShaderInfoLog(program)
    );
  }

  gl.useProgram(program);

  // Get uniform locations
  const uniforms = {
    viewportDimensions: gl.getUniformLocation(program, "viewportDimensions"),
    minI: gl.getUniformLocation(program, "minI"),
    maxI: gl.getUniformLocation(program, "maxI"),
    minR: gl.getUniformLocation(program, "minR"),
    maxR: gl.getUniformLocation(program, "maxR"),
    colorMode: gl.getUniformLocation(program, "colorMode"),
    maxIterations: gl.getUniformLocation(program, "maxIterations"),
  };

  // Set CPU-side variables for all of our shader variables
  let vpDimensions = [canvas.clientWidth, canvas.clientHeight];
  let minI = -1.5;
  let maxI = 1.5;
  let minR = -2.4;
  let maxR = 1.5;
  let currentColorMode = 0; // ADJUSTABLE
  let maxIterations = 3000; // ADJUSTABLE

  // Create buffers
  const vertexBuffer = gl.createBuffer();
  const vertices = [-1, 1, -1, -1, 1, -1, -1, 1, 1, 1, 1, -1];
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

  const vPosAttrib = gl.getAttribLocation(program, "vPos");
  gl.vertexAttribPointer(
    vPosAttrib,
    2,
    gl.FLOAT,
    gl.FALSE,
    2 * Float32Array.BYTES_PER_ELEMENT,
    0
  );
  gl.enableVertexAttribArray(vPosAttrib);

  // Get input elements
  const realInput = document.getElementById("real");
  const imaginaryInput = document.getElementById("imaginary");
  const zoomInput = document.getElementById("zoom");
  let isEditingReal = false;
  let isEditingImaginary = false;
  let isEditingZoom = false;

  function maintainAspectRatio() {
    const aspectRatio = canvas.width / canvas.height;
    const currentWidth = maxR - minR;
    const currentHeight = maxI - minI;
    const currentAspectRatio = currentWidth / currentHeight;

    if (currentAspectRatio > aspectRatio) {
      // Current view is too wide, adjust height
      const targetHeight = currentWidth / aspectRatio;
      const deltaHeight = targetHeight - currentHeight;
      minI -= deltaHeight / 2;
      maxI += deltaHeight / 2;
    } else {
      // Current view is too tall, adjust width
      const targetWidth = currentHeight * aspectRatio;
      const deltaWidth = targetWidth - currentWidth;
      minR -= deltaWidth / 2;
      maxR += deltaWidth / 2;
    }
  }

  // Function to update input fields
  function updateInputFields() {
    if (!isEditingReal) {
      const centerR = (minR + maxR) / 2;
      realInput.value = centerR.toFixed(10);
    }
    if (!isEditingImaginary) {
      const centerI = (minI + maxI) / 2;
      imaginaryInput.value = centerI.toFixed(10);
    }
    if (!isEditingZoom) {
      const currentZoom = getCurrentZoom();
      zoomInput.value = currentZoom.toFixed(2);
    }
  }

  let zoomLevel = 1;

  // Event listeners to the input fields to set and clear the editing flags
  realInput.addEventListener("focus", () => (isEditingReal = true));
  realInput.addEventListener("blur", () => (isEditingReal = false));

  imaginaryInput.addEventListener("focus", () => (isEditingImaginary = true));
  imaginaryInput.addEventListener("blur", () => (isEditingImaginary = false));

  zoomInput.addEventListener("focus", () => (isEditingZoom = true));
  zoomInput.addEventListener("blur", () => (isEditingZoom = false));

  // Function to update coordinates based on input
  function updateCoordinates() {
    const real = parseFloat(realInput.value);
    const imaginary = parseFloat(imaginaryInput.value);
    const zoom = parseFloat(zoomInput.value);

    if (isNaN(real) || isNaN(imaginary) || isNaN(zoom)) {
      alert("Please enter valid numbers for all fields.");
      return;
    }

    zoomLevel = zoom;

    // Calculate the view dimensions based on the zoom level
    const baseHeight = 3; // This determines the initial view height
    const height = baseHeight / zoomLevel;
    const aspectRatio = canvas.width / canvas.height;
    const width = height * aspectRatio;

    // Calculate the bounds
    minR = real - width / 2;
    maxR = real + width / 2;
    minI = imaginary - height / 2;
    maxI = imaginary + height / 2;

    // Update uniforms
    gl.uniform1f(uniforms.minI, minI);
    gl.uniform1f(uniforms.maxI, maxI);
    gl.uniform1f(uniforms.minR, minR);
    gl.uniform1f(uniforms.maxR, maxR);

    // Update input fields
    updateInputFields();
  }

  realInput.addEventListener("change", updateCoordinates);
  imaginaryInput.addEventListener("change", updateCoordinates);
  zoomInput.addEventListener("change", updateCoordinates);

  const loop = function () {
    // Draw
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT);

    gl.uniform2fv(uniforms.viewportDimensions, vpDimensions);
    gl.uniform1f(uniforms.minI, minI);
    gl.uniform1f(uniforms.maxI, maxI);
    gl.uniform1f(uniforms.minR, minR);
    gl.uniform1f(uniforms.maxR, maxR);
    gl.uniform1i(uniforms.colorMode, currentColorMode);
    gl.uniform1f(uniforms.maxIterations, maxIterations);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    pngDataUrl = canvas.toDataURL();

    // Update input fields with current values
    updateInputFields();

    applyMomentum();

    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  OnResizeWindow();

  // Download image
  let pngDataUrl;
  const downloadBtn = document.getElementById("download-btn");
  const downloadLink = document.getElementById("canvas-download-link");
  downloadBtn.addEventListener("click", () => {
    downloadLink.href = pngDataUrl;
    downloadLink.download = "mandelbrot.png"; // The filename for the download
    downloadLink.click();
  });

  // Add cursor updaters
  const settingsContainer = document.getElementById("settings-container");
  let isOverSettings = false;
  AddEvent(canvas, "mousedown", () => updateCursor(true));
  AddEvent(canvas, "mouseup", () => updateCursor(false));
  AddEvent(canvas, "mouseleave", () => updateCursor(false));

  function updateCursor(isGrabbing) {
    if (isGrabbing) {
      canvas.style.cursor = "grabbing";
    } else {
      canvas.style.cursor = "grab";
    }
  }

  // Add event listeners for settings container
  AddEvent(settingsContainer, "mouseenter", () => {
    isOverSettings = true;
    canvas.style.cursor = "default";
  });
  AddEvent(settingsContainer, "mouseleave", () => {
    isOverSettings = false;
    updateCursor(false);
  });

  // Add mouse listeners
  AddEvent(window, "resize", OnResizeWindow);
  AddEvent(canvas, "wheel", OnZoom);
  AddEvent(canvas, "mousemove", OnMouseMove);

  // Momentum variables
  let velocityX = 0;
  let velocityY = 0;
  let velocityZoom = 0;
  const friction = 0.9;

  const zoomMomentumFactor = 0.6;
  const moveMomentumFactor = 0.1;

  function getCurrentZoom() {
    return zoomLevel;
  }

  function OnZoom(e) {
    if (!isOverSettings) {
      const zoomFactor = e.deltaY < 0 ? 1.05 : 0.95;
      zoomLevel *= zoomFactor;
      velocityZoom = (zoomFactor - 1) * zoomMomentumFactor;

      // Update coordinates based on new zoom level
      const centerI = (maxI + minI) / 2;
      const centerR = (maxR + minR) / 2;
      updateCoordinates();

      // Update input fields
      updateInputFields();
    }
  }

  function OnMouseMove(e) {
    if (!isOverSettings && e.buttons === 1) {
      const iRange = maxI - minI;
      const rRange = maxR - minR;
      const currentZoom = getCurrentZoom();

      velocityX =
        (e.movementX / canvas.clientWidth) *
        rRange *
        moveMomentumFactor *
        currentZoom;
      velocityY =
        (e.movementY / canvas.clientHeight) *
        iRange *
        moveMomentumFactor *
        currentZoom;

      // Update coordinates immediately for smoother input field updates
      minR -= velocityX * rRange;
      maxR -= velocityX * rRange;
      minI += velocityY * iRange;
      maxI += velocityY * iRange;

      // Update input fields
      updateInputFields();
    }
  }

  // Add touch event listeners
  AddEvent(canvas, "touchstart", OnTouchStart);
  AddEvent(canvas, "touchmove", OnTouchMove);
  AddEvent(canvas, "touchend", OnTouchEnd);

  // Touch control variables
  let touchStartX = 0;
  let touchStartY = 0;
  let previousTouchDistance = 0;
  const mobileZoomMomentumFactor = 3.5;
  const mobileMoveMomentumFactor = 0.2;
  let isPanning = false;
  let isZooming = false;

  function OnTouchStart(e) {
    e.preventDefault();
    if (e.touches.length === 1) {
      isPanning = true;
      isZooming = false;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      isPanning = false;
      isZooming = true;
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      previousTouchDistance = Math.hypot(
        touch1.clientX - touch2.clientX,
        touch1.clientY - touch2.clientY
      );
    }
  }

  function OnTouchMove(e) {
    e.preventDefault();

    if (isPanning && e.touches.length === 1) {
      // Handle panning (swiping)
      const touchX = e.touches[0].clientX;
      const touchY = e.touches[0].clientY;

      const movementX = touchX - touchStartX;
      const movementY = touchY - touchStartY;

      const iRange = maxI - minI;
      const rRange = maxR - minR;
      const currentZoom = getCurrentZoom();

      velocityX =
        (movementX / canvas.clientWidth) *
        rRange *
        mobileMoveMomentumFactor *
        currentZoom;
      velocityY =
        (movementY / canvas.clientHeight) *
        iRange *
        mobileMoveMomentumFactor *
        currentZoom;

      touchStartX = touchX;
      touchStartY = touchY;

      // Update coordinates immediately for smoother input field updates
      minR -= velocityX * rRange;
      maxR -= velocityX * rRange;
      minI += velocityY * iRange;
      maxI += velocityY * iRange;

      // Update input fields
      updateInputFields();
    } else if (isZooming && e.touches.length === 2) {
      // Handle zooming (pinching)
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const currentTouchDistance = Math.hypot(
        touch1.clientX - touch2.clientX,
        touch1.clientY - touch2.clientY
      );

      const pinchDelta = currentTouchDistance - previousTouchDistance;
      const zoomFactor = pinchDelta > 0 ? 1.01 : 0.99; // Changed this line
      velocityZoom = (zoomFactor - 1) * mobileZoomMomentumFactor;

      previousTouchDistance = currentTouchDistance;

      // Apply zoom immediately for smoother input field updates
      zoomLevel *= zoomFactor;
      updateCoordinates();
      updateInputFields();
    }
  }

  function OnTouchEnd(e) {
    e.preventDefault();
    if (e.touches.length === 0) {
      // Reset touch variables if no touches are active
      previousTouchDistance = 0;
      isPanning = false;
      isZooming = false;
    } else if (e.touches.length === 1) {
      // If there is still one touch, it means we should transition to panning
      isPanning = true;
      isZooming = false;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }
  }

  function applyMomentum() {
    if (
      Math.abs(velocityX) > 0.00001 ||
      Math.abs(velocityY) > 0.00001 ||
      Math.abs(velocityZoom) > 0.00001
    ) {
      const centerI = (maxI + minI) / 2;
      const centerR = (maxR + minR) / 2;

      if (Math.abs(velocityX) > 0.00001 || Math.abs(velocityY) > 0.00001) {
        const iRange = maxI - minI;
        const rRange = maxR - minR;

        const newCenterR = centerR - velocityX * rRange;
        const newCenterI = centerI + velocityY * iRange;

        realInput.value = newCenterR.toFixed(10);
        imaginaryInput.value = newCenterI.toFixed(10);
      }

      if (Math.abs(velocityZoom) > 0.00001) {
        zoomLevel *= 1 + velocityZoom;
        zoomInput.value = zoomLevel.toFixed(2);
      }

      updateCoordinates();

      velocityX *= friction;
      velocityY *= friction;
      velocityZoom *= friction;
    }
  }

  function OnResizeWindow() {
    if (!canvas) {
      return;
    }

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    vpDimensions = [canvas.clientWidth, canvas.clientHeight];

    const aspectRatio = canvas.width / canvas.height;
    const currentWidth = maxR - minR;
    const currentHeight = maxI - minI;
    const centerR = (minR + maxR) / 2;
    const centerI = (minI + maxI) / 2;

    const newWidth = Math.max(currentWidth, currentHeight * aspectRatio);
    const newHeight = newWidth / aspectRatio;

    minR = centerR - newWidth / 2;
    maxR = centerR + newWidth / 2;
    minI = centerI - newHeight / 2;
    maxI = centerI + newHeight / 2;

    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);

    // Update input fields after resizing
    updateInputFields();
  }

  // Hamburger Menu
  const hamburgerMenu = document.getElementById("hamburger-menu");
  settingsContainer.classList.toggle("hidden");

  hamburgerMenu.addEventListener("click", () => {
    toggleHamburgerMenu();
  });

  function toggleHamburgerMenu() {
    hamburgerMenu.classList.toggle("change");
    settingsContainer.classList.toggle("hidden");
  }

  // Color scheme selection
  const colorSchemeSelect = document.getElementById("color-scheme");
  colorSchemeSelect.addEventListener("change", function () {
    toggleHamburgerMenu();
    switch (this.value) {
      case "cool-blue":
        currentColorMode = 0;
        break;
      case "hot-pink":
        currentColorMode = 1;
        break;
      case "black-and-white":
        currentColorMode = 2;
        break;
      case "cool-green":
        currentColorMode = 3;
        break;
      case "gold":
        currentColorMode = 4;
        break;
      case "plasma":
        currentColorMode = 5;
        break;
      case "pastel":
        currentColorMode = 6;
        break;
      case "inferno":
        currentColorMode = 7;
        break;
      default:
        currentColorMode = 0;
    }
  });

  // Iterations slider and input
  const iterationsSlider = document.getElementById("iterations");
  const iterationsValue = document.getElementById("iterations-value");

  iterationsSlider.addEventListener("input", function () {
    iterationsValue.value = this.value;
    maxIterations = parseInt(this.value);
  });

  iterationsValue.addEventListener("change", function () {
    iterationsSlider.value = this.value;
    maxIterations = parseInt(this.value);
  });

  // Jump to location
  const jumpToSelect = document.getElementById("jump-to");

  jumpToSelect.addEventListener("change", function () {
    toggleHamburgerMenu();
    let real, imaginary, zoom;
    switch (this.value) {
      case "home":
        real = -0.5;
        imaginary = 0;
        zoom = 1;
        break;
      case "flower":
        real = -1.9854406434;
        imaginary = 0;
        zoom = 2300;
        break;
      case "seahorse-valley":
        real = -0.737532251;
        imaginary = 0.1665403958;
        zoom = 150.89;
        break;
      case "starfish":
        real = -0.417;
        imaginary = -0.603;
        zoom = 370;
        break;
      case "elephant-valley":
        real = 0.2966735576;
        imaginary = 0.4851305008;
        zoom = 260.78;
        break;
      case "spiral":
        real = -0.764140113;
        imaginary = -0.09488865;
        zoom = 3500.72;
        break;
      case "lightning-storm":
        real = -1.7754446326;
        imaginary = -0.0046148166;
        zoom = 1300;
        break;
      case "vortex":
        real = -0.7473278619;
        imaginary = 0.1003012304;
        zoom = 9046.45;
        break;
      case "portals":
        real = -0.0865673632;
        imaginary = -0.6563693169;
        zoom = 1300.47;
        break;
      case "sun":
        real = -0.776592847;
        imaginary = -0.136640848;
        zoom = 20000.0;
        break;
      case "tendrils":
        real = -0.2175429922;
        imaginary = -1.1144508288;
        zoom = 9000.0;
        break;
    }

    // Update input fields
    realInput.value = real.toFixed(10);
    imaginaryInput.value = imaginary.toFixed(10);
    zoomInput.value = zoom.toFixed(2);

    // Call updateCoordinates to apply the new values
    updateCoordinates();

    // Reset velocities
    velocityX = 0;
    velocityY = 0;
    velocityZoom = -0.01;
  });

  // Initial startups
  realInput.value = -0.5;
  imaginaryInput.value = 0;
  zoomInput.value = 0.7;
  updateCoordinates();
  updateInputFields();
}
