require("regenerator-runtime/runtime");

const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { PDFDocument } = require("pdf-lib");
const { translate } = require("free-translate");
const fontkit = require("@pdf-lib/fontkit");
const serverless = require("serverless-http");

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const storage = multer.memoryStorage(); // Use memoryStorage for Vercel
const upload = multer({ storage });

// Format Aadhaar number with space after every 4 digits
function formatAadhaarNumber(aadhaar) {
  return aadhaar.replace(/(.{4})/g, "$1 ").trim();
}

const translateText = async (text) => {
  try {
    const translated = await translate(text, { from: "en", to: "hi" });
    return translated;
  } catch (err) {
    return text;
  }
};

app.post("/api/generate-report-card", upload.single("photo"), async (req, res) => {
  try {
    const { english_name, dob, fatherName, aadharNumber } = req.body;
    const photoBuffer = req.file.buffer;
    const hindi_name = await translateText(english_name);

    const templateBytes = fs.readFileSync(path.join(__dirname, "../template.pdf"));
    const pdfDoc = await PDFDocument.load(templateBytes);
    pdfDoc.registerFontkit(fontkit);

    const hindiFont = await pdfDoc.embedFont(fs.readFileSync(path.join(__dirname, "../fonts/Mangal-Regular.ttf")));
    const boldFont = await pdfDoc.embedFont(fs.readFileSync(path.join(__dirname, "../fonts/GothamBold.ttf")));
    const mediumFont = await pdfDoc.embedFont(fs.readFileSync(path.join(__dirname, "../fonts/GothamMedium.ttf")));

    const formattedAadhar = formatAadhaarNumber(aadharNumber);
    const formattedDob = dob.split("-").reverse().join("/");

    const photoImage = await pdfDoc.embedPng(photoBuffer);
    const page = pdfDoc.getPage(0);

    page.drawImage(photoImage, {
      x: 43,
      y: 570,
      width: 120,
      height: 140,
    });

    page.drawText(hindi_name, {
      x: 190,
      y: 700,
      size: 12,
      font: hindiFont,
    });

    page.drawText(english_name, {
      x: 190,
      y: 683,
      size: 12,
      font: mediumFont,
    });

    page.drawText(formattedDob, {
      x: 290,
      y: 662,
      size: 15,
      font: mediumFont,
    });

    page.drawText(formattedAadhar, {
      x: 180,
      y: 480,
      size: 25,
      font: boldFont,
    });

    page.drawText(formattedAadhar, {
      x: 190,
      y: 105,
      size: 25,
      font: boldFont,
    });

    page.drawText(fatherName, {
      x: 50,
      y: 310,
      size: 12,
      font: mediumFont,
    });

    const pdfBytes = await pdfDoc.save();
    res.setHeader("Content-Type", "application/pdf");
    res.send(pdfBytes);
  } catch (err) {
    console.error("Error generating PDF:", err);
    res.status(500).send("Failed to generate PDF.");
  }
});

module.exports = app;
module.exports.handler = serverless(app);
