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

    #define M_PI 3.1415926535897932384626433832795

    uniform int u_time;
    uniform float u_zoom;
    uniform vec2 u_offset;
    uniform int u_nodes_size;
    uniform sampler2D u_nodes;

    int factorial(int n) {
        int f = 1;
        for (int i = 0; i < 0x7fffffff; i++) {
            if (i >= n) break;
            f = f * (i+1);
        }
        return f;
    }

    int fibStage(int n) {
        int v = 1, lv = 1;
        int ii = 0;
        for (int i = 0; i < 0x7fffffff; i++) {
            ii = i;
            if (v > n) break;
            int tv = v;
            v = v + lv;
            lv = tv;
        }
        return ii;
    }

    vec2 getNodePos(int i) {
        // unpack u_nodes as [..., i, i+1, ...] -> x, y
        return vec2(
            texture2D(u_nodes, vec2((float(i) + 0.5) / float(u_nodes_size), 0)).r,
            texture2D(u_nodes, vec2((float(i) + 0.5 + 1.) / float(u_nodes_size), 0)).r
        );
    }

    float eDist(vec2 a, vec2 b) {
        return sqrt(pow(a.x - b.x, 2.) + pow(a.y - b.y, 2.));
    }

    float nodes(vec2 pos) {
        float n = 0.;
        for (int i = 0; i < 0x7fffffff; i += 2) {
            if (i >= u_nodes_size) break;
            vec2 nodePos = getNodePos(i) * float(u_time) * 0.001;
            float d = eDist(pos, nodePos);
            n += (d / pow(d, 10.));
        }

        if (n >= 1.) {
            return 3.;
        }
        return n;
    }

    void main() {
        vec2 coord = (gl_FragCoord.xy / ` + window.innerWidth + `.0 - vec2(0.5, 0.5 * ` + window.innerHeight / window.innerWidth + `));
        vec2 pos = coord * u_zoom + u_offset;
        
        //float ii = sin(abs(pos.x) + abs(pos.y));
        //float ii = pow(max(abs(pos.x), abs(pos.y)) * 1000., 1.6);

        // emergent triangles??
        // float n = 10.;
        // float l = float(factorial(int(mod(abs(pos.x) + abs(pos.y), n) * 2.5))) + float(u_time) * 0.001;
        // float t = (abs(pos.x) + abs(pos.y) - l);
        // float ii = (abs(pos.x - t * sign(pos.x)) + abs(pos.y - t * sign(pos.y))); 

        // circles
        // float t = pow(abs(sin(abs(pos.x)) - pow(sin(abs(pos.y)) + 2., 1.333)) + float(u_time) * 0.001, 2.);
        // float ii = mod(float(factorial(int(abs(t)))), t);

        // float l = sqrt(pow(pos.x, 2.) + pow(pos.y, 2.)) + 0.00000001;
        // float a = acos(pos.x / l);
        // a /= l;
        // a += sin(float(u_time) * 0.001 * a) * 0.1;
        // float ii = a;
        // float ii = abs(sin(l) - pow(sin(a) + 2., 1.333)) + float(u_time) * 0.001;

        // vv neat! vv
        // float ii = abs(pos.x) + abs(pos.y) - pow(abs(sin(abs(pos.x)) - pow(sin(abs(pos.y)) + 1., 1.333)) + float(u_time) * 0.001, 2.);

        // sin wave, investigate more applications of using conditionals
        // float x = pos.x * 1.;
        // float y = 1. * sin(x);
        // float ii = 0.;
        // float l = sqrt(pow(x - pos.x, 2.) + pow(y - pos.y, 2.));
        // if (l < 0.1) {
        //     ii = 3.;
        // }

        //gl_FragColor = vec4(mod(ii, 1.8), mod(ii, 1.25), 0.3, ii);

        // sillouhette
        //float s = min(max(0.75 - sqrt(pow(coord.x, 2.) + pow(coord.y / ` + window.innerHeight / window.innerWidth + `, 2.)), 0.) * 1.8, 1.);
        //gl_FragColor *= vec4(s,s,s,0.);

        float ii = nodes(pos);
        gl_FragColor = vec4(ii * 0.5, ii * 0.4, ii * 0.8, 1.);
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

function createTexture(gl, size, data) {
    let texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F,
        size /* width */, 1 /* height */, 0, gl.RED, gl.FLOAT, new Float32Array(data));

    // Texture dimensions are not a power of 2. Turn of mips and set
    // wrapping to clamp to edge
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    return texture;
}

function setTexture(gl, texture, size, data) {
    if (data.length == 0) {
        size = 1;
        data = [0];
    }

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F,
        size /* width */, 1 /* height */, 0, gl.RED, gl.FLOAT, new Float32Array(data));
}

