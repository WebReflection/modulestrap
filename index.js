#!/usr/bin/env node

/*! (c) Andrea Giammarchi */

const fs = require('fs');
const os = require('os');
const path = require('path');
const {spawn} = require('child_process');

const argv = process.argv.slice(2);

const options = argv.filter(option => /^-/.test(option));
const repo = argv.filter(option => !/^-/.test(option)).shift();

const dim = /\bMicrosoft\b/.test(os.release()) || os.platform() === 'win32' ? 90 : 2;

if (options.includes('--help')) {
  const module = require(path.join(__dirname, 'package.json'));
  console.log(`
  \x1B[1m${module.name}\x1B[0m [options] project-name

  \x1B[${dim}m[options]\x1B[0m
    --babel      \x1B[${dim}m# to transpile for older browsers\x1B[0m
    --cover      \x1B[${dim}m# to include coverage tools\x1B[0m
    --esx        \x1B[${dim}m# to include Babel ESX transformer\x1B[0m
    --node       \x1B[${dim}m# to create a NodeJS only module\x1B[0m
    --ungap      \x1B[${dim}m# to include polyfills\x1B[0m
    --force      \x1B[${dim}m# to overwrite existent projects\x1B[0m
    --ucjs       \x1B[${dim}m# use ucjs instead of ascjs\x1B[0m
    --no-default \x1B[${dim}m# to avoid exporting module.default\x1B[0m
    --no-interop \x1B[${dim}m# alias for --no-default\x1B[0m
    --lint       \x1B[${dim}m# eslint\x1B[0m

  \x1B[${dim}mversion ${module.version} (c) Andrea Giammarchi - ${module.license}\x1B[0m
  `);
  process.exit();
}
else if (!repo) {
  console.error(`🛑 \x1B[${dim}mno\x1B[0m project-name \x1B[${dim}mspecified, try with\x1B[0m --help`);
  process.exit(1);
}

const exported = repo.replace(/-(\S)/g, ($0, $1) => $1.toUpperCase());
const dir = path.resolve(repo);

const ucjs = options.includes('--ucjs') ? 'ucjs' : 'ascjs';
const esx = options.includes('--esx');
const force = options.includes('--force');
const lint = options.includes('--lint');
const noDefault = options.includes('--no-default') ||
                  options.includes('--no-interop');

