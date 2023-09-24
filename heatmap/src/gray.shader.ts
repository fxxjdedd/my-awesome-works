export default {
    vert: /*glsl*/`
    precision highp float;
    attribute vec3 position;
    attribute float value;
    
    uniform float radius;
    uniform vec4 bbox;

    varying float vValue;
    varying vec2 vDir;
    varying float vRadius;

    vec4 getPosByDirection(vec2 pos, float direction, float r) {
        vec2 targetPos;
        vec2 dir;

        targetPos = vec2(pos - r);
        dir = vec2(-1, -1);
        if (direction == 1.0) {
            targetPos = vec2(pos.x - r, pos.y + r);
            dir = vec2(-1, 1);
        } else if (direction == 2.0) {
            targetPos = vec2(pos.x + r, pos.y - r);
            dir = vec2(1, -1);
        } else if (direction == 3.0) {
            targetPos = vec2(pos + r);
            dir = vec2(1, 1);
        }
        return vec4(targetPos, normalize(dir));
    }

    void main() {
      vec4 b = vec4(bbox.xy, bbox.zw );
      vec2 center = vec2((b.z + b.x) / 2.0, (b.w + b.y) / 2.0);
      vec2 bboxSize = vec2((b.z - b.x), (b.w - b.y)) / 2.0;

      vec4 posDir = getPosByDirection(position.xy - center, position.z, radius);
      gl_Position = vec4(posDir.xy / bboxSize, 0, 1); // 以数据 bbox 为局部坐标系相当于
      vValue = value;
      vDir = posDir.zw * sqrt(radius * radius * 2.0);
      vRadius = radius;
    }

    `,
    frag: /*glsl*/`
    precision highp float;
    varying float vValue;
    varying vec2 vDir;
    varying float vRadius;

    uniform float min;
    uniform float max;
    
    void main() {
      float len = length(vDir);
      gl_FragColor = vec4(1, 0, 0, (vRadius - len) / vRadius * (vValue - min) / (max - min)); // 算得一个越往中心越黑的图
    }
    `,
}