let TRANSITION_TIME = 2000;
let lastClockChange = 0;
let currentTimeArray = [];
let digits = {
    get 0() {return [
        -2, 0, 2, 0, 2, 1, 2, 2, -2, -1, -2, -2,
        -2, 3, -1, 3, 0, 3, 1, 3, 2, 3,
        -2, -3, -1, -3, 0, -3, 1, -3, 2, -3,
        -2, 1, 2, -1, -2, 2, 2, -2
    ]},
    get 1() {return [
        0, 0, 0, 1, 0, 2, 0, 3, 0, -1, -2, -3, 2, -3,
        0, -2, 0, -3, -1, -3, 1, -3, -1, 2.8, -2, 2.6
    ]},
    get 2() {return [
        0, 0, -1, 0, -2, 0, 1, 0, 2, 0,
        -2, 3, -1, 3, 0, 3, 1, 3, 2, 3,
        -2, -3, -1, -3, 0, -3, 1, -3, 2, -3,
        2, 1, -2, -1, 2, 2, -2, -2
    ]},
    get 3() {return [
        0, 0, -1, 0, -2, 0, 1, 0, 2, 0,
        -2, 3, -1, 3, 0, 3, 1, 3, 2, 3,
        -2, -3, -1, -3, 0, -3, 1, -3, 2, -3,
        2, 1, 2, -1, 2, 2, 2, -2
    ]},
    get 4() {return [
        0, 0, -1, 0, -2, 0, 1, 0, 2, 0,
        -2, 3, 2, 3, 2, -3,
        2, 1, -2, 1, 2, -1, 2, 2, -2, 2, 2, -2
    ]},
    get 5() {return [
        0, 0, -1, 0, -2, 0, 1, 0, 2, 0,
        -2, 3, -1, 3, 0, 3, 1, 3, 2, 3,
        -2, -3, -1, -3, 0, -3, 1, -3, 2, -3,
        -2, 1, 2, -1, -2, 2, 2, -2
    ]},
    get 6() {return [
        0, 0, -1, 0, -2, 0, 1, 0, 2, 0,
        -2, 3, -1, 3, 0, 3, 1, 3, 2, 3,
        -2, -3, -1, -3, 0, -3, 1, -3, 2, -3,
        -2, 1, 2, -1, -2, 2, 2, -2, -2, -1, -2, -2
    ]},
    get 7() {return [
        2, 0, 2, 3,
        -2, 3, -1, 3, 0, 3, 1, 3, 2, -3,
        2, 1, 2, -1, 2, 2, 2, -2
    ]},
    get 8() {return [
        0, 0, -1, 0, -2, 0, 1, 0, 2, 0, 2, 1,
        -2, 3, -1, 3, 0, 3, 1, 3, 2, 3, 2, 2,
        -2, -3, -1, -3, 0, -3, 1, -3, 2, -3,
        -2, 1, 2, -1, -2, 2, 2, -2, -2, -1, -2, -2
    ]},
    get 9() {return [
        0, 0, -1, 0, -2, 0, 1, 0, 2, 0, 2, 1,
        -2, 3, -1, 3, 0, 3, 1, 3, 2, 3, 2, 2,
        2, -3,
        -2, 1, -2, 2, 2, -1, 2, -2
    ]},
    get [':']() {return [
        0, -1.5, 0, 1.5   
    ]}
}
function translateNodeData(nd, xd, yd) {
    return nd.map((p, i) => i % 2 == 0? p + xd : p + yd);
}

function getTimeAsNodeData() {
    let now = new Date();
    if (now - lastClockChange > 60000) { // 60 seconds
        if (lastClockChange == 0) {
                lastClockChange = now - TRANSITION_TIME / 2;
            } else {
                lastClockChange = now;
            }
        // currentTimeArray = translateNodeData(digits[2], 0, 9);
        // currentTimeArray = currentTimeArray.concat(translateNodeData(digits[1], -7, 9));
        // currentTimeArray = currentTimeArray.concat(translateNodeData(digits[3], 7, 9));
        // currentTimeArray = currentTimeArray.concat(translateNodeData(digits[4], -7, 0));
        // currentTimeArray = currentTimeArray.concat(translateNodeData(digits[5], 0, 0));
        // currentTimeArray = currentTimeArray.concat(translateNodeData(digits[6], 7, 0));
        // currentTimeArray = currentTimeArray.concat(translateNodeData(digits[7], -7, -9));
        // currentTimeArray = currentTimeArray.concat(translateNodeData(digits[8], 0, -9));
        // currentTimeArray = currentTimeArray.concat(translateNodeData(digits[9], 7, -9));
        currentTimeArray = [];
        currentTimeArray = currentTimeArray.concat(translateNodeData(digits[':'], 0, 0));
        let xd = -12;
        let hStr = '0' + now.getHours().toString();
        for (let i = Math.max(0, hStr.length - 2); i < hStr.length; i++) {
            currentTimeArray = currentTimeArray.concat(translateNodeData(digits[hStr[i]], xd, 0));
            xd += 7
        }

        xd = 5;
        let mStr = '0' + now.getMinutes().toString();
        for (let i = Math.max(0, mStr.length - 2); i < mStr.length; i++) {
            currentTimeArray = currentTimeArray.concat(translateNodeData(digits[mStr[i]], xd, 0));
            xd += 7
        }
    }

    return currentTimeArray;
}

