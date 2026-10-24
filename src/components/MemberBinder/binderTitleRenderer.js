// Reference title mesh from renaiss.xyz/binder (2026-10-24). Kept separate from React lifecycle.
export function createBinderTitle(container, heading) {
  let canvas = document.createElement("canvas");
  ((canvas.className = "warp-canvas"),
    canvas.setAttribute("aria-hidden", "true"));
  let gl = canvas.getContext("webgl", {
    alpha: !0,
    premultipliedAlpha: !1,
    antialias: !0,
  });
  if (!gl) return null;
  let compileShader = (e, t) => {
      let r = gl.createShader(e);
      return r ? (gl.shaderSource(r, t), gl.compileShader(r), r) : null;
    },
    program = gl.createProgram(),
    vertexShader = compileShader(
      gl.VERTEX_SHADER,
      "attribute vec2 aPos; attribute vec2 aUV; varying vec2 vUV; uniform vec2 uRes;void main(){ vUV = aUV; vec2 c = (aPos / uRes) * 2.0 - 1.0; gl_Position = vec4(c.x, -c.y, 0.0, 1.0); }",
    ),
    fragmentShader = compileShader(
      gl.FRAGMENT_SHADER,
      "precision highp float; varying vec2 vUV; uniform sampler2D uTex;void main(){ gl_FragColor = texture2D(uTex, vUV); }",
    );
  if (
    !program ||
    !vertexShader ||
    !fragmentShader ||
    (gl.attachShader(program, vertexShader),
    gl.attachShader(program, fragmentShader),
    gl.linkProgram(program),
    !gl.getProgramParameter(program, gl.LINK_STATUS))
  )
    return null;
  let positionBuffer = gl.createBuffer(),
    uvBuffer = gl.createBuffer(),
    indexBuffer = gl.createBuffer(),
    texture = gl.createTexture();
  if (!positionBuffer || !uvBuffer || !indexBuffer || !texture) return null;
  (container.appendChild(canvas),
    (heading.style.display = "none"),
    gl.useProgram(program),
    gl.enable(gl.BLEND),
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA));
  let restPositions = new Float32Array(1288),
    positions = new Float32Array(1288),
    velocities = new Float32Array(1288),
    uvs = new Float32Array(1288),
    indices = [];
  for (let e = 0; e < 13; e++)
    for (let t = 0; t < 45; t++) {
      let r = 46 * e + t,
        a = r + 1,
        n = r + 46,
        l = n + 1;
      indices.push(r, a, n, a, l, n);
    }
  let positionAttribute = gl.getAttribLocation(program, "aPos"),
    uvAttribute = gl.getAttribLocation(program, "aUV"),
    resolutionUniform = gl.getUniformLocation(program, "uRes");
  (gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer),
    gl.bufferData(
      gl.ELEMENT_ARRAY_BUFFER,
      new Uint16Array(indices),
      gl.STATIC_DRAW,
    ));
  let currentText = "";
  function drawText(e) {
    currentText = e || "";
    let t = canvas.width,
      n = canvas.height;
    if (!t || !n) return;
    let l = document.createElement("canvas");
    ((l.width = t), (l.height = n));
    let s = l.getContext("2d");
    if (!s) return;
    let i = currentText.toUpperCase(),
      o = (e) => {
        s.font =
          "800 " + e + "px system-ui, -apple-system, 'Segoe UI', sans-serif";
        try {
          s.letterSpacing = -0.03 * e + "px";
        } catch {}
      };
    ((s.textAlign = "center"), (s.textBaseline = "alphabetic"));
    let d = 0.9 * n;
    o(d);
    let c = 0.95 * t,
      m = s.measureText(i).width;
    (m > c && o((d *= c / m)),
      (s.fillStyle = "#e9e7e2"),
      (s.filter = "blur(" + Math.max(1, 9e-4 * t) + "px)"),
      s.fillText(i, t / 2, n),
      gl.bindTexture(gl.TEXTURE_2D, texture),
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0),
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, l),
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE),
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE),
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR),
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR));
  }
  function render() {
    (gl.clear(gl.COLOR_BUFFER_BIT),
      gl.uniform2f(resolutionUniform, canvas.width, canvas.height),
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer),
      gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW),
      gl.enableVertexAttribArray(positionAttribute),
      gl.vertexAttribPointer(positionAttribute, 2, gl.FLOAT, !1, 0, 0),
      gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer),
      gl.enableVertexAttribArray(uvAttribute),
      gl.vertexAttribPointer(uvAttribute, 2, gl.FLOAT, !1, 0, 0),
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer),
      gl.bindTexture(gl.TEXTURE_2D, texture),
      gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0));
  }
  function resize() {
    let e = canvas.getBoundingClientRect();
    if (!e.width) return;
    let t = Math.min(window.devicePixelRatio || 1, 2);
    ((canvas.width = Math.round(e.width * t)),
      (canvas.height = Math.round(e.height * t)),
      gl.viewport(0, 0, canvas.width, canvas.height),
      (function () {
        let e = canvas.width,
          t = canvas.height;
        for (let r = 0; r < 14; r++)
          for (let a = 0; a < 46; a++) {
            let n = (46 * r + a) * 2;
            ((restPositions[n] = positions[n] = (a / 45) * e),
              (restPositions[n + 1] = positions[n + 1] = (r / 13) * t),
              (velocities[n] = velocities[n + 1] = 0),
              (uvs[n] = a / 45),
              (uvs[n + 1] = r / 13));
          }
        (gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer),
          gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW));
      })(),
      drawText(currentText),
      render());
  }
  let pointerX = -1e5,
    pointerY = -1e5,
    frame = null;
  function animate() {
    let e = 0.12 * canvas.width,
      t = 2 * e * e,
      a = !1;
    for (let e = 0; e < 644; e++) {
      let r = 2 * e,
        n = r + 1,
        l = restPositions[r],
        s = restPositions[n],
        i = pointerX - l,
        o = pointerY - s,
        d = Math.exp(-(i * i + o * o) / t),
        c = l + (pointerX - l) * d * 0.13,
        u = s + (pointerY - s) * d * 0.13,
        f = (velocities[r] + (c - positions[r]) * 0.085) * 0.89,
        g = (velocities[n] + (u - positions[n]) * 0.085) * 0.89;
      ((velocities[r] = f),
        (velocities[n] = g),
        (positions[r] = positions[r] + f),
        (positions[n] = positions[n] + g),
        (Math.abs(f) + Math.abs(g) > 0.05 || d > 0.002) && (a = !0));
    }
    (render(), (frame = a ? requestAnimationFrame(animate) : null));
  }
  function wake() {
    null == frame && (frame = requestAnimationFrame(animate));
  }
  let pointerMove = (e) => {
      let t = canvas.getBoundingClientRect(),
        a = canvas.width / t.width;
      ((pointerX = (e.clientX - t.left) * a),
        (pointerY = (e.clientY - t.top) * a),
        wake());
    },
    pointerLeave = () => {
      ((pointerX = pointerY = -1e5), wake());
    },
    onResize = () => resize();
  return (
    window.addEventListener("pointermove", pointerMove, {
      passive: !0,
    }),
    window.addEventListener("pointerleave", pointerLeave),
    window.addEventListener("resize", onResize),
    resize(),
    {
      setText(e) {
        e !== currentText && (drawText(e), render());
      },
      refresh: resize,
      destroy() {
        (null != frame && cancelAnimationFrame(frame),
          window.removeEventListener("pointermove", pointerMove),
          window.removeEventListener("pointerleave", pointerLeave),
          window.removeEventListener("resize", onResize),
          canvas.remove(),
          (heading.style.display = ""),
          gl.deleteProgram(program),
          gl.deleteShader(vertexShader),
          gl.deleteShader(fragmentShader),
          gl.deleteBuffer(positionBuffer),
          gl.deleteBuffer(uvBuffer),
          gl.deleteBuffer(indexBuffer),
          gl.deleteTexture(texture),
          gl.getExtension("WEBGL_lose_context")?.loseContext());
      },
    }
  );
}
