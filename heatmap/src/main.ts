import REGL from "regl";
import grayShader from "./gray.shader";
import gridShader from "./grid.shader";

const map = new AMap.Map("map", {
  zooms: [4, 7],
  zoom: 4.75,
  center: [102.618687, 31.790976],
  showLabel: false,
  viewMode: "3D",
  pitch: 40,
});
console.log(map);
map.on('complete', () => {
  console.log("complete")
})
const glCustomLayer = new (AMap as any).GLCustomLayer({
  zIndex: 1,
  render: () => {
    render();
  },
});
map.add(glCustomLayer);
const customCoords = (map as any).customCoords;

const res = await fetch(
  "https://a.amap.com/Loca/static/loca-v2/demos/mock_data/traffic.json"
);
const trafficData: GeoJSON.FeatureCollection<GeoJSON.Point> = await res.json();
console.log(trafficData);

const points = trafficData.features;
const uniforms = {
  radius: 10 * 10000,
  bbox: [Infinity, Infinity, -Infinity, -Infinity],
  minmax: [Infinity, -Infinity],
  heightBezier: [0, 0.53, 0.37, 0.98],
  // prettier-ignore
  gradient: [
    1.0, 188 / 255, 30 / 255, 100 / 255,
    0.8, 158 / 255, 30 / 255, 98 / 255,
    0.6, 120 / 255, 20 / 255, 178 / 255,
    0.4, 100 / 255, 10 / 255, 155 / 255,
    0.2, 40 / 255, 19 / 255, 133 / 255,
    0.1, 89 / 255, 10 / 255, 100 / 255,
    0, 0 / 255, 0 / 255, 0 / 255,
    0, 0 / 255, 0 / 255, 0 / 255,
  ],
  size: [1000, 1000], // grid size
  height: 30 * 10000,
};
const grayMesh = {
  attributes: {
    value: [] as number[],
  },
  vertices: [] as number[],
  indices: [] as number[],
};

const gridMesh = {
  attributes: {},
  vertices: [] as number[],
  indices: [] as number[],
};

for (const p of points) {
  const pLnglat = p.geometry.coordinates;
  const pCoord = customCoords.lngLatToCoord(pLnglat);
  const pValue = p.properties!.avg;

  buildGrayMesh(pCoord, pValue);

  const bbox = uniforms.bbox;
  bbox[0] = Math.min(pCoord[0], bbox[0]);
  bbox[1] = Math.min(pCoord[1], bbox[1]);
  bbox[2] = Math.max(pCoord[0], bbox[2]);
  bbox[3] = Math.max(pCoord[1], bbox[3]);

  const minmax = uniforms.minmax;
  minmax[0] = Math.min(minmax[0], pValue);
  minmax[1] = Math.max(minmax[1], pValue);
}
buildGridMesh(uniforms.size[0], uniforms.size[1]);

function buildGrayMesh(pCoord: number[], pValue: number) {
  // prettier-ignore
  const vertex = [
    pCoord[0], pCoord[1], 0,
    pCoord[0], pCoord[1], 1,
    pCoord[0], pCoord[1], 2,
    pCoord[0], pCoord[1], 3,
  ];

  grayMesh.indices.push(
    ...[0, 1, 2, 1, 3, 2].map((i) => i + grayMesh.vertices.length / 3)
  );
  grayMesh.vertices.push(...vertex);

  grayMesh.attributes.value.push(...[pValue, pValue, pValue, pValue]);
}

function buildGridMesh(width = 1000, height = 1000) {
  const index = [];
  const position = [];

  for (let w = 0; w < width; w++) {
    for (let h = 0; h < height; h++) {
      if (h < height - 1 && w >= 1) {
        const base = ((w - 1) * width + h) * 6; // 从第二行开始，往上一行构建三角形
        index[base] = (w - 1) * width + h + 1;
        index[base + 1] = (w - 1) * width + h;
        index[base + 2] = w * width + h;
        index[base + 3] = (w - 1) * width + h + 1;
        index[base + 4] = w * width + h;
        index[base + 5] = w * width + h + 1;
      }
      position.push(w * width + h);
    }
  }

  gridMesh.vertices = position;
  gridMesh.indices = index;
}

