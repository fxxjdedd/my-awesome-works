export default {
    vert: /*glsl*/`
    precision highp float;
    attribute float position;

    varying float vValue;
    varying vec2 vUv;

    uniform mat4 mvp;
    uniform float height;
    uniform vec2 size;
    uniform vec4 bbox;
    uniform float radius;
    uniform vec4 heightBezier;
    uniform sampler2D texture;

    vec2 bezier(float t, vec2 P0, vec2 P1, vec2 P2, vec2 P3) {
        float t2 = t * t;
        float tt = 1.0 - t;
        float tt2 = tt * tt;
        return (P0 * tt2 * tt + P1 * 3.0 * t * tt2 + P2 * 3.0 * t2 * tt + P3 * t2 * t);
    }

    vec2 toBezier(float t, vec4 p) {
        return bezier(t, vec2(0.0, 0.0), vec2(p.x, p.y), vec2(p.z, p.w), vec2(1.0, 1.0));
    }

    vec2 calcUV(float index, vec2 size) {
        float y = float(index / size.x);
        float x = mod(index, size.x);
        return vec2(x / (size.x - 1.0), y / (size.y - 1.0));
    }

    vec2 calcVertex(float index, vec2 size, vec4 bbox) {
        float y = float(index / size.x);
        float x = mod(index, size.x);
        float widthStep = (bbox.z - bbox.x) / (size.x - 1.0);
        float heightStep = (bbox.w - bbox.y) / (size.y - 1.0);
        float xx = bbox.x + x * widthStep;
        float yy = bbox.y + y * heightStep;
        // 这里坐标系是mkt
        return vec2(xx, yy);
    }

    void main() {
        vUv = calcUV(position, size);
        vec4 color = texture2D(texture, vUv);
        float h = height * toBezier(color.a, heightBezier).y;
        vec4 b = vec4(bbox.xy - radius, bbox.zw + radius);
        gl_Position = mvp * vec4(calcVertex(position, size, b), h, 1.0);
    }
    `,
    frag: /*glsl*/`
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D texture;
    uniform float opacity;
    uniform vec4 gradient[8];

    float fade(float low, float high, float value) {
        if (value < low || value > high) {
            return 0.0;
        }
        return (value - low) / (high - low);
    }

    vec4 getColor(float grayAlpha) {
        vec3 color = vec3(0.0);
        float a = 1.0;
        color = mix(vec3(0, 0, 1), gradient[0].yzw, fade(0.0, gradient[0].x, grayAlpha));
        for (int i = 0; i < 8; i++) {
            if (gradient[i].x >= grayAlpha) {
                color = mix(gradient[i - 1].yzw, gradient[i].yzw, fade(gradient[i - 1].x, gradient[i].x, grayAlpha));
                break;
            }
        }
        return vec4(color, grayAlpha);
    }

    void main() {
        vec4 gray = texture2D(texture, vUv);
        gl_FragColor = getColor(gray.a);
        gl_FragColor.a *= opacity;
    }
    `,
}