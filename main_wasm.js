var vertexShaderSource = `
    // an attribute will receive data from a buffer
    attribute vec4 a_position;

    // all shaders have a main function
    void main() {

        // gl_Position is a special variable a vertex shader
        // is responsible for setting
        gl_Position = a_position;
    }
`;

var fragmentShaderSource = `
    // fragment shaders don't have a default precision so we need
    // to pick one. mediump is a good default
    precision highp float;

    uniform sampler2D u_sampler;

    void main() {
        if (false) {
            // vec2 coord = (gl_FragCoord.xy / ` + window.innerWidth + `.0 - vec2(0.5, 0.5 * ` + window.innerHeight / window.innerWidth + `));
            // vec2 pos = coord * u_zoom + u_offset;
            // vec2 opos = pos;
            
            // int ii;
            // for (int i = 0; i <= 500; i++) {
            //     ii = i;
            //     float tx = pos.x;
            //     pos.x = pos.x*pos.x - pos.y*pos.y + opos.x;
            //     pos.y = 2.0*tx*pos.y + opos.y;
            //     if (i > 10 && pos.x * pos.y > 10.) {
            //         break;
            //     }
            // }

            // if (ii < 500) {
            //     gl_FragColor = vec4(vec3(0.5, 0.8, 0.1) * float(ii) / 100., 1.);
            // } else {
            //     gl_FragColor = vec4(0., 0., 0., 1.);
            //     //gl_FragColor = vec4(gl_FragCoord.x / ` + window.innerWidth + `.0, gl_FragCoord.y / ` + window.innerHeight + `.0, 0, 1); // return redish-purple
            // }
        }

        gl_FragColor = texture2D(u_sampler, vec2(gl_FragCoord.x / ` + window.innerWidth + `.0, gl_FragCoord.y / ` + window.innerHeight + `.0));
    }
`;

function createShader(gl, type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    var success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (success) {
        return shader;
    }

    console.log(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
}

function createProgram(gl, vertexShader, fragmentShader) {
    var program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    var success = gl.getProgramParameter(program, gl.LINK_STATUS);
    if (success) {
        return program;
    }

    console.log(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
}

let windowTexture;
let windowTextureWidth = window.innerWidth;
let windowTextureHeight = window.innerHeight;
let textureMemory = new WebAssembly.Memory({initial:95, maximum:100});
function createWindowTexture(gl) {
    windowTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, windowTexture);

    let data = new Uint8Array(textureMemory.buffer).subarray(0, windowTextureWidth * windowTextureHeight * 3);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB,
        windowTextureWidth, windowTextureHeight, 0, gl.RGB, gl.UNSIGNED_BYTE, data);

    // Texture dimensions are not a power of 2. Turn of mips and set
    // wrapping to clamp to edge
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
}

function setWindowTexture(gl, dataBuffer) {
    gl.bindTexture(gl.TEXTURE_2D, windowTexture);

    let data = new Uint8Array(dataBuffer).subarray(0, windowTextureWidth * windowTextureHeight * 3);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB,
        windowTextureWidth, windowTextureHeight, 0, gl.RGB, gl.UNSIGNED_BYTE, data);
}

let gl;
let zoom = 3, actualZoom = 3;
let xOff = 0, actualXOff = 0;
let yOff = 0, actualYOff = 0;
let windowTextureLoc;

// Javascript implementation of the mandelbrot set as a fallback,
// mand and generateMandelbrotData get replaced with Webassembly functions
function mand(x, y, incr) {
    let ox = x, oy = y;
    for (var i = 0; i < incr; i++) {
        var tx = x;
        x = x*x - y*y + ox;
        y = tx*2*y + oy;
        if (i > 10 && x * y > 10) break;
    }
    return i;
}

function generateMandelbrotData(width, height, incr, zoom, xOff, yOff) {
    let data = new Uint8Array(width * height * 3);
    data.fill(0);

    for (var y = 0; y < height; y++) {
        for (var x = 0; x < width; x++) {
            let xp = (x / width - 0.5) * zoom + xOff / width;
            let yp = (y / width - 0.5 * (height / width)) * zoom + yOff / width;
            let r = mand(xp, yp, incr);
            if (r < incr) {
                let m = 5 * r / incr * 255;
                data.set([0.5 * m, 0.8 * m, 0.1 * m], (x + y * width) * 3);
            }
        }
    }

    return data.buffer;
}