fs.mkdir(dir, async err => {
  if (err) {
    console.warn(`⚠ ${dir} already bootstrapped`);
    force || process.exit();
  }
  console.log('creating dual module structure');
  fs.mkdir(path.join(dir, 'test'), err => {
    force || error(err);
    fs.mkdir(path.join(dir, 'cjs'), err => {
      force || error(err);
      fs.mkdir(path.join(dir, 'esm'), err => {
        force || error(err);
        process.chdir(dir);
        const node = options.includes('--node') || options.includes('--nodejs');
        const cover = options.includes('--cover');
        const babel = esx || (!node && options.includes('--babel'));
        const ungap = !node && options.includes('--ungap');
        console.log('initializing npm & modules' + (
          babel ? ' + babel' : ''
        ) + (
          cover ? ' + code coverage' : ''
        ) + (
          esx ? ' + ESX' : ''
        ) + (
          ungap ? ' + ungap' : ''
        ) + (
          lint ? ' + eslint' : ''
        ));
        spawn('npm', ['init', '-y']).on('close', () => {
          spawn('npm', ['i', '-D', ucjs].concat(
            babel ? [
              '@babel/core',
              '@babel/preset-env',
              '@rollup/plugin-babel',
              'terser',
            ] : [],
            cover ? [
              'coveralls',
              'c8'
            ] : [],
            esx ? [
              '@ungap/esxtoken',
              '@ungap/babel-plugin-transform-esx'
            ] : [],
            node ? [] : [
              'rollup',
              '@rollup/plugin-node-resolve',
              '@rollup/plugin-terser'
            ],
            ungap ? [
              'rollup-plugin-includepaths',
              '@ungap/degap'
            ] : [],
            lint ? [
              'eslint'
            ] : []
          )).on('close', () => {
            console.log('setup package.json');
            const rollup = !node;
            const json = path.join(dir, 'package.json');
            const package = require(json);
            delete package.directories;
            package.version = '0.0.0';
            package.module = './esm/index.js';
            package.main = './cjs/index.js';
            package.type = 'module';
            package.exports = {
              ".": {
                "import": "./esm/index.js",
                "default": "./cjs/index.js"
              },
              "./package.json": "./package.json"
            };
            if (!node)
              package.unpkg = babel ? 'min.js' : 'es.js';
            const scripts = {};
            scripts.build = 'npm run cjs';
            scripts.cjs = ucjs + ' ' + (noDefault ? '--no-default ' : '') + 'esm cjs';
            if (rollup) {
              scripts['rollup:es'] = `rollup --config rollup/es.config.js && sed -i.bck 's/^var /self./' es.js && rm -rf es.js.bck`;
              scripts.build += ' && npm run rollup:es';
              if (babel) {
                scripts['rollup:babel'] = `rollup --config rollup/babel.config.js && sed -i.bck 's/^var /self./' index.js && rm -rf index.js.bck`;
                scripts.min = "terser index.js --comments='/^!/' -c -m -o min.js";
                scripts.build += ' && npm run rollup:babel && npm run min';
              }
              else {
                scripts['rollup:index'] = 'rollup --config rollup/index.config.js';
                scripts.build += ' && npm run rollup:index';
              }
            }
            if (noDefault && !node) {
              scripts['fix:default'] = "sed -i 's/({})/({}).default/' index.js";
              if (rollup)
                scripts['fix:default'] += " && sed -i 's/({})/({}).default/' es.js";
              if (babel)
                scripts['fix:default'] += " && sed -i 's/({})/({}).default/' min.js";
              scripts.build += ' && npm run fix:default';
            }
            scripts.build += ' && npm run test';
            if (cover) {
              scripts.coveralls = 'c8 report --reporter=text-lcov | coveralls';
              scripts.test = 'c8 node test/index.js';
            }
            if (lint) {
              scripts.test = scripts.test ? ('eslint esm/ && ' + scripts.test) : 'eslint esm/';
              const config = {
                env: {es2021: true},
                extends: "eslint:recommended",
                parserOptions: {
                  // theoretically this should not be needed
                  ecmaVersion: 12,
                  sourceType: "module"
                },
                rules: {}
              };
              if (node)
                config.env.node = true;
              else
                config.env.browser = true;
              fs.writeFile(
                path.join(dir, '.eslintrc.json'),
                JSON.stringify(config, null, '  '),
                error
              );
            }
            package.scripts = scripts;
            fs.writeFile(json, JSON.stringify(package, null, '  '), err => {
              error(err);
              if (rollup) {
                fs.writeFile(
                  path.join(dir, 'test', 'index.html'),
                  `<!DOCTYPE html>
                  <html lang="en">
                  <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width,initial-scale=1.0">
                    <title>${repo}</title>
                    <script type="module">
                    import(
                      /^(?:localhost|\[::1\]|127(?:\.\d+){3})$/.test(location.hostname) ?
                      '../esm/index.js' :
                      'https://unpkg.com/${repo}?module'
                    )
                    .then((module) => {
                      console.log(module);
                    });
                    </script>
                  </head>
                  <body></body>
                  </html>
                  `.replace(/^\s{18}/mg, ''),
                  error
                );
                fs.mkdir(path.join(dir, 'rollup'), err => {
                  force || error(err);
                  fs.writeFile(
                    path.join(dir, 'rollup', 'es.config.js'),
                    `
                    import {nodeResolve} from '@rollup/plugin-node-resolve';
                    import terser from '@rollup/plugin-terser';
                    ${esx ? `import babel from '@rollup/plugin-babel';` : ''}
                    ${ungap ? `
                    import includePaths from 'rollup-plugin-includepaths';
                    `.trim() : ''}
                    export default {
                      input: './esm/index.js',
                      plugins: [
                        ${ungap ? `
                        includePaths({
                          include: {},
                        }),
                        `.trim() : ''}
                        nodeResolve(),
                        ${esx ? `babel({plugins: [["@ungap/transform-esx", { "polyfill": "import" }]]}),` : ''}
                        terser()
                      ],
                      ${ungap ? `
                      context: 'null',
                      moduleContext: 'null',
                      `.trim() : ''}
                      output: {
                        esModule: false,
                        exports: 'named',
                        file: './es.js',
                        format: 'iife',
                        name: '${exported}'
                      }
                    };
                    `.replace(/^ {20}/mg, '').trimStart(),
                    error
                  );
                  if (babel) {
                    fs.writeFile(
                      path.join(dir, 'rollup', 'babel.config.js'),
                      `
                      import {nodeResolve} from '@rollup/plugin-node-resolve';
                      import babel from '@rollup/plugin-babel';
                      ${ungap ? `
                      import includePaths from 'rollup-plugin-includepaths';
                      `.trim() : ''}
                      export default {
                        input: './esm/index.js',
                        plugins: [
                          ${ungap ? `
                          includePaths({
                            include: {},
                          }),
                          `.trim() : ''}
                          nodeResolve(),
                          babel({
                            ${esx ? `plugins: [["@ungap/transform-esx", { "polyfill": "import" }]],` : ''}
                            presets: ['@babel/preset-env'],
                            babelHelpers: 'bundled'
                          })
                        ],
                        ${ungap ? `
                        context: 'null',
                        moduleContext: 'null',
                        `.trim() : ''}
                        output: {
                          esModule: false,
                          exports: 'named',
                          file: './index.js',
                          format: 'iife',
                          name: '${exported}'
                        }
                      };
                      `.replace(/^ {22}/mg, '').trimStart(),
                      error
                    );
                  }
                  else {
                    fs.writeFile(
                      path.join(dir, 'rollup', 'index.config.js'),
                      `
                      import {nodeResolve} from '@rollup/plugin-node-resolve';
                      ${esx ? `import babel from '@rollup/plugin-babel';` : ''}
                      ${ungap ? `
                      import includePaths from 'rollup-plugin-includepaths';
                      `.trim() : ''}
                      export default {
                        input: './esm/index.js',
                        plugins: [
                          ${ungap ? `
                          includePaths({
                            include: {},
                          }),
                          `.trim() : ''}
                          nodeResolve(),
                          ${esx ? `babel({plugins: [["@ungap/transform-esx", { "polyfill": "import" }]]})` : ''}
                        ],
                        ${ungap ? `
                        context: 'null',
                        moduleContext: 'null',
                        `.trim() : ''}
                        output: {
                          esModule: false,
                          exports: 'named',
                          file: './index.js',
                          format: 'iife',
                          name: '${exported}'
                        }
                      };
                      `.replace(/^ {22}/mg, '').trimStart(),
                      error
                    );
                  }
                });
                finalize();
              }
              else
                finalize();
            });
          });
        });
      });
    });
  });
});

