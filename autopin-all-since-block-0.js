const syncClient = require('sync-rest-client');
const { exec } = require('child_process');
const MongoClient = require('mongodb').MongoClient;
const limit_pins = process.env.LIMIT_CONCURRENT_PINS || 25;

async function fetchAll(limit_pins, resolutions) {
  let numProcs = 0;
  function remove1process() {
    numProcs -= 1;
  }
  var lt_ts = new Date().getTime()-(6*30*24*60*60*1000); //Pin from block 0 to 6 months ago.
  const filter = {
    'ts': {
      '$gte': 1601557480488, //ts from 1st october 2020, dtube's (avalon's) mainent launch.
      '$lt': lt_ts
    }
  };
  const mongoDBClient = new MongoClient('mongodb://10.147.17.3:27017/avalon?readPreference=primary&appname=MongoDB%20Compass&directConnection=true&ssl=false');
  await mongoDBClient.connect();
  const mongoDB = mongoDBClient.db("avalon");
  const contents_collection = mongoDB.collection("contents");
  var response = await contents_collection.find(filter).toArray();
  if (numProcs < 50) {
      if(typeof response != 'undefined') {
        for (var document_var in response) {
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
          if(typeof document_var.json.files != 'undefined' &&
          (typeof document_var.json.files.btfs != 'undefined'
          || typeof document_var.json.files.ipfs != 'undefined')) {
            if(typeof document_var.json.files.ipfs != 'undefined') {
              for (var file in document_var.json.files.ipfs.vid) {
                if (file in resolutions) {
                  file = document_var.json.files.ipfs.vid[file];
                  numProcs += 1;
                  exec("ipfs-cluster-ctl pin add --expire-in "+24*30*18+"h "+file, remove1process);
                  console.log("IPFS: Pinned video: "+file);
                }
              }
              for (var file in document_var.json.files.ipfs.img) {
                file = document_var.json.files.ipfs.img[file];
                numProcs += 1;
                exec("ipfs-cluster-ctl pin add --expire-in "+24*30*18+"h "+file, remove1process);
                console.log("IPFS: Pinned img: "+file);
              }
            }
            if(typeof document_var.json.files.btfs != 'undefined') {
              for (var file in document_var.json.files.btfs.vid) {
                if (file in resolutions) {
                  file = document_var.json.files.btfs.vid[file];
                  numProcs += 1;
                  exec("btfs pin add "+file, remove1process);
                  console.log("BTFS: Pinned video: "+file);
                }
              }
              for (var file in document_var.json.files.btfs.img) {
                file = document_var.json.files.btfs.img[file];
                numProcs += 1;
                exec("btfs pin add "+file, remove1process);
                console.log("BTFS: Pinned img: "+file);
              }
            }
          }
      }
    } else {
      console.log(response.statusCode);
    }
  } else {
    await sleep(1500);
  }
}
function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}


const arguments = process.argv;
var resolutions = [];

if (arguments.length < 3) {
  resolutions = ["240", "480"]
} else {
  resolutions = arguments[2].split(",")
}

fetchAll(limit_pins, resolutions);
