const express = require('express');
const path = require('path');
const fs = require('fs');
const { PDFNet } = require('@pdftron/pdfnet-node');
const mimeType = require('./mimeType');

const port = 4000;
const filesPath = './files/';
const resourcePath = './Lib/';

const licenseKey = process.env.APRYSE_LICENSE_KEY;
if (!licenseKey) {
  console.warn('APRYSE_LICENSE_KEY is not set.');
}

const app = express();

// Runs the PDFNet work in `main`, then sends the output file back
const PDFNetEndpoint = async (main, outputPath, res) => {
  try {
    await PDFNet.runWithCleanup(main, licenseKey);
    res.sendFile(outputPath);
  } catch (error) {
    res.status(500).send(String(error));
  }
};

app.get('/', (req, res) => {
  res.status(200).json({
    status: 'success',
    data: 'Hello from the server.',
  });
});

app.get('/files', (req, res) => {
  const inputPath = path.resolve(__dirname, filesPath);

  fs.readdir(inputPath, (err, files) => {
    if (err) {
      console.log(`Unable to scan directory: ${err}`);
      res.statusCode = 500;
      res.end(`Unable to scan directory: ${err}.`);
    } else {
      res.json(files);
    }
  });
});

app.get('/files/:filename', (req, res) => {
  res.sendFile(path.resolve(__dirname, filesPath, req.params.filename));
});

app.get('/convert/:filename', (req, res) => {
  const filename = req.params.filename;
  const ext = path.parse(filename).ext;
  const inputPath = path.resolve(__dirname, filesPath, filename);
  const outputPath = path.resolve(__dirname, filesPath, `${filename}.pdf`);

  if (ext === '.pdf') {
    res.status(400).send('File is already PDF.');
    return;
  }

  const main = async () => {
    await PDFNet.addResourceSearchPath(resourcePath);
    const pdfdoc = await PDFNet.PDFDoc.create();
    await pdfdoc.initSecurityHandler();
    await PDFNet.Convert.toPdf(pdfdoc, inputPath);
    await pdfdoc.save(outputPath, PDFNet.SDFDoc.SaveOptions.e_linearized);
  };

  PDFNetEndpoint(main, outputPath, res);
});

app.get('/convert-to-docx/:filename', (req, res) => {
  const filename = req.params.filename;
  const ext = path.parse(filename).ext;
  const inputPath = path.resolve(__dirname, filesPath, filename);
  const outputPath = path.resolve(__dirname, filesPath, `${filename}.docx`);

  if (ext !== '.pdf') {
    res.status(400).send('File is not a PDF.');
    return;
  }

  const main = async () => {
    await PDFNet.addResourceSearchPath(resourcePath);
    // check if the module is available
    if (!(await PDFNet.StructuredOutputModule.isModuleAvailable())) {
      throw new Error('Module not available.');
    }
    await PDFNet.Convert.fileToWord(inputPath, outputPath);
  };

  PDFNetEndpoint(main, outputPath, res);
});

app.get('/thumbnail/:filename', (req, res) => {
  const filename = req.params.filename;
  const ext = path.parse(filename).ext;
  const inputPath = path.resolve(__dirname, filesPath, filename);
  const outputPath = path.resolve(__dirname, filesPath, `${filename}.png`);

  if (ext !== '.pdf') {
    res.status(400).send(`Only PDFs can return a thumbnail. Cannot return a thumb for a file with extension: ${ext}.`);
    return;
  }

  const main = async () => {
    const doc = await PDFNet.PDFDoc.createFromFilePath(inputPath);
    await doc.initSecurityHandler();
    // Default dpi is 92 which gives a more or less full size image, so use a smaller value of 12
    const pdfdraw = await PDFNet.PDFDraw.create(12);
    const currPage = await doc.getPage(1);
    await pdfdraw.export(currPage, outputPath, 'PNG');
  };

  PDFNetEndpoint(main, outputPath, res);
});

app.get('/replace-content/:name', (req, res) => {
  // The name to be used in the document is included in the request parameters
  const name = req.params.name.replaceAll('_', ' ');
  const filename = 'template_letter.pdf';
  const inputPath = path.resolve(__dirname, filesPath, filename);
  const outputPath = path.resolve(__dirname, filesPath, `${filename}_replaced.pdf`);

  const main = async () => {
    const pdfdoc = await PDFNet.PDFDoc.createFromFilePath(inputPath);
    await pdfdoc.initSecurityHandler();

    const replacer = await PDFNet.ContentReplacer.create();
    const page = await pdfdoc.getPage(1);

    await replacer.addString('NAME', name);
    await replacer.addString('Address', '123 Main St, Vancouver, BC CANADA');
    await replacer.addString('DATE', new Date().toLocaleString());
    await replacer.process(page);

    await pdfdoc.save(outputPath, PDFNet.SDFDoc.SaveOptions.e_linearized);
  };

  PDFNetEndpoint(main, outputPath, res);
});

app.listen(port, () =>
  console.log(`nodejs-convert-file-server listening at http://localhost:${port}`),
);

// Shut PDFNet down once, when the server is stopped (Ctrl+C)
process.on('SIGINT', async () => {
  await PDFNet.shutdown();
  process.exit();
});
