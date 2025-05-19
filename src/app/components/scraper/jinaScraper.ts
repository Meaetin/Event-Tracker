import * as https from 'https';

const url = 'https://r.jina.ai/https://thesmartlocal.com/read/things-to-do-this-weekend-singapore/';
const options = {
  headers: {
    'Authorization': 'Bearer jina_8859b5e043314e66ad0d2f81987b71b9_iRVGNkmV6ynLxoVY13_yCoCST_B',
    'X-Return-Format': 'markdown'
  }
};

https.get(url, options, (res) => {
  let data = '';

  // A chunk of data has been received.
  res.on('data', (chunk) => {
    data += chunk;
  });

  // The whole response has been received.
  res.on('end', () => {
    console.log(data);
  });

}).on('error', (e) => {
  console.error(`Got error: ${e.message}`);
});