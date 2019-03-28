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

    uniform float u_zoom; // emulated double precision
    uniform float u_offsetX;
    uniform float u_offsetY;

    uniform sampler2D tex0;
    uniform sampler2D tex1;
    uniform sampler2D tex2;

    void main() {
        vec2 coord = (gl_FragCoord.xy / ` + window.innerWidth + `.0 - vec2(0.5, 0.5 * ` + window.innerHeight / window.innerWidth + `));
        float px = coord.x * u_zoom + u_offsetX;
        float py = coord.y * u_zoom + u_offsetY;
        float ox = px;
        float oy = py;
        
        int ii;
        for (int i = 0; i <= 500; i++) {
            ii = i;
            float tx = px;
            px = px*px - py*py + ox;
            py = 2.0*tx*py + oy;
            if (i > 10 && px * py > 10.) {
                break;
            }
        }

        if (ii < 500) {
            // gl_FragColor = vec4(vec3(0.5, 0.8, 0.1) * float(5 * ii) / 500., 1.);
            // gl_FragColor = vec4(vec3(0.5, 0.8, 0.1) * ceil(log(float(ii))), 1.);
            int img = int(ceil(log(float(ii)) / log(13.)));
            if (img == 1)
                gl_FragColor = texture2D(tex0, coord * vec2(1., -1.) + vec2(0.5, 0.5));
            else if (img == 2)
                gl_FragColor = texture2D(tex1, coord * vec2(1., -1.) + vec2(0.5, 0.5));
            else
                gl_FragColor = texture2D(tex2, coord * vec2(1., -1.) + vec2(0.5, 0.5));
        } else {
            gl_FragColor = vec4(0., 0., 0., 1.);
            //gl_FragColor = vec4(gl_FragCoord.x / ` + window.innerWidth + `.0, gl_FragCoord.y / ` + window.innerHeight + `.0, 0, 1); // return redish-purple
        }
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

function setTexture(gl, texture, url) {
    const image = new Image();
    image.onload = function() {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA,
                      gl.RGBA, gl.UNSIGNED_BYTE, image);

        // WebGL1 has different requirements for power of 2 images
        // vs non power of 2 images so check if the image is a
        // power of 2 in both dimensions.
        if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
           // Yes, it's a power of 2. Generate mips.
           gl.generateMipmap(gl.TEXTURE_2D);
        } else {
           // No, it's not a power of 2. Turn off mips and set
           // wrapping to clamp to edge
           gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
           gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
           gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        }
    };
    image.crossOrigin = "";
    image.src = url;
}

//
// Initialize a texture and load an image.
// When the image finished loading copy it into the texture.
//
function loadTexture(gl, url) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);

  // Because images have to be download over the internet
  // they might take a moment until they are ready.
  // Until then put a single pixel in the texture so we can
  // use it immediately. When the image has finished downloading
  // we'll update the texture with the contents of the image.
  const level = 0;
  const internalFormat = gl.RGBA;
  const width = 1;
  const height = 1;
  const border = 0;
  const srcFormat = gl.RGBA;
  const srcType = gl.UNSIGNED_BYTE;
  const pixel = new Uint8Array([0, 0, 255, 255]);  // opaque blue
  gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
                width, height, border, srcFormat, srcType,
                pixel);

  setTexture(gl, texture, url);

  return texture;
}

function isPowerOf2(value) {
  return (value & (value - 1)) == 0;
}

let gl;
let lastFrameTime = Date.now();
let zoom = 3, maxZoom = 3.5, minZoom = 0.0002;
let zoomDir = true; // true = zoom in
let xOff = 0.3115;
let yOff = 0.4409;
let zoomLoc;
let offsetXLoc, offsetYLoc;
let texture0, texture1, texture2;
let texture0Loc, texture1Loc, texture2Loc;
let imageQueue = [
"https://cdn1.medicalnewstoday.com/content/images/articles/322/322868/golden-retriever-puppy.jpg",
"https://upload.wikimedia.org/wikipedia/commons/thumb/d/d9/Collage_of_Nine_Dogs.jpg/1165px-Collage_of_Nine_Dogs.jpg",
"https://gist.githubusercontent.com/mbostock/9511ae067889eefa5537eedcbbf87dab/raw/944b6e5fe8dd535d6381b93d88bf4a854dac53d4/mona-lisa.jpg"];
let draw;
draw = function() {

    zoom *= 1 + 0.01 * (zoomDir? -1 : 1);
    if ((zoom > maxZoom && !zoomDir) || (zoom < minZoom && zoomDir)) {
        zoomDir = !zoomDir;
        if (zoom < minZoom) {
            console.log("switch");
            if (imageQueue.length >= 2) {
                setTexture(gl, texture0, imageQueue.pop());
                setTexture(gl, texture1, imageQueue.pop());
            }
        } else if (zoom > maxZoom) {
            if (imageQueue.length >= 1) {
                setTexture(gl, texture2, imageQueue.pop());
            }
        }
    }

    gl.uniform1f(zoomLoc, zoom);
    gl.uniform1f(offsetXLoc, xOff);
    gl.uniform1f(offsetYLoc, yOff);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture0);
    gl.uniform1i(texture0Loc, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, texture1);
    gl.uniform1i(texture1Loc, 1);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, texture2);
    gl.uniform1i(texture2Loc, 2);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    requestAnimationFrame(draw);
}

document.addEventListener("DOMContentLoaded", () => {
    let feed = new Instafeed({
        get: 'tagged',
        tagName: 'qhacks',
        resolution: "standard_resolution",
        accessToken: "10753322301.fb091cf.436f289d35be4ecdb3de045a3485fca2",
        mock: true,
        success: (data) => {
            console.log(data);
        }
    });
    feed.run();

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

    zoomLoc = gl.getUniformLocation(program, "u_zoom");
    offsetXLoc = gl.getUniformLocation(program, "u_offsetX");
    offsetYLoc = gl.getUniformLocation(program, "u_offsetY");

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

    texture0 = loadTexture(gl, "res/img0.jpg");
    texture1 = loadTexture(gl, "res/img1.jpg");
    texture2 = loadTexture(gl, "res/img2.jpg");

    texture0Loc = gl.getUniformLocation(program, "tex0");
    texture1Loc = gl.getUniformLocation(program, "tex1");
    texture2Loc = gl.getUniformLocation(program, "tex2");

    draw(); // begin the draw loop

    // document.addEventListener("wheel", (event) => {
    //     zoom += zoom * event.deltaY / 500;
    // });

    // document.addEventListener("mousemove", (event) => {
    //     if (event.buttons == 1) {
    //         xOff -= event.movementX * zoom;
    //         yOff += event.movementY * zoom;
    //     }
    // });
});
