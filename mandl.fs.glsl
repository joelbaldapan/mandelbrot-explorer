precision highp float;

uniform vec2 viewportDimensions;
uniform float minI;
uniform float maxI;
uniform float minR;
uniform float maxR;

vec3 hsbToRgb(float h, float s, float b) {
    h = mod(h, 1.0) * 6.0;
    float c = b * s;
    float x = c * (1.0 - abs(mod(h, 2.0) - 1.0));
    vec3 rgb;
    if (0.0 <= h && h < 1.0) {
        rgb = vec3(c, x, 0.0);
    } else if (1.0 <= h && h < 2.0) {
        rgb = vec3(x, c, 0.0);
    } else if (2.0 <= h && h < 3.0) {
        rgb = vec3(0.0, c, x);
    } else if (3.0 <= h && h < 4.0) {
        rgb = vec3(0.0, x, c);
    } else if (4.0 <= h && h < 5.0) {
        rgb = vec3(x, 0.0, c);
    } else {
        rgb = vec3(c, 0.0, x);
    }
    return rgb + b - c;
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
    float maxIterations = 10000.0;
    const int imaxIterations = 10000;
 
    for (int i = 0; i < imaxIterations; i++) {
        float t = 2.0 * z.x * z.y + c.y;
        z.x = z.x * z.x - z.y * z.y + c.x;
        z.y = t;

        if (z.x * z.x + z.y * z.y > 4.0) {
            break;
        }

        iterations += 1.0;
    }

    if (iterations < maxIterations) {
        // Color calculation
        float hue = 200.0 + mod(sqrt(iterations / 50.0) * 1.0, 255.0);
        float sat = 80.0 / 100.0;
        float bri = 10.0 + sqrt(iterations / 50.0) * 80.0;
        bri = bri / 100.0;

        vec3 color = hsbToRgb(hue / 360.0, sat, bri);
        gl_FragColor = vec4(color, 1.0);
    } else {
        // Default color for points inside the Mandelbrot set
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    }
}
