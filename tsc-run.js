process.chdir('/opt/unboxy-sessions/c4fb5fa2-0d10-46ed-860a-d1bc76111532');
const ts = require('./node_modules/typescript');
const path = require('path');

const configPath = path.resolve('tsconfig.json');
const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
const parsedConfig = ts.parseJsonConfigFileContent(
  configFile.config,
  ts.sys,
  path.dirname(configPath)
);

const program = ts.createProgram(parsedConfig.fileNames, parsedConfig.options);
const diagnostics = ts.getPreEmitDiagnostics(program);
const arr = Array.from(diagnostics);

if (arr.length === 0) {
  process.stdout.write('No TypeScript errors.\n');
} else {
  arr.forEach(function(d) {
    if (d.file) {
      const lc = d.file.getLineAndCharacterOfPosition(d.start);
      const msg = ts.flattenDiagnosticMessageText(d.messageText, '\n');
      const rel = d.file.fileName.replace(process.cwd() + '/', '');
      process.stdout.write(rel + ':' + (lc.line + 1) + ':' + (lc.character + 1) + ' - TS' + d.code + ': ' + msg + '\n');
    } else {
      process.stdout.write(ts.flattenDiagnosticMessageText(d.messageText, '\n') + '\n');
    }
  });
  process.stdout.write('\nTotal: ' + arr.length + ' error(s)\n');
}
