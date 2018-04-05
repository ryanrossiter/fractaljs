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

    #pragma optionNV(fastmath off)
    #pragma optionNV(fastprecision off)

    uniform vec2 u_zoom; // emulated double precision
    uniform vec2 u_offsetX;
    uniform vec2 u_offsetY;

    // Begin emulated double precision methods
    vec2 ds_set(float a) {
        return vec2(a, 0.0);
    }

    vec2 ds_add (vec2 dsa, vec2 dsb) {
        vec2 dsc;
        float t1, t2, e;
        t1 = dsa.x + dsb.x;
        e = t1 - dsa.x;
        t2 = ((dsb.x - e) + (dsa.x - (t1 - e))) + dsa.y + dsb.y;

        dsc.x = t1 + t2;
        dsc.y = t2 - (dsc.x - t1);
        return dsc;
    }

    vec2 ds_sub (vec2 dsa, vec2 dsb)
    {
        vec2 dsc;
        float e, t1, t2;

        t1 = dsa.x - dsb.x;
        e = t1 - dsa.x;
        t2 = ((-dsb.x - e) + (dsa.x - (t1 - e))) + dsa.y - dsb.y;

        dsc.x = t1 + t2;
        dsc.y = t2 - (dsc.x - t1);
        return dsc;
    }

    vec2 ds_mul (vec2 dsa, vec2 dsb) {
        vec2 dsc;
        float c11, c21, c2, e, t1, t2;
        float a1, a2, b1, b2, cona, conb, split = 8193.;
        cona = dsa.x * split;
        conb = dsb.x * split;
        a1 = cona - (cona - dsa.x);
        b1 = conb - (conb - dsb.x);
        a2 = dsa.x - a1;
        b2 = dsb.x - b1;

        c11 = dsa.x * dsb.x;
        c21 = a2 * b2 + (a2 * b1 + (a1 * b2 + (a1 * b1 - c11)));

        c2 = dsa.x * dsb.y + dsa.y * dsb.x;

        t1 = c11 + c2;
        e = t1 - c11;
        t2 = dsa.y * dsb.y + ((c2 - e) + (c11 - (t1 - e))) + c21;

        dsc.x = t1 + t2;
        dsc.y = t2 - (dsc.x - t1);

        return dsc;
    }
    // end emulated double precision methods

    void main() {
        vec2 coord = (gl_FragCoord.xy / ` + window.innerWidth + `.0 - vec2(0.5, 0.5 * ` + window.innerHeight / window.innerWidth + `));
        vec2 px = ds_add(ds_mul(ds_set(coord.x), u_zoom), u_offsetX);
        vec2 py = ds_add(ds_mul(ds_set(coord.y), u_zoom), u_offsetY);
        vec2 ox = px;
        vec2 oy = py;
        
        int ii;
        for (int i = 0; i <= 500; i++) {
            ii = i;
            vec2 tx = px;
            px = ds_add(ds_sub(ds_mul(px,px), ds_mul(py,py)), ox); // px*px - py*py + ox
            py = ds_add(ds_mul(ds_set(2.0), ds_mul(tx,py)), oy); // 2.0*tx*py + oy
            if (i > 10 && px[0] * py[0] > 10.) {
                break;
            }
        }

        if (ii < 500) {
            gl_FragColor = vec4(vec3(0.5, 0.8, 0.1) * float(5 * ii) / 500., 1.);
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

let gl;
let zoom = 3, actualZoom = 3.3;
let xOff = 0, actualXOff = 0;
let yOff = 0, actualYOff = 0;
let zoomLoc;
let offsetXLoc, offsetYLoc;
let draw;
draw = function() {
    if (Math.abs(zoom - actualZoom) > Math.pow(0.1, 32)
        || Math.abs(xOff - actualXOff) > 0.00001
        || Math.abs(yOff - actualYOff) > 0.00001) {

        actualZoom += (zoom - actualZoom) * 0.1;
        actualXOff += (xOff - actualXOff) * 0.1;
        actualYOff += (yOff - actualYOff) * 0.1;

        let topZoom = new Float32Array([actualZoom]);
        let bottomZoom = new Float32Array([actualZoom - topZoom[0]]);
        gl.uniform2fv(zoomLoc, new Float32Array([topZoom[0], bottomZoom[0]]));

        let topXOff = new Float32Array([actualXOff / window.innerWidth]);
        let bottomXOff = new Float32Array([actualXOff / window.innerWidth - topXOff[0]]);
        gl.uniform2fv(offsetXLoc, new Float32Array([topXOff[0], bottomXOff[0]]));

        let topYOff = new Float32Array([actualYOff / window.innerWidth]);
        let bottomYOff = new Float32Array([actualYOff / window.innerWidth - topYOff[0]]);
        gl.uniform2fv(offsetYLoc, new Float32Array([topYOff[0], bottomYOff[0]]));

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

    draw(); // begin the draw loop

    document.addEventListener("wheel", (event) => {
        zoom += zoom * event.deltaY / 500;
    });

    document.addEventListener("mousemove", (event) => {
        if (event.buttons == 1) {
            xOff -= event.movementX * zoom;
            yOff += event.movementY * zoom;
        }
    });
});
