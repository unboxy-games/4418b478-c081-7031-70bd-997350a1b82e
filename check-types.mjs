// TypeScript type checker script
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const ts = require('./node_modules/typescript/lib/typescript.js');

const configPath = resolve(__dirname, 'tsconfig.json');
const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
if (configFile.error) {
  console.error('Failed to read tsconfig:', ts.flattenDiagnosticMessageText(configFile.error.messageText, '\n'));
  process.exit(1);
}

const parsedConfig = ts.parseJsonConfigFileContent(
  configFile.config,
  ts.sys,
  __dirname
);

const program = ts.createProgram(parsedConfig.fileNames, parsedConfig.options);
const diagnostics = ts.getPreEmitDiagnostics(program);

let errorCount = 0;
diagnostics.forEach(d => {
  if (d.file) {
    const { line, character } = d.file.getLineAndCharacterOfPosition(d.start);
    const msg = ts.flattenDiagnosticMessageText(d.messageText, '\n');
    const relPath = d.file.fileName.replace(__dirname + '/', '');
    console.log(`${relPath}:${line + 1}:${character + 1} - error TS${d.code}: ${msg}`);
  } else {
    console.log(ts.flattenDiagnosticMessageText(d.messageText, '\n'));
  }
  errorCount++;
});

if (errorCount === 0) {
  console.log('No TypeScript errors found.');
} else {
  console.log(`\nFound ${errorCount} error(s).`);
}
