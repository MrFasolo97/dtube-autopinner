const restClient = require('sync-rest-client');
const { exec } = require('child_process');
const MongoClient = require('mongodb').MongoClient;
const { Command } = require("commander");

const limit_pins = process.env.LIMIT_CONCURRENT_PINS || 25;


async function fetchAll(ipfs_command, btfs_command, mongo_connect_string, limit_pins, options) {
  var resolutions = null, author = null;
  resolutions = options.resolutions.split(",");
  author = options.author;

  let numProcs = 0;
  function remove1process() {
    numProcs -= 1;
  }
  if (author == null) {
    const mongoDBClient = new MongoClient(mongo_connect_string);
    await mongoDBClient.connect();
    const mongoDB = mongoDBClient.db();
    const contents_collection = mongoDB.collection("contents");
    filter = {
      'ts': {
        '$gte': 1601557480488, //ts from 1st october 2020, dtube's (avalon's) mainent launch.
        '$lt': lt_ts
      }
    };
    var response = await contents_collection.find(filter).toArray();
  } else {
    const API_ADDRESS = "https://dtube.fso.ovh/list_videos.php";
    console.log("Pinning all videos from "+author);
    var response = await restClient.get(API_ADDRESS+"?author="+author);
    if(options.verbose == true) {
        console.log(response.statusCode);
    }
    response = response.body;
  }
  var pinnedVidsIPFS = 0, pinnedVidsBTFS = 0, pinnedImgsIPFS = 0, pinnedImgsBTFS = 0;
  if(typeof response != 'undefined') {
    for (var document_var in response) {
      if (numProcs < limit_pins) {
          document_var = response[document_var];
          if(typeof document_var.json != 'undefined' && typeof document_var.json.files != 'undefined') {
            if(typeof document_var.json.nsfw == 'undefined') {
              var nsfw = -1;
            } else if(document_var.json.nsfw.toString().includes("false")) {
              var nsfw = 0;
            } else {
              var nsfw = document_var.json.nsfw;
            }
            if(typeof document_var.json.oc == 'undefined') {
              var oc = -1;
            } else {
              var oc = document_var.json.oc;
            }
          }
          if(typeof document_var.json != 'undefined' && typeof document_var.json.files != 'undefined' &&
          (typeof document_var.json.files.btfs != 'undefined'
          || typeof document_var.json.files.ipfs != 'undefined')) {
            if(typeof document_var.json.files.ipfs != 'undefined') {
              for (var file in document_var.json.files.ipfs.vid) {
                if ((resolutions.includes(file) || resolutions == "all") && options.videos && (oc || options.noc || (options.uoc && oc == -1)) && (!nsfw || nsfw == options.nsfw || (nsfw == -1 && options.unsfw))) {
                  file = document_var.json.files.ipfs.vid[file];
                  numProcs += 1;
                  exec(ipfs_command+file, remove1process);
                  if(options.verbose) {
                    console.log("IPFS: Pinned video: "+file);
                  }
                  pinnedVidsIPFS += 1;
                }
              }
              if(options.images && (oc || options.noc || (options.uoc && oc == -1)) && (!nsfw || nsfw == options.nsfw || (nsfw == -1 && options.unsfw))) {
                for (var file in document_var.json.files.ipfs.img) {
                  file = document_var.json.files.ipfs.img[file];
                  numProcs += 1;
                  exec(ipfs_command+file, remove1process);
                  if(options.verbose) {
                    console.log("IPFS: Pinned img: "+file);
                  }
                  pinnedImgsIPFS += 1;
                }
              }
            }
            if(typeof document_var.json.files.btfs != 'undefined') {
              for (var file in document_var.json.files.btfs.vid) {
                if ((resolutions.includes(file) || resolutions == "all") && options.videos && (oc || options.noc || (options.uoc && oc == -1)) && (!nsfw || nsfw == options.nsfw || (nsfw == -1 && options.unsfw))) {
                  file = document_var.json.files.btfs.vid[file];
                  numProcs += 1;
                  exec(btfs_command+file, remove1process);
                  if(options.verbose) {
                    console.log("BTFS: Pinned video: "+file);
                  }
                  pinnedVidsBTFS += 1;
                }
              }
              if(options.images && (oc || options.noc || (options.uoc && oc == -1)) && (!nsfw || nsfw == options.nsfw || (nsfw == -1 && options.unsfw))) {
                for (var file in document_var.json.files.btfs.img) {
                  file = document_var.json.files.btfs.img[file];
                  numProcs += 1;
                  exec(btfs_command+file, remove1process);
                  if(options.verbose) {
                    console.log("BTFS: Pinned img: "+file);
                  }
                  pinnedImgsBTFS += 1;
                }
              }
            }
          }
      } else {
        await sleep(1500);
      }
    }
  }
  console.log("Tried to pin "+(pinnedVidsIPFS+pinnedVidsBTFS)+" videos (IPFS: "+pinnedVidsIPFS+", BTFS: "+pinnedVidsBTFS+").");
  console.log("Tried to pin "+(pinnedImgsIPFS+pinnedImgsBTFS)+" images (IPFS: "+pinnedImgsIPFS+", BTFS: "+pinnedImgsBTFS+").");
  return;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}


const program = new Command();
program.option("-r, --resolutions <list>", 'Resolutions to pin, separated by "," you could also use "all", or something like "240,480" that\'s also the default.', "240,480");
program.option("-a, --author <username>", 'Should we pin all the files or only the ones from "author"? It should be a string.', null);
program.option("-I, --images", 'Should we pin images (thumbnails)?', false);
program.option("-V, --videos", 'Should we pin videos?', false);
program.option("--nsfw", 'Should we pin NSFW videos?', false);
program.option("--unsfw", 'Should we pin videos that aren\'t defined either as NSFW or SFW', false);
program.option("--noc", 'Should we pin non-original videos?', false);
program.option("--uoc", 'Should we pin videos when we don\'t know if they are original?', false);
program.option("-v, --verbose", 'To make the program\'s output verbose.', false);
program.parse(process.argv);

var filter = null;

var lt_ts = new Date().getTime()-(6*30*24*60*60*1000); //Pin from block 0 to 6 months ago.
const options = program.opts();





//change the mongo_connect string here to match your system! (Mainly the IP address)
mongo_connect = 'mongodb://127.0.0.1:27017/avalon?readPreference=primary&appname=dtube-autopinner&directConnection=true&ssl=false';

fetchAll("ipfs-cluster-ctl pin add --expire-in "+24*30*18+"h ", "btfs pin add ", mongo_connect, limit_pins, options);

// Example to pin without a time limit and without IPFS-Cluster
// fetchAll("ipfs pin add ", "btfs pin add ", mongo_connect, limit_pins, author, resolutions, options.videos, options.images, options);
