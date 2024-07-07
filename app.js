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
     console.log('Unable to scan directory: ' + err);
     res.statusCode = 500;
     res.end(`Unable to scan directory: ${err}.`);
    }
    else {
    res.setHeader('Content-type', 'application/json');
    res.end(JSON.stringify(files));
    }
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
  const ext = path.parse(filename).ext;
  const inputPath = path.resolve(__dirname, filesPath, filename);
  const outputPath = path.resolve(__dirname, filesPath, `${filename}.pdf`);
  if (ext === '.pdf') {
    res.statusCode = 500;
    res.end(`File is already PDF.`);
    return;
  }
  const main = async () => {
    await PDFNet.addResourceSearchPath('./lib/');
    const pdfdoc = await PDFNet.PDFDoc.create();
    await pdfdoc.initSecurityHandler();
    await PDFNet.Convert.toPdf(pdfdoc, inputPath);
    await pdfdoc.save(
      outputPath,
      PDFNet.SDFDoc.SaveOptions.e_linearized,
    );
  };

  PDFNetEndpoint(main, outputPath, res);
});

app.get('/convertToDOCX/:filename', (req, res) => {
  const filename = req.params.filename;
  let ext = path.parse(filename).ext;
  const inputPath = path.resolve(__dirname, filesPath, filename);
  const outputPath = path.resolve(__dirname, filesPath, `${filename}.docx`);

  if (ext !== '.pdf') {
    res.statusCode = 500;
    res.end(`File is not a PDF.`);
    return;
  }

  const main = async () => {
    await PDFNet.addResourceSearchPath('./lib/');
    // check if the module is available
    if (!(await PDFNet.StructuredOutputModule.isModuleAvailable())) {
      res.statusCode = 500;
      res.end(`Module not available..`);
    }
    await PDFNet.Convert.fileToWord(inputPath, outputPath)
    ext = '.docx';
  };

  PDFNetEndpoint(main, outputPath, res);
  
});

app.get('/thumbnail/:filename', (req, res) => {
  const filename = req.params.filename;
  let ext = path.parse(filename).ext;

  const inputPath = path.resolve(__dirname, filesPath, filename);
  const outputPath = path.resolve(__dirname, filesPath, `${filename}.png`);

  if (ext !== '.pdf') {
    res.statusCode = 500;
    res.end(`Only PDFs can return a thumbnail. Cannot return a thumb for a file with extension: ${ext}.`);
    return;
  }

  const main = async () => {
    const doc = await PDFNet.PDFDoc.createFromFilePath(inputPath);
    await doc.initSecurityHandler();
    // Default dpi is 92 which gives a more or less full size image
    const pdfdraw = await PDFNet.PDFDraw.create(12);
    const currPage = await doc.getPage(1);
    await pdfdraw.export(currPage, outputPath, 'PNG');
  };

  PDFNetEndpoint(main, outputPath, res);
})

app.get('/replaceContent/:name', (req, res) => {
  // The name to be used in the document is included in the request parameters
  const name = req.params.name.replace('_', ' ');
  const filename = 'template_letter.pdf'

  const inputPath = path.resolve(__dirname, filesPath, filename);
  const outputPath = path.resolve(__dirname, filesPath, `${filename}_replaced.pdf`);

  const main = async () => {
    const pdfdoc = await PDFNet.PDFDoc.createFromFilePath(inputPath);
    await pdfdoc.initSecurityHandler();
    const replacer = await PDFNet.ContentReplacer.create();
    const page = await pdfdoc.getPage(1);

    await replacer.addString('NAME', name);
    await replacer.addString('Address', '123 Main St, Vancouver, BC CANADA');
    await replacer.addString('DATE', new Date(Date.now()).toLocaleString());
    await replacer.process(page);

    await pdfdoc.save(outputPath, PDFNet.SDFDoc.SaveOptions.e_linearized,);
  };

  PDFNetEndpoint(main, outputPath, res);
});


const PDFNetEndpoint = (main, pathname, res) => {
    PDFNet.runWithCleanup(main, "[You license key]")
    .then(() => {
      PDFNet.shutdown();
      fs.readFile(pathname, (err, data) => {
        if (err) {
          res.statusCode = 500;
          res.end(`Error getting the file: ${err}.`);
        } else {
          const ext = path.parse(pathname).ext;
          res.setHeader('Content-type', mimeType[ext] || 'text/plain');
          res.end(data);
        }
      });
    })
    .catch((error) => {
      res.statusCode = 500;
      res.send(error);
    });
};
