const syncClient = require('sync-rest-client');
const { exec } = require('child_process');
const API_ADDRESS = "https://dtube.fso.ovh/apis/list_videos.php";
var myArgs = process.argv.slice(2);
console.log('myArgs: ', myArgs);
if(myArgs.lenght != 1) {
  console.log("This App requires exactly 1 argument, 1 author's name...");
  return -1;
}
var author_posts = syncClient.get(API_ADDRESS+"/?author="+myArgs[0]).body;

async function fetchAll(author_posts) {
  let numProcs = 0;
  function remove1process() {
    numProcs -= 1;
  }
  var last_exec = 0;
  var numRows = 0;
  var last_error_print = 0;
  var num_supressed_errors = 0;
  if (numProcs < 50) {
    if(typeof author_posts != 'undefined') {
      for (var document_var in author_posts) {
        if (Date.now() - last_exec >= 3000) {
          last_exec = Date.now();
          console.log("Wrote "+numRows+" rows...");
        }
        document_var = author_posts[document_var];
        if(typeof document_var.json != 'undefined' && typeof document_var.json.files != 'undefined') {
          if(typeof document_var.json.nsfw == 'undefined') {
            var nsfw = -1;
          } else if(con.escape(document_var.json.nsfw) == "'false'") {
            var nsfw = 0;
          } else {
            var nsfw = document_var.json.nsfw;
          }
          if(typeof document_var.json.oc == 'undefined') {
            var oc = -1;
          } else {
            var oc = document_var.json.oc;
          }
          if(typeof document_var.json.files != 'undefined' &&
            (typeof document_var.json.files.btfs != 'undefined'
            || typeof document_var.json.files.ipfs != 'undefined')) {
            if(typeof document_var.json.files.ipfs != 'undefined') {
              for (var file in document_var.json.files.ipfs.vid) {
                file = document_var.json.files.ipfs.vid[file];
                numProcs += 1;
                exec("ipfs-cluster-ctl pin add --expire-in "+24*30*18+"h "+file, remove1process);
                console.log("IPFS: Pinned video: "+file);
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
                file = document_var.json.files.btfs.vid[file];
                numProcs += 1;
                exec("btfs pin add "+file, remove1process);
                console.log("BTFS: Pinned video: "+file);
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
      }
	}
  } else {
    await sleep(1500);
  }
  con.end();
}
function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

fetchAll(author_posts);