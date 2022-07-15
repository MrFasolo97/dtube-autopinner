/* eslint-disable no-restricted-syntax */
import { create as IPFSClient } from 'ipfs-http-client';
import { exec } from 'node:child_process';
import * as fs from 'fs';
import sleep from 'sleep';

export default function pinAll(options, ipfsAddress) {
  if (options.ipfs !== '' && typeof options.ipfs !== 'undefined') {
    const ipfsClient = IPFSClient(ipfsAddress);
    const fileContent = fs.readFileSync(options.ipfs, 'ascii');
    const lines = fileContent.split('\n');
    for (const line in lines) {
      if (lines[line] !== '') {
        console.log(lines[line]);
        ipfsClient.pin.add(lines[line]);
        sleep.msleep(options.delay);
      }
    }
  }
  if (options.btfs !== '' && typeof options.btfs !== 'undefined') {
    const file = fs.readFileSync(options.btfs, 'ascii');
    const lines = file.split('\n');
    for (const line in lines) {
      if (lines[line] !== '') {
        console.log(lines[line]);
        exec(`btfs pin add ${lines[line]}`);
        sleep.msleep(options.delay);
      }
    }
  }
}
