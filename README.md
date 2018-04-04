# fractaljs
This project contains 2 implementations of the [Mandelbrot Set](https://en.wikipedia.org/wiki/Mandelbrot_set):
 - Using WebGL shaders (index.html)
 - Using Webassembly to generate the image and WebGL to render it (wasm.html)

The WebGL implementation is fastest (depending on your hardware); although the level of zoom that can be reached is not very "deep" due to WebGL shaders only supporting single precision floating point numbers.

The purpose of the Webassembly implementation, despite its slower speed, is to experiment with double precision zoom levels as they are supported in WASM. As a result, it can zoom in around twice as far. To mitigate the slower rendering speed it features dynamic resolution: while panning/zooming the image is rendered at a lower resolution to increase the frame rate temporarily.

ATOW: I believe this is the only fractal explorer that supports double precision zooming, I was unable to find any other examples after much googling. If you find one I would be interested in hearing about it.
