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
      vsText: "/mandl.vs.glsl",
      fsText: "/mandl.fs.glsl",
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
  };

  // Set CPU-side variables for all of our shader variables
  let vpDimensions = [canvas.clientWidth, canvas.clientHeight];
  let minI = -2.0;
  let maxI = 2.0;
  let minR = -2.0;
  let maxR = 2.0;

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

  let thisframetime;
  let lastframetime = performance.now();
  let dt;
  let frames = [];
  let lastPrintTime = performance.now();
  const loop = function () {
    // FPS information
    thisframetime = performance.now();
    dt = thisframetime - lastframetime;
    lastframetime = thisframetime;
    frames.push(dt);
    if (lastPrintTime + 750 < thisframetime) {
      lastPrintTime = thisframetime;
      var average = 0;
      for (var i = 0; i < frames.length; i++) {
        average += frames[i];
      }
      average /= frames.length;
      document.title = Math.round(1000 / average) + " fps";
    }
    frames = frames.slice(0, 250);

    // Draw
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT);

    gl.uniform2fv(uniforms.viewportDimensions, vpDimensions);
    gl.uniform1f(uniforms.minI, minI);
    gl.uniform1f(uniforms.maxI, maxI);
    gl.uniform1f(uniforms.minR, minR);
    gl.uniform1f(uniforms.maxR, maxR);

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

  const zoomMomentumFactor = 0.5;
  const moveMomentumFactor = 0.1;

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

  function applyMomentum() {
    if (
      Math.abs(velocityX) > 0.00001 ||
      Math.abs(velocityY) > 0.00001 ||
      Math.abs(velocityZoom) > 0.00001
    ) {
      const iRange = maxI - minI;
      const rRange = maxR - minR;

      minR -= velocityX * rRange;
      maxR -= velocityX * rRange;
      minI += velocityY * iRange;
      maxI += velocityY * iRange;

      const zoomFactor = 1 + velocityZoom;
      const newIRange = iRange * zoomFactor;
      const deltaI = newIRange - iRange;
      minI -= deltaI / 2;
      maxI = minI + newIRange;

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
