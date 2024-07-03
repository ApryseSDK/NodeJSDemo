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
  res.status(200).json({
    status: 'success',
    data: 'Hello from the server..'
  })
});

const path = require('path');
const fs = require('fs');
const filesPath = `./files/`;
app.get('/files', (req, res) => {
  console.log(req.query);
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
      res.setHeader('Content-Type', mimeType[ext] || 'text/plain');
      res.end(data);
    }
  });
});

const { PDFNet } = require('@pdftron/pdfnet-node');
app.get('/convert/:filename', (req, res) => {
  const filename = req.params.filename;
  let ext = path.parse(filename).ext;

  const inputPath = path.resolve(__dirname, filesPath, filename);
  const outputPath = path.resolve(__dirname, filesPath, `${filename}.pdf`);

  if (ext === '.pdf') {
    res.statusCode = 500;
    res.end(`File is already PDF.`);
  }

  const main = async () => {
    await PDFNet.addResourceSearchPath('./lib/');
    const pdfdoc = await PDFNet.PDFDoc.create();
    await pdfdoc.initSecurityHandler();
    await PDFNet.Convert.toPdf(pdfdoc, inputPath);
    pdfdoc.save(
      outputPath,
      PDFNet.SDFDoc.SaveOptions.e_linearized,
    );
    ext = '.pdf';
  };


  PDFNet.runWithCleanup(main, "[Your license key]").then(() => {
    PDFNet.shutdown();
    fs.readFile(outputPath, (err, data) => {
      if (err) {
        res.statusCode = 500;
        res.end(err);
      } else {
        res.setHeader('Content-Type', 'application/pdf'),
          res.end(data);
      }
    })
  }).catch(err => {
    res.statusCode = 500;
    console.log(err)
    res.send({ err });
  });

});