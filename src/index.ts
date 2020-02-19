import program from 'commander';
import fs from 'fs';
import path from 'path';

const packageJsonPath = path.resolve(path.join(__dirname, '..', 'package.json'));

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath).toString());

program.version(packageJson.version);

program
  .command('get')
  .description('Adiciona um to-do')
  .action(() => {
    if (packageJson.deps) {
      Object.keys(packageJson.deps).forEach(dep => {
        console.log(dep, ' - ', packageJson.deps[dep].url);
      });
    }
  });

program.parse(process.argv);
