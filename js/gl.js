// Minimaler WebGL-1-Sprite-Renderer: texturierte, gefärbte, drehbare Rechtecke in Stapeln (Batches).
// Alle Koordinaten sind Gerätepixel (CSS-Pixel × Auflösung).

const VS = `
attribute vec2 a_pos;
attribute vec2 a_uv;
attribute vec4 a_col;
uniform vec2 u_res;
varying vec2 v_uv;
varying vec4 v_col;
void main() {
  vec2 c = a_pos / u_res * 2.0 - 1.0;
  gl_Position = vec4(c.x, -c.y, 0.0, 1.0);
  v_uv = a_uv;
  v_col = a_col;
}`;

const FS = `
precision mediump float;
uniform sampler2D u_tex;
varying vec2 v_uv;
varying vec4 v_col;
void main() {
  gl_FragColor = texture2D(u_tex, v_uv) * v_col;
}`;

const MAX_QUADS = 4096; // 16384 vertices – fits Uint16 indices
const FLOATS_PER_VERTEX = 8; // x y u v r g b a

export function createRenderer(canvas) {
  const opts = { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false };
  const gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
  if (!gl) return null;

  const textures = new Set();
  const data = new Float32Array(MAX_QUADS * 4 * FLOATS_PER_VERTEX);
  let prog;
  let vbuf;
  let loc;
  let quads = 0;
  let curTex = null;
  let curAdd = false;
  let width = 1;
  let height = 1;
  let lost = false;

  function shader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }

  function upload(t) {
    t.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t.tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, t.src);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  function init() {
    prog = gl.createProgram();
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    loc = {
      pos: gl.getAttribLocation(prog, 'a_pos'),
      uv: gl.getAttribLocation(prog, 'a_uv'),
      col: gl.getAttribLocation(prog, 'a_col'),
      res: gl.getUniformLocation(prog, 'u_res'),
    };
    vbuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbuf);
    gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW);
    const idx = new Uint16Array(MAX_QUADS * 6);
    for (let i = 0, v = 0; i < idx.length; i += 6, v += 4) idx.set([v, v + 1, v + 2, v, v + 2, v + 3], i);
    const ibuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    const stride = FLOATS_PER_VERTEX * 4;
    gl.enableVertexAttribArray(loc.pos);
    gl.vertexAttribPointer(loc.pos, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(loc.uv);
    gl.vertexAttribPointer(loc.uv, 2, gl.FLOAT, false, stride, 8);
    gl.enableVertexAttribArray(loc.col);
    gl.vertexAttribPointer(loc.col, 4, gl.FLOAT, false, stride, 16);
    gl.enable(gl.BLEND);
    for (const t of textures) upload(t);
  }

  function flush() {
    if (!quads) return;
    gl.bindTexture(gl.TEXTURE_2D, curTex.tex);
    if (curAdd) gl.blendFunc(gl.ONE, gl.ONE);
    else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, data.subarray(0, quads * 4 * FLOATS_PER_VERTEX));
    gl.drawElements(gl.TRIANGLES, quads * 6, gl.UNSIGNED_SHORT, 0);
    quads = 0;
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; });
  canvas.addEventListener('webglcontextrestored', () => { lost = false; init(); });
  init();

  return {
    get lost() { return lost; },

    /** Create a texture from a canvas/image. Kept for automatic re-upload after context loss. */
    texture(src) {
      const t = { src, w: src.width, h: src.height, tex: null };
      textures.add(t);
      if (!lost) upload(t);
      return t;
    },

    deleteTexture(t) {
      textures.delete(t);
      if (!lost && t.tex) gl.deleteTexture(t.tex);
    },

    resize(w, h) {
      width = w;
      height = h;
      gl.viewport(0, 0, w, h);
    },

    begin() {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(prog);
      gl.uniform2f(loc.res, width, height);
      quads = 0;
      curTex = null;
    },

    /** Draw texture t centred at (x, y) with size w×h, rotation rot, tint rgb and alpha a. */
    sprite(t, x, y, w, h, rot = 0, r = 1, g = 1, b = 1, a = 1, additive = false) {
      if (t !== curTex || additive !== curAdd || quads >= MAX_QUADS) {
        flush();
        curTex = t;
        curAdd = additive;
      }
      const hw = w / 2;
      const hh = h / 2;
      const c = Math.cos(rot);
      const s = Math.sin(rot);
      const pr = r * a;
      const pg = g * a;
      const pb = b * a;
      let o = quads * 4 * FLOATS_PER_VERTEX;
      const put = (dx, dy, u, v) => {
        data[o++] = x + dx * c - dy * s;
        data[o++] = y + dx * s + dy * c;
        data[o++] = u;
        data[o++] = v;
        data[o++] = pr;
        data[o++] = pg;
        data[o++] = pb;
        data[o++] = a;
      };
      put(-hw, -hh, 0, 0);
      put(hw, -hh, 1, 0);
      put(hw, hh, 1, 1);
      put(-hw, hh, 0, 1);
      quads++;
    },

    end() { flush(); },
  };
}
