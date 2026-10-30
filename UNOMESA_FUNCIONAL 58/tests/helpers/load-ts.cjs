const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
module.exports = function load(file, dependencies = {}, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  vm.runInNewContext(code, { exports, require: name => dependencies[name] || require(name),
    Date, Error, URL, Buffer, process, ...globals }, { filename: file });
  return exports;
};
