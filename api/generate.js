// Fix for async/await issue in fontkit UMD build
require("regenerator-runtime/runtime");

const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { PDFDocument } = require("pdf-lib");
const { translate } = require("free-translate");
const fontkit = require("@pdf-lib/fontkit");

const app = express();
const PORT = 3000;

// Middleware to parse form data
app.use(express.urlencoded({ extended: true }));

// Serve static files if you want to host an HTML form
app.use(express.static("public"));

// Multer config for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});
const upload = multer({ storage });

// Translate English name to Hindi
const translateText = async (text) => {
  try {
    const translated = await translate(text, { from: "en", to: "hi" });
    console.log("Translated:", translated);
    return translated;
  } catch (err) {
    console.error("Translation failed:", err);
    return text;
  }
};

function formatAadhaarNumber(aadhaar) {
  return aadhaar.replace(/(.{4})/g, "$1 ").trim(); // Adds a space after every 4 digits
}

// Route to handle report card PDF generation
app.post("/generate-report-card", upload.single("photo"), async (req, res) => {
  try {
    const { english_name, dob, fatherName, aadharNumber } = req.body;
    const photoPath = req.file.path;
    const hindi_name = await translateText(english_name);

    // Load PDF template
    const templateBytes = fs.readFileSync("template.pdf");
    const pdfDoc = await PDFDocument.load(templateBytes);
    pdfDoc.registerFontkit(fontkit);

    // Load Hindi-compatible font (like Mangal or NotoSansDevanagari)
    const hindifontBytes = fs.readFileSync("fonts/Mangal-Regular.ttf");
    const hindiFont = await pdfDoc.embedFont(hindifontBytes);

    const boldfontBytes = fs.readFileSync("fonts/GothamBold.ttf");
    const boldFont = await pdfDoc.embedFont(boldfontBytes);

    const mediumfontBytes = fs.readFileSync("fonts/GothamMedium.ttf");
    const mediumFont = await pdfDoc.embedFont(mediumfontBytes);

    const formattedAadhar = formatAadhaarNumber(aadharNumber);
    const formattedDob = dob.split("-").reverse().join("/");

    // Embed photo
    const photoBytes = fs.readFileSync(photoPath);
    const photoImage = await pdfDoc.embedPng(photoBytes);
    const page = pdfDoc.getPage(0);

    // Draw the photo
    page.drawImage(photoImage, {
      x: 43,
      y: 570,
      width: 120,
      height: 140,
    });

    // Draw text (both Hindi and English)
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
      //   font: customFont,
    });

    // Final PDF response
    const pdfBytes = await pdfDoc.save();
    res.setHeader("Content-Type", "application/pdf");
    res.send(pdfBytes);

    // Cleanup: delete uploaded photo
    fs.unlinkSync(photoPath);
  } catch (err) {
    console.error("Error generating PDF:", err);
    res.status(500).send("Failed to generate PDF.");
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