let gl;
let zoom = 60.0, actualZoom = zoom;
let xOff = 0, actualXOff = 0;
let yOff = 0, actualYOff = 0;
let paused = true, rewind = false, fastforward = false;
let lastTime = Date.now(), time = 0;
let timeLoc;
let zoomLoc;
let offsetLoc;
let nodeData = [];
let nodeTexture;
let nodeTextureLoc;
let nodeTextureSizeLoc;
let draw;
draw = function() {
    if (Math.abs(zoom - actualZoom) > Math.pow(0.1, 32)
        || Math.abs(xOff - actualXOff) > 0.00001
        || Math.abs(yOff - actualYOff) > 0.00001) {

        actualZoom += (zoom - actualZoom) * 0.1;
        actualXOff += (xOff - actualXOff) * 0.1;
        actualYOff += (yOff - actualYOff) * 0.1;
    }

    //actualXOff += Math.sin(Date.now() / 20000 * zoom); // a little bit of shake

    let timeSpeed = 1;
    if (paused) timeSpeed = 0;
    if (rewind) {
        timeSpeed = -1;
    } else if (fastforward) {
        timeSpeed += 1;
    }

    let nd = getTimeAsNodeData();
    if (Date.now() - lastClockChange < TRANSITION_TIME) {
        time = 2500 * Math.abs(TRANSITION_TIME * 0.5 - (Date.now() - lastClockChange)) / TRANSITION_TIME;
    }
    if (Date.now() - lastClockChange > TRANSITION_TIME / 2) {
        nodeData = nd;
    }
    setTexture(gl, nodeTexture, nodeData.length, nodeData);

    time += (Date.now() - lastTime) * timeSpeed;
    lastTime = Date.now();
    gl.uniform1i(timeLoc, time);

    gl.uniform1f(zoomLoc, actualZoom);

    gl.uniform2fv(offsetLoc, new Float32Array([actualXOff / window.innerWidth, actualYOff / window.innerWidth]));

    gl.uniform1i(nodeTextureLoc, 0);
    gl.uniform1i(nodeTextureSizeLoc, nodeData.length);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    requestAnimationFrame(draw);
}

document.addEventListener("DOMContentLoaded", () => {
    let canvas = document.createElement("canvas");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.display = "block";
    document.getElementsByTagName("body")[0].append(canvas);

    gl = canvas.getContext("webgl2");
    if (!gl) {
        alert("Unable to initialize WebGL. Your browser may not support it.");
        return;
    }

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    var vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    var fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

    var program = createProgram(gl, vertexShader, fragmentShader);

    timeLoc = gl.getUniformLocation(program, "u_time");
    zoomLoc = gl.getUniformLocation(program, "u_zoom");
    offsetLoc = gl.getUniformLocation(program, "u_offset");
    nodeTextureLoc = gl.getUniformLocation(program, "u_nodes");
    nodeTextureSizeLoc = gl.getUniformLocation(program, "u_nodes_size");

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

    nodeTexture = createTexture(gl, nodeData.length, nodeData);
    // Tell WebGL we want to affect texture unit 0
    gl.activeTexture(gl.TEXTURE0);

    // Bind the texture to texture unit 0
    gl.bindTexture(gl.TEXTURE_2D, nodeTexture);

    // Tell the shader we bound the texture to texture unit 0
    gl.uniform1i(nodeTextureLoc, 0);

    draw(); // begin the draw loop

    document.addEventListener("wheel", (event) => {
        zoom += zoom * Math.sign(event.deltaY) * 0.2;
    });

    document.addEventListener("mousemove", (event) => {
        if (event.buttons == 1) {
            xOff -= event.movementX * zoom;
            yOff += event.movementY * zoom;
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.code === "ArrowLeft") {
            rewind = true;
        } else if (event.code === "ArrowRight") {
            fastforward = true;
        } else if (event.code === "Space") {
            paused = !paused;
        }
    });

    document.addEventListener("keyup", (event) => {
        if (event.code === "ArrowLeft") {
            rewind = false;
        } else if (event.code === "ArrowRight") {
            fastforward = false;
        }
    });
});