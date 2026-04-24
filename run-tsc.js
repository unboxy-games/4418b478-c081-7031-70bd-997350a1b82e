const ts = require('./node_modules/typescript/lib/typescript.js');
const path = require('path');
const fs = require('fs');

const configPath = path.resolve('./tsconfig.json');
const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
const parsedConfig = ts.parseJsonConfigFileContent(
  configFile.config,
  ts.sys,
  path.dirname(configPath)
);

const program = ts.createProgram(parsedConfig.fileNames, parsedConfig.options);
const diagnostics = ts.getPreEmitDiagnostics(program);

if (diagnostics.length === 0) {
  console.log('No TypeScript errors found.');
} else {
  diagnostics.forEach(d => {
    if (d.file) {
      const { line, character } = d.file.getLineAndCharacterOfPosition(d.start);
      const msg = ts.flattenDiagnosticMessageText(d.messageText, '\n');
      const relPath = path.relative(process.cwd(), d.file.fileName);
      console.log(`${relPath}:${line + 1}:${character + 1} - error TS${d.code}: ${msg}`);
    } else {
      console.log(ts.flattenDiagnosticMessageText(d.messageText, '\n'));
    }
  });
  console.log(`\nFound ${diagnostics.length} error(s).`);
}
