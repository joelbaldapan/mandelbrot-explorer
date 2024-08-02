precision highp float;

uniform vec2 viewportDimensions;
uniform float minI;
uniform float maxI;
uniform float minR;
uniform float maxR;
uniform float maxIterations;
uniform int colorMode;

vec3 hsbToRgb(vec3 c) {
    vec3 rgb = clamp(abs(mod(c.x*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0, 0.0, 1.0);
    return c.z * mix(vec3(1.0), rgb, c.y);
}

// Cool Blue
vec3 calculateColor0(float iterations, float maxIterations) {
    float hue = 200.0 + mod(sqrt(iterations / 50.0) * 1.0, 255.0);
    float sat = 80.0 / 100.0;
    float bri = 10.0 + sqrt(iterations / 100.0) * 40.0;
    bri = bri / 100.0;
    return hsbToRgb(vec3(hue / 360.0, sat, bri));
}

// Hot Pink
vec3 calculateColor1(float iterations, float maxIterations) {
    float hue = 300.0 - mod(pow(iterations / 50.0, 0.5) * 200.0, 255.0);
    float sat = 80.0 / 100.0; 
    float bri = 100.0 / 120.0;
    return hsbToRgb(vec3(hue / 360.0, sat, bri));
}

// Black and White
vec3 calculateColor2(float iterations, float maxIterations) {
    float hue = 0.0;
    float sat = 0.0;
    float bri = iterations / 750.0;
    return hsbToRgb(vec3(hue / 360.0, sat, bri));
}

// Cool Green
vec3 calculateColor3(float iterations, float maxIterations) {
    float hue = 120.0 + mod(sqrt(iterations / 50.0) * 1.0, 255.0);
    float sat = 80.0 / 100.0;
    float bri = 10.0 + sqrt(iterations / 100.0) * 40.0;
    bri = bri / 120.0;
    return hsbToRgb(vec3(hue / 360.0, sat, bri));
}

// Gold
vec3 calculateColor4(float iterations, float maxIterations) {
    float hue = 60.0 + mod(sqrt(iterations / 50.0) * 1.0, 255.0);
    float sat = 80.0 / 100.0;
    float bri = 10.0 + sqrt(iterations / 100.0) * 40.0;
    bri = bri / 120.0;
    return hsbToRgb(vec3(hue / 360.0, sat, bri));
}

// Plasma
vec3 calculateColor5(float iterations, float maxIterations) {
    float hue = 200.0 + mod(iterations / 50.0 * 50.0, 360.0);
    float sat = 60.0 / 100.0;
    float bri = iterations / 350.0; 
    return hsbToRgb(vec3(hue / 360.0, sat, bri));
}

// Pastel
vec3 calculateColor6(float iterations, float maxIterations) {
    float hue = 300.0 - mod(pow(iterations / 50.0, 0.5) * 200.0, 255.0);
    float sat = 45.0 / 100.0; 
    float bri = 90.0 / 100.0;
    return hsbToRgb(vec3(hue / 360.0, sat, bri));
}

// Inferno
vec3 calculateColor7(float iterations, float maxIterations) {
    float hue = 1.0;
    float sat = 10.0 + mod(iterations / 50.0 * 50.0, 360.0);
    float bri = iterations / 600.0; 
    return hsbToRgb(vec3(hue / 360.0, sat, bri));
}


void main() {
    // Adjust coordinates to the canvas width and height
    vec2 c = vec2(
        gl_FragCoord.x * (maxR - minR) / viewportDimensions.x + minR,
        gl_FragCoord.y * (maxI - minI) / viewportDimensions.y + minI
    );

    // Calculate the mandelbrot set:
    vec2 z = c;
    float iterations = 0.0;
    const int imaxIterations = 10000000;
 
    for (int i = 0; i < imaxIterations; i++) {
        float t = 2.0 * z.x * z.y + c.y;
        z.x = z.x * z.x - z.y * z.y + c.x;
        z.y = t;

        if (z.x * z.x + z.y * z.y > 4.0) {
            break;
        }

        if (iterations >= maxIterations) break;

        iterations += 1.0;
    }

    if (iterations < maxIterations) {
        vec3 color;
        if (colorMode == 0) {
            color = calculateColor0(iterations, maxIterations);
        } else if (colorMode == 1) {
            color = calculateColor1(iterations, maxIterations);
        } else if (colorMode == 2) {
            color = calculateColor2(iterations, maxIterations);
        } else if (colorMode == 3) {
            color = calculateColor3(iterations, maxIterations);
        } else if (colorMode == 4) {
            color = calculateColor4(iterations, maxIterations);
        } else if (colorMode == 5) {
            color = calculateColor5(iterations, maxIterations);
        } else if (colorMode == 6) {
            color = calculateColor6(iterations, maxIterations);
        } else if (colorMode == 7) {
            color = calculateColor7(iterations, maxIterations);
        }
        gl_FragColor = vec4(color, 1.0);
    } else {
        if (colorMode >= 0) {
            gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        } 
    }
}