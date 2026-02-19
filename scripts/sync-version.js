/* oxlint-disable no-nodejs-modules */
import fs from 'node:fs';
import pkg from '@/package.json';
import app from '@/app.json';

app.expo.version = pkg.version;
fs.writeFileSync('./app.json', `${JSON.stringify(app, null, 2)}\n`);
