var connect = require('connect');
var serveStatic = require('serve-static');
var port = 8080;
connect().use(serveStatic(__dirname + "/", { setHeaders: (res, path, stat) => {
    if (path.match("\.wasm$")) { // force wasm content type
        res.setHeader('Content-Type', "application/wasm");
    }
}})).listen(port, function(){
    console.log('Server running on ' + port + '...');
});