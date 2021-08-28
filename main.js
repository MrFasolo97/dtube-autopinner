const syncClient = require('sync-rest-client');
const { exec } = require('child_process');
const API_ADDRESS = "https://dtube.fso.ovh/list_videos.php";
var myArgs = process.argv.slice(2);
console.log('myArgs: ', myArgs);
if(myArgs.length != 1) {
  console.log("This App requires exactly 1 argument, 1 author's name...");
  return -1;
}
var author_posts = syncClient.get(API_ADDRESS+"?author="+myArgs[0]).body;

async function fetchAll(author_posts) {
  let numProcs = 0;
  function remove1process() {
    numProcs -= 1;
  }
  var last_exec = 0;
  var numRows = 0;
  var last_error_print = 0;
  var num_supressed_errors = 0;
  var pinnedImgsIPFS = 0;
  var pinnedVidsIPFS = 0;
  var pinnedImgsBTFS = 0;
  var pinnedVidsBTFS = 0;
  if(typeof author_posts != 'undefined') {
    for (var document_var in author_posts) {
      if (numProcs < 50) {
        document_var = author_posts[document_var];
        if(typeof document_var.files_json != 'undefined') {
          var files = JSON.parse(document_var.files_json);
          if(typeof document_var.oc == 'undefined') {
            var oc = -1;
          } else {
            var oc = document_var.oc;
          }
          if(typeof files != 'undefined' &&
            (typeof files.btfs != 'undefined'
            || typeof files.ipfs != 'undefined')) {
            if(typeof files.ipfs != 'undefined') {
              for (var file in files.ipfs.vid) {
                file = files.ipfs.vid[file];
                numProcs += 1;
                exec("ipfs-cluster-ctl pin add --expire-in "+24*30*18+"h "+file, remove1process);
                console.log("IPFS: Pinned video: "+file);
                pinnedVidsIPFS++;
              }
              for (var file in files.ipfs.img) {
                file = files.ipfs.img[file];
                numProcs += 1;
                exec("ipfs-cluster-ctl pin add --expire-in "+24*30*18+"h "+file, remove1process);
                console.log("IPFS: Pinned img: "+file);
                pinnedImgsIPFS++;
              }
            }
            if(typeof files.btfs != 'undefined') {
              for (var file in files.btfs.vid) {
                file = files.btfs.vid[file];
                numProcs += 1;
                exec("btfs pin add "+file, remove1process);
                console.log("BTFS: Pinned video: "+file);
                pinnedVidsBTFS++;
              }
              for (var file in files.btfs.img) {
                file = files.btfs.img[file];
                numProcs += 1;
                exec("btfs pin add "+file, remove1process);
                console.log("BTFS: Pinned img: "+file);
                pinnedImgsBTFS++;
              }
            }
          }
        }
      } else {
        await sleep(1500);
      }
    }
  console.log("Tried to pin "+(pinnedVidsIPFS+pinnedVidsBTFS)+" videos (IPFS: "+pinnedVidsIPFS+", BTFS: "+pinnedVidsBTFS+").");
  console.log("Tried to pin "+(pinnedImgsIPFS+pinnedImgsBTFS)+" images (IPFS: "+pinnedImgsIPFS+", BTFS: "+pinnedImgsBTFS+").");
	}
}
function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
console.log(author_posts);
fetchAll(author_posts);
