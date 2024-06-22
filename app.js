// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { jsPDF } = require('jspdf');
require('jspdf-autotable');
const bodyParser = require('body-parser');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const tmpDir = path.join('/tmp');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir);
    }
    cb(null, tmpDir);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage: storage });

// Nodemailer transporter setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.sender,
    pass: process.env.password,
  },
});

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Route to serve the HTML form
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Handle form submission with file upload
app.post('/submit-form', upload.array('files', 12), async (req, res) => {
  const { clientName, productName, severity, ...formData } = req.body;

  const pdfPath = path.join('/tmp', `${clientName}.pdf`);

  try {
    await generatePDF(pdfPath, clientName, formData);

    const attachments = [
      {
        filename: `${clientName}.pdf`,
        path: pdfPath,
      },
    ];

    if (req.files) {
      req.files.forEach(file => {
        attachments.push({
          filename: file.originalname,
          path: file.path,
        });
      });
    }

    const mailOptions = {
      from: process.env.sender,
      to: process.env.reciever,
      subject: 'Issue Report',
      text: `Issue Report for ${clientName}`,
      attachments: attachments,
    };

    // Send email
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.log('Error sending email:', error);
        return res.status(500).send('Error sending email');
      } else {
        console.log('Email sent: ' + info.response);
        res.send('Thank you for filling out this form');

        // Delete the generated PDF and uploaded files after email is sent
        fs.unlinkSync(pdfPath);
        req.files.forEach(file => fs.unlinkSync(file.path));
      }
    });
  } catch (err) {
    console.error('Error generating PDF:', err);
    res.status(500).send('Error generating PDF');
  }
});

// Function to generate PDF
async function generatePDF(pdfPath, clientName, formData) {
  const pdfDoc = new jsPDF();
  pdfDoc.text(`Issue Report for ${clientName}`, 10, 10);

  // Define the table content
  const tableData = Object.entries(formData).map(([key, value]) => [key, value]);

  pdfDoc.autoTable({
    head: [['Field', 'Details']],
    body: tableData,
    startY: 20,
  });

  // Save PDF as a buffer and write it to the file system
  const pdfBuffer = pdfDoc.output('arraybuffer');
  fs.writeFileSync(pdfPath, Buffer.from(pdfBuffer));
  console.log('PDF successfully generated:', pdfPath);
}

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
