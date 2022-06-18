const restClient = require('sync-rest-client');
const { exec } = require('child_process');
const { MongoClient } = require('mongodb');
const { Command } = require('commander');

const configLimitPins = process.env.LIMIT_CONCURRENT_PINS || 5;

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// Pin from block 0 to 6 months ago.
const LT_TS = new Date().getTime() - (6 * 30 * 24 * 60 * 60 * 1000);
let filter = null;

async function fetchAll(ipfsCommand, btfsCommand, mongoConnectString, limitPins, options) {
  let resolutions = null;
  let author = null;
  let response = null;
  resolutions = options.resolutions.split(',');
  author = options.author;
  let numProcs = 0;
  function remove1process() {
    numProcs -= 1;
  }
  if (author === null) {
    const mongoDBClient = new MongoClient(mongoConnectString);
    await mongoDBClient.connect();
    const mongoDB = mongoDBClient.db();
    const contentsCollection = mongoDB.collection('contents');
    filter = {
      ts: {
        $gte: 1601557480488, // ts from 1st october 2020, dtube's (avalon's) mainent launch.
        $lt: LT_TS,
      },
    };
    response = await contentsCollection.find(filter).toArray();
  } else {
    const API_ADDRESS = 'https://dtube.fso.ovh/list_videos.php';
    console.log(`Pinning all videos from ${author}`);
    response = await restClient.get(`${API_ADDRESS}?author=${author}`);
    if (options.verbose === true) {
      console.log(response.statusCode);
    }
    response = response.body;
  }
  let pinnedVidsIPFS = 0; let pinnedVidsBTFS = 0;
  let pinnedImgsIPFS = 0; let pinnedImgsBTFS = 0;

  const dmca = await restClient.get('https://raw.githubusercontent.com/dtube/dmca/master/dmca.json').body;
  if (response !== null) {
    for (let documentVar in response) {
      if (`${documentVar.author}/${documentVar.link}` in dmca.videos || documentVar.author in dmca.authors) {
        if (options.verbose) {
          console.log(`Skipping ${documentVar.author}/${documentVar.link} for DMCA.`);
        }
      } else if (numProcs < limitPins) {
        documentVar = response[documentVar];
        let oc = -1;
        let nsfw = -1;
        if (typeof documentVar.json !== 'undefined' && typeof documentVar.json.files !== 'undefined') {
          if (documentVar.json.nsfw.toString().includes('false')) {
            nsfw = 0;
          } else {
            nsfw = documentVar.json.nsfw;
          }
          if (typeof documentVar.json.oc !== 'undefined') {
            oc = documentVar.json.oc;
          }
        }
        if (typeof documentVar.json !== 'undefined' && typeof documentVar.json.files !== 'undefined'
            && (typeof documentVar.json.files.btfs !== 'undefined'
            || typeof documentVar.json.files.ipfs !== 'undefined')) {
          if (typeof documentVar.json.files.ipfs !== 'undefined') {
            for (let file in documentVar.json.files.ipfs.vid) {
              if ((resolutions.includes(file) || resolutions === 'all') && options.videos && (oc || options.noc || (options.uoc && oc === -1))
                 && (!nsfw || nsfw === options.nsfw || (nsfw === -1 && options.unsfw))) {
                file = documentVar.json.files.ipfs.vid[file];
                numProcs += 1;
                exec(ipfsCommand + file, remove1process);
                if (options.verbose) {
                  console.log(`IPFS: Pinned video: ${file}`);
                }
                pinnedVidsIPFS += 1;
              }
            }
            if (options.images && (oc || options.noc || (options.uoc && oc === -1))
              && (!nsfw || nsfw === options.nsfw || (nsfw === -1 && options.unsfw))) {
              for (let file in documentVar.json.files.ipfs.img) {
                file = documentVar.json.files.ipfs.img[file];
                numProcs += 1;
                exec(ipfsCommand + file, remove1process);
                if (options.verbose) {
                  console.log(`IPFS: Pinned img: ${file}`);
                }
                pinnedImgsIPFS += 1;
              }
            }
          }
          if (typeof documentVar.json.files.btfs !== 'undefined') {
            for (let file in documentVar.json.files.btfs.vid) {
              if ((resolutions.includes(file) || resolutions === 'all')
                   && options.videos && (oc || options.noc || (options.uoc && oc === -1))
                   && (!nsfw || nsfw === options.nsfw || (nsfw === -1 && options.unsfw))) {
                file = documentVar.json.files.btfs.vid[file];
                numProcs += 1;
                exec(btfsCommand + file, remove1process);
                if (options.verbose) {
                  console.log(`BTFS: Pinned video: ${file}`);
                }
                pinnedVidsBTFS += 1;
              }
            }
            if (options.images && (oc || options.noc || (options.uoc && oc === -1))
            && (!nsfw || nsfw === options.nsfw || (nsfw === -1 && options.unsfw))) {
              for (let file in documentVar.json.files.btfs.img) {
                file = documentVar.json.files.btfs.img[file];
                numProcs += 1;
                exec(btfsCommand + file, remove1process);
                if (options.verbose) {
                  console.log(`BTFS: Pinned img: ${file}`);
                }
                pinnedImgsBTFS += 1;
              }
            }
          }
        }
      } else {
        sleep(1500);
      }
    }
  }
  console.log(`Tried to pin ${pinnedVidsIPFS + pinnedVidsBTFS} videos (IPFS: ${pinnedVidsIPFS}, BTFS: ${pinnedVidsBTFS}).`);
  console.log(`Tried to pin ${pinnedImgsIPFS + pinnedImgsBTFS} images (IPFS: ${pinnedImgsIPFS}, BTFS: ${pinnedImgsBTFS}).`);
  process.exit(0);
}

const program = new Command();
program.option('-r, --resolutions <list>', 'Resolutions to pin, separated by "," you could also use "all", or something like "240,480" that\'s also the default.', '240,480');
program.option('-a, --author <username>', 'Should we pin all the files or only the ones from "author"? It should be a string.', null);
program.option('-I, --images', 'Should we pin images (thumbnails)?', false);
program.option('-V, --videos', 'Should we pin videos?', false);
program.option('--nsfw', 'Should we pin NSFW videos?', false);
program.option('--unsfw', 'Should we pin videos that aren\'t defined either as NSFW or SFW', false);
program.option('--noc', 'Should we pin non-original videos?', false);
program.option('--uoc', 'Should we pin videos when we don\'t know if they are original?', false);
program.option('-v, --verbose', 'To make the program\'s output verbose.', false);
program.parse(process.argv);

const options = program.opts();

// change the mongo_connect string here to match your system! (Mainly the IP address)
const mongoConnect = 'mongodb://127.0.0.1:27017/avalon?readPreference=primary&appname=dtube-autopinner&directConnection=true&ssl=false';

fetchAll(`ipfs-cluster-ctl pin add --expire-in ${24 * 30 * 18}h `, 'btfs pin add ', mongoConnect, configLimitPins, options);

// Example to pin without a time limit and without IPFS-Cluster
// fetchAll("ipfs pin add ", "btfs pin add ", mongo_connect, limitPins,
//           author, resolutions, options.videos, options.images, options);