let lastFrame = Date.now();
let targetFrameDelta = 1000 / 30;
let lastFrameScale = -1;
let draw;
draw = function() {
    let frameDelta = Date.now() - lastFrame;
    let fr = frameDelta / targetFrameDelta;
    lastFrame = Date.now();
    if (lastFrameScale !== 1
        || Math.abs(zoom - actualZoom) > Math.pow(0.1, 32)
        || Math.abs(xOff - actualXOff) > 0.00001
        || Math.abs(yOff - actualYOff) > 0.00001) {

        let zMovement = (zoom - actualZoom) * 0.5;
        let xMovement = (xOff - actualXOff) * 0.5;
        let yMovement = (yOff - actualYOff) * 0.5;
        actualZoom += zMovement;
        actualXOff += xMovement;
        actualYOff += yMovement;

        // dynamic resolution
        lastFrameScale = Math.min(Math.max(
            Math.max(
                Math.sqrt(Math.max(Math.abs(xMovement), Math.abs(yMovement)) / zoom),
                100 / (zoom / Math.abs(zMovement))),
            1), 10);
        windowTextureWidth = ~~(window.innerWidth / lastFrameScale);
        windowTextureHeight = ~~(window.innerHeight / lastFrameScale);
        let scale = window.innerWidth / windowTextureWidth;
        new Uint8Array(textureMemory.buffer).fill(0);
        generateMandelbrotData(windowTextureWidth, windowTextureHeight, 500, actualZoom, actualXOff / scale, actualYOff / scale);
        setWindowTexture(gl, textureMemory.buffer);
        // setWindowTexture(gl, generateMandelbrotData(windowTextureWidth, windowTextureHeight, 100, actualZoom, actualXOff, actualYOff));

        gl.uniform1i(windowTextureLoc, 0);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    requestAnimationFrame(draw);
}

document.addEventListener("DOMContentLoaded", () => {
    let canvas = document.createElement("canvas");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.display = "block";
    document.getElementsByTagName("body")[0].append(canvas);

    gl = canvas.getContext("webgl");
    if (!gl) {
        alert("Unable to initialize WebGL. Your browser may not support it.");
        return;
    }

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    var vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    var fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

    var program = createProgram(gl, vertexShader, fragmentShader);

    windowTextureLoc = gl.getUniformLocation(program, "u_sampler");

    // passing data into a_position
    var positionAttributeLocation = gl.getAttribLocation(program, "a_position");
    var positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

    var positions = [
        -1, 1,
        -1, -1,
        1, 1,
        1, -1
    ];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.useProgram(program);
    gl.enableVertexAttribArray(positionAttributeLocation);

    // Bind the position buffer.
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
     
    // Tell the attribute how to get data out of positionBuffer (ARRAY_BUFFER)
    var size = 2;          // 2 components per iteration
    var type = gl.FLOAT;   // the data is 32bit floats
    var normalize = false; // don't normalize the data
    var stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
    var offset = 0;        // start at the beginning of the buffer
    gl.vertexAttribPointer(positionAttributeLocation, size, type, normalize, stride, offset);

    createWindowTexture(gl);
    // Tell WebGL we want to affect texture unit 0
    gl.activeTexture(gl.TEXTURE0);

    // Bind the texture to texture unit 0
    gl.bindTexture(gl.TEXTURE_2D, windowTexture);

    // Tell the shader we bound the texture to texture unit 0
    gl.uniform1i(windowTextureLoc, 0);

    WebAssembly.instantiateStreaming(fetch('mand.wasm'), { js: { mem: textureMemory }})
    .then(results => {
        // replace the js mandelbrot impl methods with the native impl
        mand = results.instance.exports.mand;
        generateMandelbrotData = results.instance.exports.mandTex;
        draw(); // begin the draw loop
    });

    document.addEventListener("wheel", (event) => {
        zoom += zoom * Math.sign(event.deltaY) * 0.2;
    });

    document.addEventListener("mousemove", (event) => {
        if (event.buttons == 1) {
            xOff -= event.movementX * zoom;
            yOff += event.movementY * zoom;
        }
    });
});
