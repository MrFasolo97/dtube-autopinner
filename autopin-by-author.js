const syncClient = require('sync-rest-client');
const { exec } = require('child_process');
const API_ADDRESS = "https://dtube.fso.ovh/list_videos.php";
const limit_pins = process.env.LIMIT_CONCURRENT_PINS || 25;


async function fetchAll(author_posts, limit_pins) {
  let numProcs = 0;
  function remove1process() {
    numProcs -= 1;
  }
  var pinnedImgsIPFS = 0;
  var pinnedVidsIPFS = 0;
  var pinnedImgsBTFS = 0;
  var pinnedVidsBTFS = 0;
  if(typeof author_posts != 'undefined') {
    for (var document_var in author_posts) {
      if (numProcs < limit_pins) {
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


function listVideos(author_posts) {
  if(typeof author_posts != 'undefined') {
    for (var document_var in author_posts) {
      console.log(author_posts[document_var].explorers[1]);
    }
  }
}


function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}


var myArgs = process.argv;
var author_posts = syncClient.get(API_ADDRESS+"?author="+myArgs[3]).body;
if(5 > myArgs.length < 4) {
  console.log("This App requires 2 or 3 arguments, 1) command (pin or ls) 2) author's name...\n");
  console.log("Example:\nnode "+__filename.slice(__dirname.length + 1)+" pin fasolo97\nnode "+__filename.slice(__dirname.length + 1)+" ls fasolo97");
  return -1;
}


if (myArgs[2] == "pin") {
  fetchAll(author_posts, limit_pins);
} else if (myArgs[2] == "ls") {
  listVideos(author_posts);
}
