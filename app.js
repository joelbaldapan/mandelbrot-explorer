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
  let minI = -2.0;
  let maxI = 2.0;
  let minR = -3.0;
  let maxR = 2.0;
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
      const currentZoom = 4 / (maxI - minI); // Assuming initial range is 4
      zoomInput.value = currentZoom.toFixed(2);
    }
  }

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

    const width = 4 / zoom;
    const height = width * (vpDimensions[1] / vpDimensions[0]);

    minR = real - width / 2;
    maxR = real + width / 2;
    minI = imaginary - height / 2;
    maxI = imaginary + height / 2;

    // Update uniforms
    gl.uniform1f(uniforms.minI, minI);
    gl.uniform1f(uniforms.maxI, maxI);
    gl.uniform1f(uniforms.minR, minR);
    gl.uniform1f(uniforms.maxR, maxR);

    // Reset velocities when manually updating coordinates
    velocityX = 0;
    velocityY = 0;
    velocityZoom = 0;
  }

  /// Add this after getting the input elements:
  const applyButton = document.getElementById("apply-coordinates");

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

    // Update input fields with current values
    updateInputFields();

    applyMomentum();

    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  OnResizeWindow();

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
  const moveMomentumFactor = 0.07;

  function getCurrentZoom() {
    return 4 / (maxI - minI); // Range is -2 to 2 (total of 4)
  }

  function OnZoom(e) {
    if (!isOverSettings) {
      const zoomFactor = e.deltaY < 0 ? 0.95 : 1.05;
      velocityZoom = (zoomFactor - 1) * zoomMomentumFactor;

      // Apply zoom immediately for smoother input field updates
      const iRange = maxI - minI;
      const rRange = maxR - minR;
      const centerI = (maxI + minI) / 2;
      const centerR = (maxR + minR) / 2;

      minI = centerI - (iRange * zoomFactor) / 2;
      maxI = centerI + (iRange * zoomFactor) / 2;
      minR = centerR - (rRange * zoomFactor) / 2;
      maxR = centerR + (rRange * zoomFactor) / 2;

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
  const mobileZoomMomentumFactor = 4;
  const mobileMoveMomentumFactor = 0.4;
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
      const zoomFactor = pinchDelta > 0 ? 0.99 : 1.01;
      velocityZoom = (zoomFactor - 1) * mobileZoomMomentumFactor;

      previousTouchDistance = currentTouchDistance;

      // Apply zoom immediately for smoother input field updates
      const iRange = maxI - minI;
      const rRange = maxR - minR;
      const centerI = (maxI + minI) / 2;
      const centerR = (maxR + minR) / 2;

      minI = centerI - (iRange * zoomFactor) / 2;
      maxI = centerI + (iRange * zoomFactor) / 2;
      minR = centerR - (rRange * zoomFactor) / 2;
      maxR = centerR + (rRange * zoomFactor) / 2;

      // Update input fields
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
      const iRange = maxI - minI;
      const rRange = maxR - minR;

      if (Math.abs(velocityX) > 0.00001 || Math.abs(velocityY) > 0.00001) {
        minR -= velocityX * rRange;
        maxR -= velocityX * rRange;
        minI += velocityY * iRange;
        maxI += velocityY * iRange;
      }

      if (Math.abs(velocityZoom) > 0.00001) {
        const zoomFactor = 1 + velocityZoom;
        const newIRange = iRange * zoomFactor;
        const deltaI = newIRange - iRange;
        minI -= deltaI / 2;
        maxI = minI + newIRange;
      }

      OnResizeWindow();

      velocityX *= friction;
      velocityY *= friction;
      velocityZoom *= friction;

      // Update input fields after applying momentum
      updateInputFields();
    }
  }

  function OnResizeWindow() {
    if (!canvas) {
      return;
    }

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const stretch = 0.9;

    vpDimensions = [canvas.clientWidth, canvas.clientHeight];

    const oldRealRange = maxR - minR;
    maxR =
      ((maxI - minI) * (canvas.clientWidth / canvas.clientHeight)) / stretch +
      minR;
    const newRealRange = maxR - minR;

    minR -= (newRealRange - oldRealRange) / 2;
    maxR =
      ((maxI - minI) * (canvas.clientWidth / canvas.clientHeight)) / stretch +
      minR;

    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);

    // Update input fields after resizing
    updateInputFields();
  }

  // Hamburger Menu
  const hamburgerMenu = document.getElementById("hamburger-menu");
  settingsContainer.classList.toggle("hidden");

  hamburgerMenu.addEventListener("click", () => {
    hamburgerMenu.classList.toggle("change");
    settingsContainer.classList.toggle("hidden");
  });

  // Color scheme selection
  const colorSchemeSelect = document.getElementById("color-scheme");
  colorSchemeSelect.addEventListener("change", function () {
    switch (this.value) {
      case "cool-blue":
        currentColorMode = 0;
        break;
      case "hot-pink":
        currentColorMode = 1;
        break;
      case "magma":
        currentColorMode = 2;
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
    switch (this.value) {
      case "home":
        minR = -2.0;
        maxR = 1.0;
        minI = -1.5;
        maxI = 1.5;
        break;
      case "seahorse-valley":
        minR = -0.8;
        maxR = -0.7;
        minI = 0.05;
        maxI = 0.15;
        break;
      case "starfish":
        minR = -0.463;
        maxR = -0.413;
        minI = 0.56;
        maxI = 0.61;
        break;
    }
    maintainAspectRatio();
    updateInputFields();

    velocityZoom = 0.005;
    gl.uniform1f(uniforms.minI, minI);
    gl.uniform1f(uniforms.maxI, maxI);
    gl.uniform1f(uniforms.minR, minR);
    gl.uniform1f(uniforms.maxR, maxR);
  });

  // Initial update of input fields
  updateInputFields();
}
