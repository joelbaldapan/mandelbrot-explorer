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

    applyMomentum();

    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  OnResizeWindow();

  //
  // Event Listeners
  //

  // Momentum variables
  let velocityX = 0;
  let velocityY = 0;
  let velocityZoom = 0;
  const friction = 0.9;

  const zoomMomentumFactor = 0.6;
  const moveMomentumFactor = 0.07;

  function OnZoom(e) {
    const zoomFactor = e.deltaY < 0 ? 0.95 : 1.05;
    velocityZoom = (zoomFactor - 1) * zoomMomentumFactor;
  }

  function getCurrentZoom() {
    return 4 / (maxI - minI); // Range is -2 to 2 (total of 4)
  }

  function OnMouseMove(e) {
    if (e.buttons === 1) {
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
    }
  }

  // Touch control variables
  let touchStartX = 0;
  let touchStartY = 0;
  let previousTouchDistance = 0;
  const mobileZoomMomentumFactor = 4;
  const mobileMoveMomentumFactor = 0.4;
  let isPanning = false;
  let isZooming = false;

  // Add touch event listeners
  AddEvent(canvas, "touchstart", OnTouchStart);
  AddEvent(canvas, "touchmove", OnTouchMove);
  AddEvent(canvas, "touchend", OnTouchEnd);

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

  // Modify the existing applyMomentum function to work with both mouse and touch inputs
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
  }
}
