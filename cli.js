/* eslint-disable no-restricted-syntax */
import { Command } from 'commander';
import fetchAll from './fetchAll.js';
import pinAll from './pin.js';

const configLimitPins = process.env.LIMIT_CONCURRENT_PINS || 5;

const program = new Command();
program
  .name('cli.js')
  .version('0.0.1');
program
  .command('fetch')
  .option('-r, --resolutions <list>', 'Resolutions to pin, separated by "," you could also use "all", or something like "240,480" that\'s also the default.', '240,480')
  .option('-a, --author <username>', 'Should we pin all the files or only the ones from "author"? It should be a string.', null)
  .option('-I, --images', 'Should we pin images (thumbnails)?', false)
  .option('-V, --videos', 'Should we pin videos?', false)
  .option('--nsfw', 'Should we pin NSFW videos?', false)
  .option('--unsfw', 'Should we pin videos that aren\'t defined either as NSFW or SFW', false)
  .option('--noc', 'Should we pin non-original videos?', false)
  .option('--uoc', 'Should we pin videos when we don\'t know if they are original?', false)
  .option('-v, --verbose', 'To make the program\'s output verbose.', false)
  .description('Saves all the corresponding hashes to 2 files, divided by protocol')
  .action((options) => {
    // change the mongo_connect string here to match your system! (Mainly the IP address)
    const mongoConnect = 'mongodb://10.147.17.3:27017/avalon';
    fetchAll('btfs pin add ', mongoConnect, configLimitPins, options);
  });
program
  .command('pin')
  .option('-i, --ipfs <path>', 'The file that contains IPFS hashes')
  .option('-b, --btfs <path>', 'The file that contains BTFS hashes')
  .option('-d, --delay <ms>', 'The delay between requests, in ms', 300)
  .description('Queue IPFS and BTFS pinning requests.')
  .action((options) => {
    console.log(options);
    pinAll(options);
  });

program.parse();
// Example to pin without a time limit and without IPFS-Cluster
// fetchAll("ipfs pin add ", "btfs pin add ", mongo_connect, limitPins,
//           author, resolutions, options.videos, options.images, options);
