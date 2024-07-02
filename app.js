const express = require('express');
const port = 4000;

const app = express();

app.listen(port, () =>
  console.log(
    `nodejs-convert-file-server listening at http://localhost:${port}`,
  ),
);

app.get('/', (req, res) => {
    console.log(req.query);
    res.status(200).json({status:'success',
    data:'Hello from the server..'
    })
});

const path = require('path');
const fs = require('fs');
const filesPath= `./files/`;
app.get('/files', (req, res) => {
    const inputPath = path.resolve(__dirname, filesPath);
    fs.readdir(inputPath, function (err, files) {
      if (err) {
        return console.log('Unable to scan directory: ' + err);
      }
      res.setHeader('Content-type', 'application/json');
      res.end(JSON.stringify(files));
    });
  });
  
  const mimeType = require('./mimeType');  
  app.get('/files/:filename', (req, res) => {
    const inputPath = path.resolve(__dirname, filesPath, req.params.filename);
    fs.readFile(inputPath, function (err, data) {
      if (err) {
        res.statusCode = 500;
        res.end(`Error getting the file: ${err}.`);
      } else {
        const ext = path.parse(inputPath).ext;
        res.setHeader('Content-type', mimeType[ext] || 'text/plain');
        res.end(data);
      }
    });
  });


