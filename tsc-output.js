#!/usr/bin/env node
'use strict';
process.chdir('/opt/unboxy-sessions/c4fb5fa2-0d10-46ed-860a-d1bc76111532');
var ts = require('./node_modules/typescript');
var path = require('path');
var fs = require('fs');

var cfgPath = path.resolve('tsconfig.json');
var cfgRaw = ts.readConfigFile(cfgPath, ts.sys.readFile);
var parsed = ts.parseJsonConfigFileContent(cfgRaw.config, ts.sys, path.dirname(cfgPath));
var prog = ts.createProgram(parsed.fileNames, parsed.options);
var diags = ts.getPreEmitDiagnostics(prog);
var out = '';
var count = 0;
diags.forEach(function(d) {
  count++;
  if (d.file) {
    var lc = d.file.getLineAndCharacterOfPosition(d.start || 0);
    var msg = ts.flattenDiagnosticMessageText(d.messageText, '\n');
    var rel = path.relative(process.cwd(), d.file.fileName);
    out += rel + ':' + (lc.line+1) + ':' + (lc.character+1) + ' - TS' + d.code + ': ' + msg + '\n';
  } else {
    out += ts.flattenDiagnosticMessageText(d.messageText, '\n') + '\n';
  }
});
if (count === 0) {
  out = 'CLEAN: No TypeScript errors.\n';
} else {
  out += '\nTotal: ' + count + ' error(s)\n';
}
fs.writeFileSync('/tmp/tsc-results.txt', out);
process.stdout.write(out);