var theregl: REGL.Regl;
REGL({
  gl: map.getGL(),
  extensions: ["OES_element_index_uint"],
  onDone(err, regl) {
    if (!err) {
      theregl = regl!;
      requestMapRender();
    }
  },
});

function requestMapRender() {
  (map as any).render();
}


function render() {
  if (!theregl) return;
  console.log("render");
  theregl._refresh();
  renderGrayTexture();
  renderGridHeatMap();
}

let grayTex: REGL.Framebuffer2D | null = null;
let grayTex2: REGL.Framebuffer2D | null = null;
let grayTexSize;
let grayCMD: REGL.DrawCommand;
let gridCMD: REGL.DrawCommand;
function renderGrayTexture() {
  if (!grayTex) {
    console.log("###", theregl._gl.drawingBufferWidth)
    grayTex = theregl.framebuffer({
      width: theregl._gl.drawingBufferWidth,
      height: theregl._gl.drawingBufferHeight,
      depthStencil: false,
      stencil: false,
      depth: false,
    });
    grayTex2 = theregl.framebuffer({
      width: theregl._gl.drawingBufferWidth,
      height: theregl._gl.drawingBufferHeight,
      depthStencil: false,
      stencil: false,
      depth: false,
    });
    grayTexSize = [
      theregl._gl.drawingBufferWidth,
      theregl._gl.drawingBufferHeight,
    ];
  }

  if (!grayCMD) {
    grayCMD = theregl({
      vert: grayShader.vert,
      frag: grayShader.frag,
      attributes: {
        position: theregl.prop("position"),
        value: theregl.prop("value"),
      },
      uniforms: {
        radius: theregl.prop("radius"),
        bbox: theregl.prop("bbox"),
        min: theregl.prop("min"),
        max: theregl.prop("max"),
      },
      depth: {
        enable: false,
      },
      blend: {
        enable: true,
        func: {
          srcRGB: 'src alpha',
          srcAlpha: 1,
          dstRGB: 'one minus src alpha',
          dstAlpha: 'one minus src alpha',
        }
      },
      elements: theregl.prop("index"),
    });
  }

  grayTex.use(() => {
    theregl.clear({
      color: [0, 0, 0, 0],
      depth: 1,
    });

    grayCMD({
      value: {
        buffer: theregl.buffer(grayMesh.attributes.value),
        offset: 0,
        stride: 4,
      },
      index: theregl.elements({
        primitive: "triangles",
        type: "uint32",
        data: grayMesh.indices.slice(0, grayMesh.indices.length),
      }),
      position: {
        buffer: theregl.buffer(grayMesh.vertices),
        offset: 0,
        stride: 4 * 3,
      },
      radius: uniforms.radius,
      bbox: uniforms.bbox,
      min: uniforms.minmax[0],
      max: uniforms.minmax[1],
    });
  });
}
function renderGridHeatMap() {
  if (!gridCMD) {
    gridCMD = theregl({
      vert: gridShader.vert,
      frag: gridShader.frag,
      attributes: {
        position: theregl.prop("position"),
      },
      uniforms: {
        mvp: theregl.prop("mvp"),
        opacity: theregl.prop("opacity"),
        texture: theregl.prop("texture"),
        bbox: theregl.prop("bbox"),
        size: theregl.prop("size"),
        height: theregl.prop("height"),
        heightBezier: theregl.prop("heightBezier"),
        radius: theregl.prop("radius"),
        gradient: theregl.prop("gradient"),
      },
      depth: {
        enable: true,
      },
      blend: {
        enable: true,
        func: {
          srcRGB: 'src alpha',
          srcAlpha: 1,
          dstRGB: 'one minus src alpha',
          dstAlpha: 'one minus src alpha',
        }
      },
      cull: {
        enable: true,
        face: "back",
      },
      frontFace: "cw",
      elements: theregl.prop("index"),
    });
  }

  gridCMD({
    texture: grayTex,
    heightBezier: uniforms.heightBezier,
    height: uniforms.height,
    gradient: uniforms.gradient,
    position: gridMesh.vertices,
    index: gridMesh.indices,
    mvp: customCoords.getMVPMatrix(),
    bbox: uniforms.bbox,
    radius: uniforms.radius,
    size: uniforms.size,
    opacity: 1.0,
  });
}
