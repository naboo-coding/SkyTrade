/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/buffer-reverse";
exports.ids = ["vendor-chunks/buffer-reverse"];
exports.modules = {

/***/ "(ssr)/./node_modules/buffer-reverse/index.js":
/*!**********************************************!*\
  !*** ./node_modules/buffer-reverse/index.js ***!
  \**********************************************/
/***/ ((module) => {

eval("module.exports = function reverse (src) {\n  var buffer = new Buffer(src.length)\n\n  for (var i = 0, j = src.length - 1; i <= j; ++i, --j) {\n    buffer[i] = src[j]\n    buffer[j] = src[i]\n  }\n\n  return buffer\n}\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHNzcikvLi9ub2RlX21vZHVsZXMvYnVmZmVyLXJldmVyc2UvaW5kZXguanMiLCJtYXBwaW5ncyI6IkFBQUE7QUFDQTs7QUFFQSxzQ0FBc0MsUUFBUTtBQUM5QztBQUNBO0FBQ0E7O0FBRUE7QUFDQSIsInNvdXJjZXMiOlsiQzpcXFVzZXJzXFxhbm5hYlxcRG93bmxvYWRzXFxTa3lUcmFkZVxcbm9kZV9tb2R1bGVzXFxidWZmZXItcmV2ZXJzZVxcaW5kZXguanMiXSwic291cmNlc0NvbnRlbnQiOlsibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiByZXZlcnNlIChzcmMpIHtcbiAgdmFyIGJ1ZmZlciA9IG5ldyBCdWZmZXIoc3JjLmxlbmd0aClcblxuICBmb3IgKHZhciBpID0gMCwgaiA9IHNyYy5sZW5ndGggLSAxOyBpIDw9IGo7ICsraSwgLS1qKSB7XG4gICAgYnVmZmVyW2ldID0gc3JjW2pdXG4gICAgYnVmZmVyW2pdID0gc3JjW2ldXG4gIH1cblxuICByZXR1cm4gYnVmZmVyXG59XG4iXSwibmFtZXMiOltdLCJpZ25vcmVMaXN0IjpbMF0sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///(ssr)/./node_modules/buffer-reverse/index.js\n");

/***/ })

};
;