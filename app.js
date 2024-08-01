function loadShaderAsync(shaderURL, callback) {
  const req = new XMLHttpRequest();
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

function RunDemo(loadErrors, loadedShaders) {
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
  let uniforms = {
    viewportDimensions: gl.getUniformLocation(program, "viewportDimensions"),
    minI: gl.getUniformLocation(program, "minI"),
    maxI: gl.getUniformLocation(program, "maxI"),
    minR: gl.getUniformLocation(program, "minR"),
    maxR: gl.getUniformLocation(program, "maxR"),
  };

  // Set CPU-side variables for all of our shader variables
  const vpDimensions = [canvas.clientWidth, canvas.clientHeight];
  const minI = -2.0;
  const maxI = 2.0;
  const minR = -2.0;
  const maxR = 2.0;

  // Create buffers
  const vertexBuffer = gl.createBuffer();
  const vertices = [
    -1, 1, -1, -1, 1, -1,

    -1, 1, 1, 1, 1, -1,
  ];
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

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