function error(err) {
  if (err) {
    console.error(err);
    process.exit(1);
  }
}

function finalize() {
  fs.writeFile(
    path.join(dir, '.npmrc'),
    [
      'package-lock=false',
      ''
    ].join('\n'),
    error
  );
  fs.writeFile(
    path.join(dir, '.gitignore'),
    [
      '.DS_Store',
      '.nyc_output',
      'coverage/',
      'node_modules/',
      ''
    ].join('\n'),
    error
  );
  fs.writeFile(
    path.join(dir, '.npmignore'),
    [
      '.DS_Store',
      '.nyc_output',
      '.eslintrc.json',
      '.github/',
      '.travis.yml',
      'coverage/',
      'node_modules/',
      'rollup/',
      'test/',
      ''
    ].join('\n'),
    error
  );
  fs.writeFile(
    path.join(dir, 'test', 'package.json'),
    `{"type":"commonjs"}`,
    error
  );
  fs.writeFile(
    path.join(dir, 'test', 'index.js'),
    `require('../cjs');`,
    error
  );
  fs.writeFile(
    path.join(dir, 'esm', 'index.js'),
    'export default () => {};\n',
    err => {
      error(err);
      console.log('testing the build');
      setTimeout(
        () => {
          spawn('npm', ['run', 'build']);
          fs.unlink(path.join(dir, 'package-lock.json'), Object);
        },
        500
      );
    }
  );
}
