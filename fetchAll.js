/* eslint-disable no-restricted-syntax */
import * as restClient from 'sync-rest-client';
import mongojs from 'mongojs';
import * as fs from 'fs';

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// Pin from block 0 to 6 months ago.
const LT_TS = new Date().getTime() - (6 * 30 * 24 * 60 * 60 * 1000);
let filter = null;

let pinnedVidsIPFS = 0; let pinnedVidsBTFS = 0;
let pinnedImgsIPFS = 0; let pinnedImgsBTFS = 0;

export default function fetchAll(btfsCommand, mongoConnectString, limitPins, options) {
  let resolutions = null;
  let author = null;
  let cursor = null;
  let response = null;
  resolutions = options.resolutions.split(',');
  author = options.author;
  const date = new Date().toISOString().slice(0, 10);
  const ipfsFile = `./ipfs-${date}.txt`;
  const btfsFile = `./btfs-${date}.txt`;
  if (author === null) {
    const mongoDBClient = mongojs(mongoConnectString);
    // mongoDBClient.connect();
    // const mongoDB = mongoDBClient.db();
    const contentsCollection = mongoDBClient.collection('contents');
    filter = {
      ts: {
        $gte: 1601557480488, // ts from 1st october 2020, dtube's (avalon's) mainent launch.
        $lt: LT_TS,
      },
    };
    cursor = contentsCollection.find(filter);
  } else {
    const API_ADDRESS = 'https://dtube.fso.ovh/list_videos.php';
    console.log(`Pinning all videos from ${author}`);
    response = restClient.get(`${API_ADDRESS}?author=${author}`);
    if (options.verbose === true) {
      console.log(response.statusCode);
    }
    response = response.body;
  }

  const dmca = restClient.get('https://raw.githubusercontent.com/dtube/dmca/master/dmca.json').body;
  if (cursor !== null) {
    cursor.on('data', (documentVar) => {
      if (`${documentVar.author}/${documentVar.link}` in dmca.videos || documentVar.author in dmca.authors) {
        if (options.verbose) {
          console.log(`Skipping ${documentVar.author}/${documentVar.link} for DMCA.`);
        }
      } else {
        let oc = -1;
        let nsfw = -1;
        if (typeof documentVar !== 'undefined' && typeof documentVar.json !== 'undefined' && typeof documentVar.json.files !== 'undefined') {
          if (typeof documentVar.json.nsfw !== 'undefined' && documentVar.json.nsfw.toString().includes('false')) {
            nsfw = 0;
          } else {
            nsfw = documentVar.json.nsfw;
          }
          if (typeof documentVar.json.oc !== 'undefined') {
            oc = documentVar.json.oc;
          }
        }
        if (typeof documentVar !== 'undefined' && typeof documentVar.json !== 'undefined' && typeof documentVar.json.files !== 'undefined'
            && (typeof documentVar.json.files.btfs !== 'undefined'
            || typeof documentVar.json.files.ipfs !== 'undefined')) {
          if (typeof documentVar.json.files.ipfs !== 'undefined') {
            for (let file in documentVar.json.files.ipfs.vid) {
              if ((resolutions.includes(file) || resolutions === 'all') && options.videos && (oc || options.noc || (options.uoc && oc === -1))
                 && (!nsfw || nsfw === options.nsfw || (nsfw === -1 && options.unsfw))) {
                file = documentVar.json.files.ipfs.vid[file];
                fs.appendFileSync(ipfsFile, `/ipfs/${file}\n`);
                if (options.verbose) {
                  console.log(`IPFS: Saved vid hash: ${file}`);
                }
                pinnedVidsIPFS += 1;
              }
            }
            if (options.images && (oc || options.noc || (options.uoc && oc === -1))
              && (!nsfw || nsfw === options.nsfw || (nsfw === -1 && options.unsfw))) {
              for (let file in documentVar.json.files.ipfs.img) {
                if (typeof documentVar.json.files.ipfs.img[file] !== 'undefined') {
                  file = documentVar.json.files.ipfs.img[file];
                  fs.appendFileSync(ipfsFile, `/ipfs/${file}\n`);
                  if (options.verbose) {
                    console.log(`IPFS: Saved img hash: ${file}`);
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
                  fs.appendFileSync(btfsFile, `/btfs/${file}\n`);
                  if (options.verbose) {
                    console.log(`BTFS: Saved vid hash: ${file}`);
                  }
                  pinnedVidsBTFS += 1;
                }
              }
              if (options.images && (oc || options.noc || (options.uoc && oc === -1))
            && (!nsfw || nsfw === options.nsfw || (nsfw === -1 && options.unsfw))) {
                for (let file in documentVar.json.files.btfs.img) {
                  if (typeof documentVar.json.files.btfs.img !== 'undefined') {
                    file = documentVar.json.files.btfs.img[file];
                    fs.appendFileSync(btfsFile, `/btfs/${file}\n`);
                    if (options.verbose) {
                      console.log(`BTFS: Saved img hash: ${file}`);
                    }
                    pinnedImgsBTFS += 1;
                  }
                }
              }
            }
          }
        } else {
          sleep(1500);
        }
      }
    });
  }
  console.log(`Saved ${pinnedVidsIPFS + pinnedVidsBTFS} videos hashes (IPFS: ${pinnedVidsIPFS}, BTFS: ${pinnedVidsBTFS}).`);
  console.log(`Saved ${pinnedImgsIPFS + pinnedImgsBTFS} images hashes (IPFS: ${pinnedImgsIPFS}, BTFS: ${pinnedImgsBTFS}).`);
  // process.exit(0);
}
