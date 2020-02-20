#!/usr/bin/env node

import program from 'commander';
import fs from 'fs';
import path from 'path';
import symbols from './util/symbols';
import cliProgress from 'cli-progress';
import axios from 'axios';
import _colors from 'colors';
import zlib from 'zlib';
import tar from 'tar-fs';

const packageJsonPath = path.resolve(path.join(process.cwd(), 'package.json'));

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath).toString());

program.version(packageJson.version);

console.log('executado ', packageJsonPath);

function ensureDirectoryExistence(filePath: string): void {
  const dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) {
    return;
  }
  ensureDirectoryExistence(dirname);
  fs.mkdirSync(dirname);
}
function humanFileSize(size: number): string {
  const i = Math.floor(Math.log(size) / Math.log(1024));
  return (size / Math.pow(1024, i)).toFixed(2) + ' ' + ['B', 'kB', 'MB', 'GB', 'TB'][i];
}

async function unpack(zipFilePath, basePath): Promise<void> {
  // extracting a directory
  fs.createReadStream(zipFilePath)
    .pipe(zlib.createGunzip())
    .pipe(tar.extract(basePath));
  /*
  const extract = tar.extract();

  extract.on('entry', (header, stream, cb) => {
    let data = '';

    stream.on('data', chunk => {
      data += chunk;
    });

    stream.on('end', function() {
      const filePath = path.join(basePath, header.name);
      if (!fs.lstatSync(filePath).isDirectory()) {
        console.log(filePath, data);
        ensureDirectoryExistence(filePath);
        fs.writeFileSync(filePath, 'oi');
      }
      data = '';
      cb();
    });

    stream.resume();
  });

  extract.on('finish', () => {
    console.log('finish');
  });
  //ensureDirectoryExistence(basePath);
  //fs.writeFileSync(path.join(basePath, fileName), data);

  fs.createReadStream(zipFilePath)
    .pipe(zlib.createGunzip())
    .pipe(extract);
    */
}

async function execute(): Promise<void> {
  if (packageJson.deps) {
    for (const dep of Object.keys(packageJson.deps)) {
      console.log(symbols.info, dep, ' - ', packageJson.deps[dep].url);
      const { url } = packageJson.deps[dep];
      const downloadName = path.basename(url);
      const basePath = path.join(process.cwd(), 'deps');
      const filePath = path.resolve(path.join(basePath, '.cache', dep), downloadName);
      ensureDirectoryExistence(filePath);
      const { data, headers } = await axios({
        url,
        method: 'GET',
        responseType: 'stream',
      });

      const totalLength: number = Number.parseInt(headers['content-length'], 10);
      // create a new progress bar instance and use shades_classic theme
      //const bar1 = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);

      function formatter(options, params, payload): string {
        // bar grows dynamically by current progrss - no whitespaces are added
        const bar = options.barCompleteString.substr(0, Math.round(params.progress * options.barsize));

        // end value reached ?
        // change color to green when finished
        if (params.value >= params.total) {
          return `${symbols.success} ${_colors.grey(payload.task)}  ${_colors.green(humanFileSize(params.value))}/${humanFileSize(params.total)} --[${bar}]--`;
        } else {
          return `# ${payload.task}  ${_colors.yellow(humanFileSize(params.value))}/${humanFileSize(params.total)} --[${bar}]--`;
        }
      }

      const multibar = new cliProgress.MultiBar(
        {
          barsize: 20,
          clearOnComplete: false,
          hideCursor: true,
          format: formatter,
        },
        cliProgress.Presets.shades_classic, //cliProgress.Presets.shades_grey,
      );

      // start the progress bar with a total value of 200 and start value of 0
      const bar1 = multibar.create(totalLength, 0, { task: 'Download' });

      const writer = fs.createWriteStream(filePath);
      let total = 0;
      data.on('data', chunk => {
        //console.log(chunk.length);
        total += chunk.length;
        bar1.update(total, { task: 'Download' });
      });
      data.pipe(writer);

      return await new Promise((resolve, reject) => {
        writer.on('finish', () => {
          multibar.stop();
          unpack(filePath, basePath);
          resolve();
        });
        writer.on('error', () => {
          multibar.stop();
          reject();
        });
      });
    }
  }
}

execute();

program
  .command('get')
  .description('Adiciona um to-do')
  .action(() => {
    0;
  });

program.parse(process.argv);
